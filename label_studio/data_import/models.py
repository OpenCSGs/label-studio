"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging
import os
import uuid
from collections import Counter

import pandas as pd

try:
    import ujson as json
except:  # noqa: E722
    import json

from django.conf import settings
from django.db import models
from django.utils.functional import cached_property
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def upload_name_generator(instance, filename):
    project = str(instance.project_id)
    project_dir = os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, project)
    os.makedirs(project_dir, exist_ok=True)
    path = settings.UPLOAD_DIR + '/' + project + '/' + str(uuid.uuid4())[0:8] + '-' + filename
    return path


class FileUpload(models.Model):
    user = models.ForeignKey('users.User', related_name='file_uploads', on_delete=models.CASCADE)
    project = models.ForeignKey('projects.Project', related_name='file_uploads', on_delete=models.CASCADE)
    file = models.FileField(upload_to=upload_name_generator)

    def has_permission(self, user):
        user.project = self.project  # link for activity log
        return self.project.has_permission(user)

    @cached_property
    def filepath(self):
        return self.file.name

    @cached_property
    def file_name(self):
        return os.path.basename(self.file.name)

    @property
    def url(self):
        if settings.FORCE_SCRIPT_NAME and not (settings.HOSTNAME and settings.CLOUD_FILE_STORAGE_ENABLED):
            return settings.FORCE_SCRIPT_NAME + '/' + self.file.url.lstrip('/')
        else:
            return self.file.url

    @property
    def format(self):
        file_format = None
        try:
            file_format = os.path.splitext(self.filepath)[-1]
        except:  # noqa: E722
            pass
        finally:
            logger.debug('Get file format ' + str(file_format))
        return file_format

    @property
    def content(self):
        # cache file body
        if hasattr(self, '_file_body'):
            body = getattr(self, '_file_body')
        else:
            body = self.file.read().decode('utf-8')
            setattr(self, '_file_body', body)
        return body

    def read_tasks_list_from_csv(self, sep=','):
        logger.debug('Read tasks list from CSV file {}'.format(self.filepath))
        tasks = pd.read_csv(self.file.open(), sep=sep).fillna('').to_dict('records')
        tasks = [{'data': task} for task in tasks]
        return tasks

    def read_tasks_list_from_tsv(self):
        return self.read_tasks_list_from_csv('\t')

    def read_tasks_list_from_txt(self):
        logger.debug('Read tasks list from text file {}'.format(self.filepath))
        lines = self.content.splitlines()
        # Prefer mapping TXT lines to an explicit data key when possible to keep keys consistent across files
        project_keys = list(getattr(self.project, 'data_types', {}).keys()) if hasattr(self, 'project') else []
        # Prefer 'text' over 'question' to match common NLP templates
        if 'text' in project_keys:
            key = 'text'
        elif 'question' in project_keys:
            key = 'question'
        elif len(project_keys) == 1:
            key = project_keys[0]
        else:
            key = settings.DATA_UNDEFINED_NAME
        tasks = [{'data': {key: line}} for line in lines]
        return tasks

    def read_tasks_list_from_json(self):
        logger.debug('Read tasks list from JSON file {}'.format(self.filepath))

        raw_data = self.content
        # Python 3.5 compatibility fix https://docs.python.org/3/whatsnew/3.6.html#json
        try:
            tasks = json.loads(raw_data)
        except TypeError:
            tasks = json.loads(raw_data.decode('utf8'))
        if isinstance(tasks, dict):
            tasks = [tasks]
        tasks_formatted = []
        for i, task in enumerate(tasks):
            if not task.get('data'):
                task = {'data': task}
            if not isinstance(task['data'], dict):
                raise ValidationError('Task item should be dict')
            tasks_formatted.append(task)
        return tasks_formatted

    def read_task_from_hypertext_body(self):
        logger.debug('Read 1 task from hypertext file {}'.format(self.filepath))
        body = self.content
        project_keys = set(getattr(self.project, 'data_types', {}).keys()) if hasattr(self, 'project') else set()
        if 'text' in project_keys:
            tasks = [{'data': {'text': body}}]
        elif len(project_keys) == 1:
            sole_key = list(project_keys)[0]
            tasks = [{'data': {sole_key: body}}]
        else:
            tasks = [{'data': {settings.DATA_UNDEFINED_NAME: body}}]
        return tasks

    def read_task_from_uploaded_file(self):
        logger.debug('Read 1 task from uploaded file {}'.format(self.filepath))
        value = self.filepath if settings.CLOUD_FILE_STORAGE_ENABLED else self.url
        ext = (os.path.splitext(self.filepath)[-1] or '').lower()
        project_keys = set(getattr(self.project, 'data_types', {}).keys()) if hasattr(self, 'project') else set()

        image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff'}
        audio_exts = {'.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac'}
        video_exts = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}

        if ext in image_exts and 'image' in project_keys:
            return [{'data': {'image': value}}]
        if ext in audio_exts and 'audio' in project_keys:
            return [{'data': {'audio': value}}]
        if ext in video_exts and 'video' in project_keys:
            return [{'data': {'video': value}}]

        if 'text' in project_keys:
            return [{'data': {'text': value}}]
        elif len(project_keys) == 1:
            sole_key = list(project_keys)[0]
            return [{'data': {sole_key: value}}]
        else:
            return [{'data': {settings.DATA_UNDEFINED_NAME: value}}]

    def read_task_from_uploaded_file_mapped(self):
        """Map raw asset files to appropriate data key based on project config (image/audio/video)."""
        logger.debug('Read 1 mapped task from uploaded file {}'.format(self.filepath))
        # Determine target URL/path
        value = self.filepath if settings.CLOUD_FILE_STORAGE_ENABLED else self.url

        # Known extensions
        image_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff'}
        audio_exts = {'.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac'}
        video_exts = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}

        ext = (os.path.splitext(self.filepath)[-1] or '').lower()
        project_keys = set(getattr(self.project, 'data_types', {}).keys()) if hasattr(self, 'project') else set()

        if ext in image_exts and 'image' in project_keys:
            return [{'data': {'image': value}}]
        if ext in audio_exts and 'audio' in project_keys:
            return [{'data': {'audio': value}}]
        if ext in video_exts and 'video' in project_keys:
            return [{'data': {'video': value}}]

        # Fallback to undefined key
        return self.read_task_from_uploaded_file()

    @property
    def format_could_be_tasks_list(self):
        return self.format in ('.csv', '.tsv', '.txt')

    def read_tasks(self, file_as_tasks_list=True):
        file_format = self.format
        try:
            # file as tasks list
            if file_format == '.csv' and file_as_tasks_list:
                tasks = self.read_tasks_list_from_csv()
            elif file_format == '.tsv' and file_as_tasks_list:
                tasks = self.read_tasks_list_from_tsv()
            elif file_format == '.txt' and file_as_tasks_list:
                tasks = self.read_tasks_list_from_txt()
            elif file_format == '.json':

                tasks = self.read_tasks_list_from_json()
            # asset formats: map directly to appropriate keys if possible (works for single or multi key projects)
            elif file_format and file_format.lower() in (
                '.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff',
                '.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac',
                '.mp4', '.avi', '.mov', '.mkv', '.webm'
            ):
                tasks = self.read_task_from_uploaded_file_mapped()
            # otherwise - only one object tag should be presented in label config
            elif not self.project.one_object_in_label_config:
                raise ValidationError(
                    'Your label config has more than one data key and direct file upload supports only '
                    'one data key. To import data with multiple data keys, use a JSON or CSV file.'
                )

            # file as a single asset
            elif file_format in ('.html', '.htm', '.xml'):
                tasks = self.read_task_from_hypertext_body()
            else:
                tasks = self.read_task_from_uploaded_file()

        except Exception as exc:
            raise ValidationError('Failed to parse input file ' + self.file_name + ': ' + str(exc))
        return tasks

    @classmethod
    def load_tasks_from_uploaded_files(
        cls, project, file_upload_ids=None, formats=None, files_as_tasks_list=True, trim_size=None
    ):
        tasks = []
        fileformats = []
        common_data_fields = set()

        # scan all files
        file_uploads = FileUpload.objects.filter(project=project)
        if file_upload_ids:
            file_uploads = file_uploads.filter(id__in=file_upload_ids)
        for file_upload in file_uploads:
            file_format = file_upload.format
            if formats and file_format not in formats:
                continue
            # Skip hidden files and unsupported formats when expecting files as tasks list
            base_name = os.path.basename(file_upload.file.name)
            if files_as_tasks_list:
                media_asset = file_format and file_format.lower() in (
                    '.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff',
                    '.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac',
                    '.mp4', '.avi', '.mov', '.mkv', '.webm'
                )
                is_supported = (
                    file_upload.format_could_be_tasks_list or file_format == '.json' or media_asset
                )
                if base_name.startswith('.') or not is_supported:
                    logger.warning('Skipping non-task-list file during import: %s', file_upload.file.name)
                    continue
            # If project has multiple data keys, skip any non-structured file types except media assets
            if not project.one_object_in_label_config:
                structured = file_format in ('.csv', '.tsv', '.txt', '.json')
                media_asset = file_format and file_format.lower() in (
                    '.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff',
                    '.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac',
                    '.mp4', '.avi', '.mov', '.mkv', '.webm'
                )
                if not (structured or media_asset):
                    logger.warning(
                        'Skipping non-structured file for multi-key project during import: %s',
                        file_upload.file.name,
                    )
                    continue
            new_tasks = file_upload.read_tasks(files_as_tasks_list)
            for task in new_tasks:
                task['file_upload_id'] = file_upload.id

                # Normalize task data keys against project label config requirements
                try:
                    data = task.get('data', {})
                    project_keys = list(getattr(project, 'data_types', {}).keys()) if project else []
                    data_types_map = dict(getattr(project, 'data_types', {})) if project else {}
                    # If project expects 'question' and task has 'text' instead, mirror value into 'question'
                    if 'question' in project_keys and 'question' not in data and 'text' in data:
                        # Do not remove original 'text' to avoid breaking other uses
                        data['question'] = data['text']
                    # If project expects 'text' and task has 'question' instead, mirror into 'text'
                    if 'text' in project_keys and 'text' not in data and 'question' in data:
                        data['text'] = data['question']
                    # If project has exactly one key and it's missing, try to map a likely source
                    if len(project_keys) == 1:
                        sole_key = project_keys[0]
                        if sole_key not in data:
                            # Prefer common aliases
                            for alias in ('question', 'text', 'image', 'audio', 'video'):
                                if alias in data:
                                    data[sole_key] = data[alias]
                                    break

                    # Coerce values to expected types when possible to avoid validation errors
                    for key, expected_tag in data_types_map.items():
                        if key not in data:
                            continue
                        value = data[key]
                        # Normalize None -> '' for string-expected tags (Audio/Video/Text/etc.)
                        if value is None:
                            data[key] = ''
                            continue
                        # If a list is provided but a scalar string is expected, pick first string
                        if isinstance(value, list):
                            # Image supports list; keep as-is for Image
                            if expected_tag.lower() == 'image':
                                pass
                            else:
                                data[key] = (value[0] if len(value) > 0 and isinstance(value[0], str) else '')
                        # If scalar provided but expected list (Image sometimes), wrap
                        if expected_tag.lower() == 'image' and isinstance(data[key], str):
                            # Image tag accepts str or list; keep str as-is
                            pass
                    task['data'] = data
                except Exception as _:
                    # Best-effort normalization; ignore if anything goes wrong
                    pass

            new_data_fields = set(iter(new_tasks[0]['data'].keys())) if len(new_tasks) > 0 else set()
            if not common_data_fields:
                common_data_fields = new_data_fields
            elif not common_data_fields.intersection(new_data_fields):
                raise ValidationError(
                    _old_vs_new_data_keys_inconsistency_message(
                        new_data_fields, common_data_fields, file_upload.file.name
                    )
                )
            else:
                common_data_fields &= new_data_fields

            tasks += new_tasks
            fileformats.append(file_format)

            if trim_size is not None:
                if len(tasks) > trim_size:
                    break

        return tasks, dict(Counter(fileformats)), common_data_fields


def _old_vs_new_data_keys_inconsistency_message(new_data_keys, old_data_keys, current_file):
    new_data_keys_list = ','.join(new_data_keys)
    old_data_keys_list = ','.join(old_data_keys)
    common_prefix = "You're trying to import inconsistent data:\n"
    if new_data_keys_list == old_data_keys_list:
        return ''
    elif new_data_keys_list == settings.DATA_UNDEFINED_NAME:
        return (
            common_prefix + 'uploading a single file {0} '
            'clashes with data key(s) found from other files:\n"{1}"'.format(current_file, old_data_keys_list)
        )
    elif old_data_keys_list == settings.DATA_UNDEFINED_NAME:
        return (
            common_prefix + 'uploading tabular data from {0} with data key(s) {1}, '
            'clashes with other raw binary files (images, audios, etc.)'.format(current_file, new_data_keys_list)
        )
    else:
        return (
            common_prefix + 'uploading tabular data from "{0}" with data key(s) "{1}", '
            'clashes with data key(s) found from other files:\n"{2}"'.format(
                current_file, new_data_keys_list, old_data_keys_list
            )
        )
