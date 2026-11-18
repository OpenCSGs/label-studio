"""
Backfill FileUpload records for media files that exist on disk under
MEDIA_ROOT/upload/<project_id>/ but have no corresponding row in
data_import_fileupload.

This happens when projects are migrated/upgraded by copying the media
directory without re-registering the files (see OpenCSGs/label-studio#58).
Missing records made the media endpoint return 500 (now 404 after the
None-check fix) and block permission checks for migrated files.

Usage:
    # Preview what would be created (no writes)
    python label_studio/manage.py backfill_fileupload --dry-run

    # Create missing records
    python label_studio/manage.py backfill_fileupload

    # Only process one project
    python label_studio/manage.py backfill_fileupload --project 42
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from data_import.models import FileUpload
from projects.models import Project


class Command(BaseCommand):
    help = (
        'Create missing FileUpload records for files on disk under '
        'MEDIA_ROOT/upload/<project_id>/ so migrated media files can pass '
        'permission checks again.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only report what would be created, without writing to the database.',
        )
        parser.add_argument(
            '--project',
            type=int,
            default=None,
            help='Only backfill files of this project id.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        project_id_filter = options['project']

        upload_root = os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR)
        if not os.path.isdir(upload_root):
            raise CommandError(f'Upload directory does not exist: {upload_root}')

        created = 0
        skipped_exists = 0
        skipped_no_project = 0
        skipped_no_owner = 0
        total_files = 0

        # Directory layout on disk: MEDIA_ROOT/upload/<project_id>/<file>,
        # matching upload_name_generator() in data_import/models.py.
        # FileUpload.file stores the path relative to MEDIA_ROOT,
        # e.g. 'upload/<project_id>/<uuid8>-<filename>'.
        for entry in sorted(os.listdir(upload_root)):
            project_dir = os.path.join(upload_root, entry)
            if not os.path.isdir(project_dir) or not entry.isdigit():
                continue

            project_id = int(entry)
            if project_id_filter is not None and project_id != project_id_filter:
                continue

            project = Project.objects.filter(id=project_id).first()
            if project is None:
                self.stdout.write(
                    self.style.WARNING(
                        f'[{project_id}] No Project record found, skipping '
                        f'{project_dir}'
                    )
                )
                skipped_no_project += 1
                continue

            # The record owner only matters for audit/history here: access
            # is checked via project.has_permission(), not the record's user.
            owner = project.created_by
            if owner is None:
                self.stdout.write(
                    self.style.WARNING(
                        f'[{project_id}] Project has no created_by user, '
                        f'cannot attribute FileUpload records'
                    )
                )
                skipped_no_owner += 1
                continue

            for dirpath, _dirnames, filenames in os.walk(project_dir):
                for filename in sorted(filenames):
                    total_files += 1
                    relative = os.path.relpath(
                        os.path.join(dirpath, filename), settings.MEDIA_ROOT
                    )
                    # FileUpload.file is stored with POSIX-style separators.
                    file_path = relative.replace(os.sep, '/')

                    if FileUpload.objects.filter(file=file_path).exists():
                        skipped_exists += 1
                        continue

                    if dry_run:
                        self.stdout.write(f'[dry-run] would create: {file_path}')
                    else:
                        FileUpload.objects.create(
                            user=owner, project=project, file=file_path
                        )
                    created += 1

        action = 'Would create' if dry_run else 'Created'
        self.stdout.write(
            self.style.SUCCESS(
                f'{action} {created} FileUpload record(s). '
                f'Total files scanned: {total_files}, '
                f'already registered: {skipped_exists}, '
                f'projects missing from DB: {skipped_no_project}, '
                f'projects without owner: {skipped_no_owner}'
            )
        )
