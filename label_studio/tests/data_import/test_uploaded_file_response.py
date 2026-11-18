from unittest.mock import Mock

import pytest
from data_import.api import UploadedFileResponse
from data_import.models import FileUpload
from django.conf import settings
from organizations.models import Organization
from rest_framework import status
from rest_framework.test import APIRequestFactory
from users.models import User

"""
Regression tests for UploadedFileResponse API (local media serving endpoint).

Regression context (OpenCSGs/label-studio#58): migrated projects may have media
files on disk under upload/<project_id>/ without a matching FileUpload record in
data_import_fileupload. The endpoint used to call has_permission() on the None
query result, raising AttributeError and returning 500. The fix returns 404
when no record exists, 403 when the record exists but the user lacks project
permission.

Test coverage:
- No FileUpload record (mocked query) -> 404, has_permission never called
- No FileUpload record (real database, nothing registered) -> 404
- FileUpload record without permission -> 403
- FileUpload query uses the 'upload/<filename>' path format
"""

pytestmark = pytest.mark.django_db


class TestUploadedFileResponse:
    @pytest.fixture
    def api_factory(self):
        return APIRequestFactory()

    @pytest.fixture
    def user(self):
        """Create a test user with organization"""
        org = Organization.objects.create(title='Test Org')
        user = User.objects.create_user(email='test@example.com', password='test123')
        user.active_organization = org
        user.save()
        return user

    @pytest.fixture
    def view(self):
        return UploadedFileResponse()

    @pytest.fixture
    def mock_filter(self, monkeypatch):
        """Patch FileUpload.objects.filter and let tests configure the result"""
        state = {'result': None, 'file': None}

        def fake_filter(file=None, **kwargs):
            state['file'] = file
            return Mock(last=Mock(return_value=state['result']))

        monkeypatch.setattr('data_import.api.FileUpload.objects.filter', fake_filter)
        return state

    def _get(self, view, api_factory, user, filename='test.pdf'):
        request = api_factory.get(f'/data/upload/{filename}')
        request.user = user
        # UploadedFileResponse.get() reads self.request (normally set by the
        # DRF dispatcher); set it manually for a direct view call.
        view.request = request
        return view.get(filename=filename)

    @pytest.mark.parametrize(
        'file_name',
        ['test.pdf', '1/abc12345-image.png'],
    )
    def test_no_fileupload_record_returns_404(self, api_factory, user, view, file_name):
        """Regression: missing FileUpload record must return 404, not raise AttributeError (500)"""
        response = self._get(view, api_factory, user, filename=file_name)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.parametrize(
        'file_name',
        ['test.pdf', '1/abc12345-image.png'],
    )
    def test_no_permission_returns_403(self, api_factory, user, view, mock_filter, file_name):
        """FileUpload record exists but user lacks project permission -> 403"""
        file_upload = Mock(spec=FileUpload)
        file_upload.has_permission.return_value = False
        mock_filter['result'] = file_upload

        response = self._get(view, api_factory, user, filename=file_name)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        file_upload.has_permission.assert_called_once_with(user)

    def test_has_permission_not_called_without_record(self, api_factory, user, view, mock_filter):
        """Permission must not be checked when no FileUpload record exists"""
        file_upload = Mock(spec=FileUpload)
        mock_filter['result'] = None

        response = self._get(view, api_factory, user)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        file_upload.has_permission.assert_not_called()

    def test_upload_path_matches_fileupload_file_format(self, api_factory, user, view, mock_filter):
        """The endpoint must query FileUpload with 'upload/<filename>' exactly"""
        response = self._get(view, api_factory, user, filename='42/abc-img.png')

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert mock_filter['file'] == f'{settings.UPLOAD_DIR}/42/abc-img.png'
