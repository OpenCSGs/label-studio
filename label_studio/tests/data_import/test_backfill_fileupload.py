import os

import pytest
from data_import.models import FileUpload
from django.core.management import call_command
from django.test import override_settings
from io import StringIO
from organizations.models import Organization
from projects.models import Project
from users.models import User

"""
Tests for the backfill_fileupload management command.

The command creates missing FileUpload records for media files that exist on
disk under MEDIA_ROOT/upload/<project_id>/ but have no row in
data_import_fileupload (the migration scenario described in
OpenCSGs/label-studio#58).

Test coverage:
- Backfill creates records with the correct relative path and owner
- --dry-run only reports, never writes
- Idempotency: a second run creates nothing new
- Directories without a matching Project are skipped with a warning
- Non-numeric directories are ignored
"""

pytestmark = pytest.mark.django_db


def _call(**options):
    out = StringIO()
    call_command('backfill_fileupload', stdout=out, **options)
    return out.getvalue()


class TestBackfillFileupload:
    @pytest.fixture
    def user(self):
        org = Organization.objects.create(title='Test Org')
        user = User.objects.create_user(email='test@example.com', password='test123')
        user.active_organization = org
        user.save()
        return user

    @pytest.fixture
    def project(self, user):
        return Project.objects.create(title='Test Project', created_by=user)

    @pytest.fixture
    def media_root(self, tmp_path, project):
        """Create on-disk media layout: MEDIA_ROOT/upload/<project_id>/<file>"""
        project_dir = tmp_path / 'upload' / str(project.id)
        project_dir.mkdir(parents=True)
        (project_dir / 'abc12345-image.png').write_bytes(b'fake image')
        (project_dir / 'def67890-audio.mp3').write_bytes(b'fake audio')
        return tmp_path

    def test_backfill_creates_missing_records(self, media_root, project, user):
        with override_settings(MEDIA_ROOT=str(media_root)):
            output = _call()

        records = FileUpload.objects.filter(project=project)
        assert records.count() == 2
        paths = set(records.values_list('file', flat=True))
        assert paths == {
            f'upload/{project.id}/abc12345-image.png',
            f'upload/{project.id}/def67890-audio.mp3',
        }
        assert set(records.values_list('user', flat=True)) == {user.id}
        assert 'Created 2 FileUpload record(s)' in output

    def test_dry_run_creates_nothing(self, media_root, project):
        with override_settings(MEDIA_ROOT=str(media_root)):
            output = _call(dry_run=True)

        assert FileUpload.objects.count() == 0
        assert 'would create' in output
        assert 'Would create 2 FileUpload record(s)' in output

    def test_idempotent_second_run_creates_nothing(self, media_root, project):
        with override_settings(MEDIA_ROOT=str(media_root)):
            _call()
            assert FileUpload.objects.count() == 2

            output = _call()
            # Still exactly 2 records, nothing duplicated
            assert FileUpload.objects.count() == 2
            assert 'Created 0 FileUpload record(s)' in output

    def test_skips_directories_without_project(self, media_root, project):
        """Directory of a deleted project (no Project row) is skipped with a warning"""
        orphan_dir = media_root / 'upload' / '999'
        orphan_dir.mkdir()
        (orphan_dir / 'orphan.png').write_bytes(b'orphan')

        with override_settings(MEDIA_ROOT=str(media_root)):
            output = _call()

        assert FileUpload.objects.filter(project=project).count() == 2
        assert not FileUpload.objects.filter(project_id=999).exists()
        assert 'No Project record found' in output
        assert 'projects missing from DB: 1' in output

    def test_ignores_non_numeric_directories(self, media_root, project):
        junk_dir = media_root / 'upload' / 'not-a-project'
        junk_dir.mkdir()
        (junk_dir / 'junk.png').write_bytes(b'junk')

        with override_settings(MEDIA_ROOT=str(media_root)):
            output = _call()

        assert FileUpload.objects.count() == 2
        assert 'junk' not in output

    def test_skips_files_that_already_have_records(self, media_root, project, user):
        """A pre-existing (partial) registration is not duplicated"""
        FileUpload.objects.create(user=user, project=project, file=f'upload/{project.id}/abc12345-image.png')

        with override_settings(MEDIA_ROOT=str(media_root)):
            output = _call()

        assert FileUpload.objects.count() == 2
        assert 'already registered: 1' in output
        assert 'Created 1 FileUpload record(s)' in output

    def test_project_option_limits_scope(self, tmp_path, user):
        """--project only processes the given project directory"""
        project = Project.objects.create(title='Scoped Project', created_by=user)
        other_project = Project.objects.create(title='Other Project', created_by=user)

        for p in (project, other_project):
            d = tmp_path / 'upload' / str(p.id)
            d.mkdir(parents=True)
            (d / 'file.png').write_bytes(b'data')

        with override_settings(MEDIA_ROOT=str(tmp_path)):
            _call(project=project.id)

        assert FileUpload.objects.filter(project=project).count() == 1
        assert not FileUpload.objects.filter(project=other_project).exists()
