"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import json
import logging
import re
import types
from datetime import timedelta
from typing import Union
from urllib.parse import urlparse

from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from core.redis import start_job_async_or_sync
from core.utils.params import get_env
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from io_storages.base_models import (
    ExportStorage,
    ExportStorageLink,
    ImportStorage,
    ImportStorageLink,
    ProjectStorageMixin,
)
from io_storages.utils import (
    StorageObject,
    load_tasks_json,
    parse_range,
    storage_can_resolve_bucket_url,
)
from tasks.models import Annotation

from label_studio.io_storages.azure_blob.utils import AZURE

logger = logging.getLogger(__name__)
logging.getLogger('azure.core.pipeline.policies.http_logging_policy').setLevel(logging.WARNING)


class AzureBlobStorageMixin(models.Model):
    container = models.TextField(_('container'), null=True, blank=True, help_text='Azure blob container')
    prefix = models.TextField(_('prefix'), null=True, blank=True, help_text='Azure blob prefix name')
    regex_filter = models.TextField(
        _('regex_filter'), null=True, blank=True, help_text='Cloud storage regex for filtering objects'
    )
    use_blob_urls = models.BooleanField(
        _('use_blob_urls'), default=False, help_text='Interpret objects as BLOBs and generate URLs'
    )
    account_name = models.TextField(_('account_name'), null=True, blank=True, help_text='Azure Blob account name')
    account_key = models.TextField(_('account_key'), null=True, blank=True, help_text='Azure Blob account key')

    def get_account_name(self):
        return str(self.account_name) if self.account_name else get_env('AZURE_BLOB_ACCOUNT_NAME')

    def get_account_key(self):
        return str(self.account_key) if self.account_key else get_env('AZURE_BLOB_ACCOUNT_KEY')

    def get_client_and_container(self):
        account_name = self.get_account_name()
        account_key = self.get_account_key()
        if not account_name or not account_key:
            raise ValueError(
                'Azure account name and key must be set using '
                'environment variables AZURE_BLOB_ACCOUNT_NAME and AZURE_BLOB_ACCOUNT_KEY '
                'or account_name and account_key fields.'
            )
        connection_string = (
            'DefaultEndpointsProtocol=https;AccountName='
            + account_name
            + ';AccountKey='
            + account_key
            + ';EndpointSuffix=core.windows.net'
        )
        client = BlobServiceClient.from_connection_string(conn_str=connection_string)
        container = client.get_container_client(str(self.container))
        return client, container

    def get_container(self):
        _, container = self.get_client_and_container()
        return container

    def validate_connection(self, **kwargs):
        logger.debug('Validating Azure Blob Storage connection')
        client, container = self.get_client_and_container()

        try:
            container_properties = container.get_container_properties()
            logger.debug(f'Container exists: {container_properties.name}')
        except ResourceNotFoundError:
            raise KeyError(f'Container not found: {self.container}')

        # Check path existence for Import storages only
        if self.prefix and 'Export' not in self.__class__.__name__:
            logger.debug(f'Test connection to container {self.container} with prefix {self.prefix}')
            prefix = str(self.prefix)
            try:
                blob = next(container.list_blob_names(name_starts_with=prefix))
            except StopIteration:
                blob = None

            if not blob:
                raise KeyError(f'{self.url_scheme}://{self.container}/{self.prefix} not found.')

    def get_bytes_stream(self, uri, range_header=None):
        """Get file bytes from Azure Blob storage as a streaming object with metadata.

        Implements range request support similar to GCS and S3 implementations:
        - Accepts ``range_header`` in format ``bytes=start-end``
        - Uses Azure's download_blob with offset/length for efficient ranged access
        - Returns a tuple of (stream_with_iter_chunks, content_type, metadata_dict)

        Args:
            uri: The Azure URI of the file to retrieve
            range_header: Optional HTTP Range header to limit bytes

        Returns:
            Tuple of (streaming body with iter_chunks, content_type, metadata)
        """
        # Parse URI to get container and blob name
        parsed_uri = urlparse(uri, allow_fragments=False)
        container_name = parsed_uri.netloc
        blob_name = parsed_uri.path.lstrip('/')

        try:
            # Get the Azure client and blob client for file
            client, _ = self.get_client_and_container()
            blob_client = client.get_blob_client(container=container_name, blob=blob_name)
            # Get blob properties for metadata
            properties = blob_client.get_blob_properties()
            total_size = properties.size
            content_type = properties.content_settings.content_type or 'application/octet-stream'

            # Parse range header
            streaming = True
            start, end = parse_range(range_header)
            # Browser requesting full file without streaming
            if start is None and end is None:
                streaming = False
                start, end = 0, total_size
            # Browser requesting just headers for streaming
            elif start == 0 and (end == 0 or end == ''):
                start, end = 0, 1

            # if streaming, we need to load blob consequently for smooth browser experience
            if streaming:
                # Limit initial download_blob() call size to 1Kb to avoid long delay
                blob_client._config.max_single_get_size = 1024  # 1Kb
                # Calculate length for Azure download_blob
                length = (end - start) if end else None
                # Seek & stream using StorageStreamDownloader
                downloader = blob_client.download_blob(offset=start, length=length)
            else:
                length = total_size
                # Prepare for downloading entire blob at once
                downloader = blob_client.download_blob()

            def _iter_chunks(self_downloader, chunk_size=1024 * 1024):
                """Iterate over chunks of blob data"""
                self_downloader._config.max_chunk_get_size = chunk_size
                total = 0
                for chunk in self_downloader.chunks():
                    yield chunk
                    total += len(chunk)
                    if total >= length:
                        return

            # Add iter_chunks method to StorageStreamDownloader instance
            # for compatibility with proxy_storage_data() in proxy_api.py
            downloader.iter_chunks = types.MethodType(_iter_chunks, downloader)
            downloader.close = types.MethodType(lambda self: None, downloader)

            # Calculate content length and set appropriate status code
            content_length = length if length is not None else (total_size - start)
            status_code = 206 if streaming else 200

            # Build metadata dictionary matching S3/GCS format
            metadata = {
                'ETag': properties.etag,
                'ContentLength': content_length,
                'ContentRange': f'bytes {start}-{start + length-1}/{total_size or 0}',
                'LastModified': properties.last_modified,
                'StatusCode': status_code,
            }
            return downloader, content_type, metadata

        except Exception as e:
            logger.error(f'Error getting bytes stream from Azure for uri {uri}: {e}', exc_info=True)
            return None, None, {}


class AzureBlobImportStorageBase(AzureBlobStorageMixin, ImportStorage):
    url_scheme = 'azure-blob'

    presign = models.BooleanField(_('presign'), default=True, help_text='Generate presigned URLs')
    presign_ttl = models.PositiveSmallIntegerField(
        _('presign_ttl'), default=1, help_text='Presigned URLs TTL (in minutes)'
    )

    def iterkeys(self):
        container = self.get_container()
        prefix = str(self.prefix) if self.prefix else ''
        files = container.list_blobs(name_starts_with=prefix)
        regex = re.compile(str(self.regex_filter)) if self.regex_filter else None

        for file in files:
            # skip folder
            if file.name == (prefix.rstrip('/') + '/'):
                continue
            # check regex pattern filter
            if regex and not regex.match(file.name):
                logger.debug(file.name + ' is skipped by regex filter')
                continue
            yield file.name

    def get_data(self, key) -> list[StorageObject]:
        if self.use_blob_urls:
            data_key = settings.DATA_UNDEFINED_NAME
            task = {data_key: f'{self.url_scheme}://{self.container}/{key}'}
            return [StorageObject(key=key, task_data=task)]

        container = self.get_container()
        blob = container.download_blob(key)
        blob = blob.content_as_bytes()
        return load_tasks_json(blob, key)

    def scan_and_create_links(self):
        return self._scan_and_create_links(AzureBlobImportStorageLink)

    def generate_http_url(self, url):
        r = urlparse(url, allow_fragments=False)
        container = r.netloc
        blob = r.path.lstrip('/')

        expiry = timezone.now() + timedelta(minutes=self.presign_ttl)

        sas_token = generate_blob_sas(
            account_name=self.get_account_name(),
            container_name=container,
            blob_name=blob,
            account_key=self.get_account_key(),
            permission=BlobSasPermissions(read=True),
            expiry=expiry,
        )
        return (
            'https://' + self.get_account_name() + '.blob.core.windows.net/' + container + '/' + blob + '?' + sas_token
        )

    def can_resolve_url(self, url: Union[str, None]) -> bool:
        return storage_can_resolve_bucket_url(self, url)

    def get_blob_metadata(self, key):
        return AZURE.get_blob_metadata(
            key, self.container, account_name=self.account_name, account_key=self.account_key
        )

    class Meta:
        abstract = True


class AzureBlobImportStorage(ProjectStorageMixin, AzureBlobImportStorageBase):
    class Meta:
        abstract = False


class AzureBlobExportStorage(AzureBlobStorageMixin, ExportStorage):  # note: order is important!
    def save_annotation(self, annotation):
        container = self.get_container()
        logger.debug(f'Creating new object on {self.__class__.__name__} Storage {self} for annotation {annotation}')
        ser_annotation = self._get_serialized_data(annotation)
        # get key that identifies this object in storage
        key = AzureBlobExportStorageLink.get_key(annotation)
        key = str(self.prefix) + '/' + key if self.prefix else key

        # put object into storage
        blob = container.get_blob_client(key)
        blob.upload_blob(json.dumps(ser_annotation), overwrite=True)

        # create link if everything ok
        AzureBlobExportStorageLink.create(annotation, self)


def async_export_annotation_to_azure_storages(annotation):
    project = annotation.project
    if hasattr(project, 'io_storages_azureblobexportstorages'):
        for storage in project.io_storages_azureblobexportstorages.all():
            logger.debug(f'Export {annotation} to Azure Blob storage {storage}')
            storage.save_annotation(annotation)


@receiver(post_save, sender=Annotation)
def export_annotation_to_azure_storages(sender, instance, **kwargs):
    storages = getattr(instance.project, 'io_storages_azureblobexportstorages', None)
    if storages and storages.exists():  # avoid excess jobs in rq
        start_job_async_or_sync(async_export_annotation_to_azure_storages, instance)


class AzureBlobImportStorageLink(ImportStorageLink):
    storage = models.ForeignKey(AzureBlobImportStorage, on_delete=models.CASCADE, related_name='links')


class AzureBlobExportStorageLink(ExportStorageLink):
    storage = models.ForeignKey(AzureBlobExportStorage, on_delete=models.CASCADE, related_name='links')
