import pytest
from core.label_config import extract_data_types
from data_import.models import FileUpload
from django.conf import settings
from django.core.files.base import ContentFile
from organizations.tests.factories import OrganizationFactory
from projects.tests.factories import ProjectFactory
from tasks.validation import TaskValidator
from users.tests.factories import UserFactory


pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def organization():
    return OrganizationFactory()


def create_project(user, organization, label_config):
    return ProjectFactory(created_by=user, organization=organization, label_config=label_config)


def create_upload(user, project, name):
    return FileUpload.objects.create(user=user, project=project, file=ContentFile(b'image-bytes', name=name))


def test_extract_data_types_includes_value_list():
    config = '<View><Image name="document" valueList="$pages"/></View>'

    assert extract_data_types(config) == {'pages': 'Image'}


def test_scalar_image_uses_configured_variable_name(user, organization):
    project = create_project(
        user,
        organization,
        '<View><Image name="source" value="$photo"/></View>',
    )
    upload = create_upload(user, project, 'page.png')

    tasks, formats, data_fields = FileUpload.load_tasks_from_uploaded_files(project, [upload.id])

    assert len(tasks) == 1
    assert set(tasks[0]['data']) == {'photo'}
    assert tasks[0]['data']['photo'].endswith('page.png')
    assert tasks[0]['file_upload_id'] == upload.id
    assert formats == {'.png': 1}
    assert data_fields == {'photo'}
    assert TaskValidator.check_data(project, tasks[0]['data']) == tasks[0]['data']


def test_upload_without_config_keeps_official_undefined_field(user, organization):
    # Draft projects still have a syntactically valid placeholder config, but
    # it may not define a data field yet.
    project = create_project(user, organization, '<View></View>')
    upload = create_upload(user, project, 'page.png')

    tasks, _, data_fields = FileUpload.load_tasks_from_uploaded_files(project, [upload.id])

    assert len(tasks) == 1
    assert set(tasks[0]['data']) == {settings.DATA_UNDEFINED_NAME}
    assert data_fields == {settings.DATA_UNDEFINED_NAME}


def test_value_list_groups_one_upload_batch_into_one_ordered_task(user, organization):
    project = create_project(
        user,
        organization,
        '<View><Image name="document" valueList="$pages"/></View>',
    )
    first = create_upload(user, project, '001.png')
    second = create_upload(user, project, '002.jpg')

    tasks, formats, data_fields = FileUpload.load_tasks_from_uploaded_files(
        project,
        [first.id, second.id],
    )

    assert len(tasks) == 1
    assert list(tasks[0]['data']) == ['pages']
    assert [value.rsplit('/', 1)[-1] for value in tasks[0]['data']['pages']] == [
        first.file.name.rsplit('/', 1)[-1],
        second.file.name.rsplit('/', 1)[-1],
    ]
    assert tasks[0]['file_upload_id'] == first.id
    assert formats == {'.png': 1, '.jpg': 1}
    assert data_fields == {'pages'}
    assert TaskValidator.check_data(project, tasks[0]['data']) == tasks[0]['data']


def test_value_list_only_groups_requested_upload_batch(user, organization):
    project = create_project(
        user,
        organization,
        '<View><Image name="document" valueList="$documents"/></View>',
    )
    old_upload = create_upload(user, project, 'old.png')
    new_upload = create_upload(user, project, 'new.png')

    tasks, _, _ = FileUpload.load_tasks_from_uploaded_files(project, [new_upload.id])

    assert len(tasks) == 1
    assert len(tasks[0]['data']['documents']) == 1
    assert tasks[0]['data']['documents'][0].endswith('new.png')
    assert old_upload.file.name not in tasks[0]['data']['documents'][0]


def test_value_list_streaming_uses_same_grouping(user, organization):
    project = create_project(
        user,
        organization,
        '<View><Image name="document" valueList="$pages"/></View>',
    )
    first = create_upload(user, project, '001.png')
    second = create_upload(user, project, '002.png')

    batches = list(
        FileUpload.load_tasks_from_uploaded_files_streaming(
            project,
            [first.id, second.id],
            batch_size=1,
        )
    )

    assert len(batches) == 1
    tasks, formats, data_fields = batches[0]
    assert len(tasks) == 1
    assert len(tasks[0]['data']['pages']) == 2
    assert formats == {'.png': 2}
    assert data_fields == {'pages'}
