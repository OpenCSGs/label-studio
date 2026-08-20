import json

import pytest
import requests_mock


@pytest.mark.django_db
def test_magic_wand_waits_for_ml_and_discards_prediction(business_client, configured_project, settings):
    task = configured_project.tasks.first()
    settings.MAGIC_WAND_ML_ENABLED = True
    settings.MAGIC_WAND_ML_URL = 'http://sam-mock:9091/predict'
    settings.MAGIC_WAND_ML_TIMEOUT = 12
    random_prediction = {
        'results': [{'result': [{'type': 'rectanglelabels', 'value': {'x': 42}}]}],
        'model_version': 'sam-mock-random-v1',
    }

    with requests_mock.Mocker() as mocker:
        mocker.post(settings.MAGIC_WAND_ML_URL, json=random_prediction)
        response = business_client.post(
            '/api/ml/magic-wand',
            data=json.dumps(
                {
                    'project': configured_project.id,
                    'task': task.id,
                    'image_name': 'image',
                    'x': 12,
                    'y': 34,
                }
            ),
            content_type='application/json',
        )

    assert response.status_code == 200
    assert response.json() == {
        'enabled': True,
        'acknowledged': True,
        'ml_result': random_prediction,
    }
    sent = mocker.last_request.json()
    assert sent['tasks'] == [{'id': task.id, 'data': task.data}]
    assert sent['params']['context']['magic_wand'] == {'x': 12, 'y': 34, 'image_name': 'image'}


@pytest.mark.django_db
def test_magic_wand_skips_ml_when_disabled(business_client, settings):
    settings.MAGIC_WAND_ML_ENABLED = False
    response = business_client.post('/api/ml/magic-wand', data='{}', content_type='application/json')

    assert response.status_code == 200
    assert response.json() == {
        'enabled': False,
        'acknowledged': True,
        'code': 'magic_wand_model_not_configured',
        'detail': 'Magic Wand annotation model is not configured.',
    }


@pytest.mark.django_db
def test_magic_wand_uses_client_task_data_when_task_id_is_missing(business_client, configured_project, settings):
    settings.MAGIC_WAND_ML_ENABLED = True
    settings.MAGIC_WAND_ML_URL = 'http://sam-mock:9091/predict'

    with requests_mock.Mocker() as mocker:
        mocker.post(settings.MAGIC_WAND_ML_URL, json={'results': []})
        response = business_client.post(
            '/api/ml/magic-wand',
            data=json.dumps(
                {
                    'project': configured_project.id,
                    'task_data': {'image': '/data/upload/example.png'},
                    'x': 12,
                    'y': 34,
                }
            ),
            content_type='application/json',
        )

    assert response.status_code == 200
    assert mocker.last_request.json()['tasks'] == [
        {'id': None, 'data': {'image': '/data/upload/example.png'}}
    ]
