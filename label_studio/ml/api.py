"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging

import requests

from core.feature_flags import flag_set
from core.permissions import ViewClassPermission, all_permissions
from django.conf import settings
from django.utils.decorators import method_decorator
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from ml.models import MLBackend
from ml.serializers import MLBackendSerializer, MLInteractiveAnnotatingRequest
from projects.models import Project, Task
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class MagicWandMLAPI(APIView):
    """Wait for the configured ML service before the browser renders a Magic Wand mask."""

    parser_classes = (JSONParser,)
    permission_required = ViewClassPermission(POST=all_permissions.projects_view)

    def post(self, request):
        if not settings.MAGIC_WAND_ML_ENABLED:
            return Response(
                {
                    'enabled': False,
                    'acknowledged': True,
                    'code': 'magic_wand_model_not_configured',
                    'detail': 'Magic Wand annotation model is not configured.',
                }
            )

        project_id = request.data.get('project')
        task_id = request.data.get('task')
        if not project_id:
            return Response(
                {'code': 'magic_wand_project_required', 'detail': 'Project is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = generics.get_object_or_404(Project, pk=project_id)
        self.check_object_permissions(request, project)
        if task_id:
            task = generics.get_object_or_404(Task, pk=task_id, project=project)
            task_payload = {'id': task.id, 'data': task.data}
        else:
            task_payload = {'id': None, 'data': request.data.get('task_data') or {}}

        service_url = settings.MAGIC_WAND_ML_URL
        if not service_url:
            return Response(
                {
                    'code': 'magic_wand_service_not_configured',
                    'detail': 'MAGIC_WAND_ML_URL is not configured.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = {
            'tasks': [task_payload],
            'project': f'{project.id}.{int(project.created_at.timestamp())}',
            'label_config': project.label_config,
            'params': {
                'context': {
                    'magic_wand': {
                        'x': request.data.get('x'),
                        'y': request.data.get('y'),
                        'image_name': request.data.get('image_name'),
                    }
                }
            },
        }

        try:
            ml_response = requests.post(
                service_url,
                json=payload,
                timeout=settings.MAGIC_WAND_ML_TIMEOUT,
            )
            ml_response.raise_for_status()
            # Return the ML payload for observability, while the editor treats
            # it only as a synchronization signal and never renders it.
            ml_result = ml_response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning('Magic Wand ML request failed: %s', exc)
            return Response(
                {
                    'code': 'magic_wand_service_failed',
                    'detail': 'Magic Wand ML service request failed.',
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'enabled': True, 'acknowledged': True, 'ml_result': ml_result})

_ml_backend_schema = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string',
            'description': 'ML backend URL',
        },
        'project': {
            'type': 'integer',
            'description': 'Project ID',
        },
        'is_interactive': {
            'type': 'boolean',
            'description': 'Is interactive',
        },
        'title': {
            'type': 'string',
            'description': 'Title',
        },
        'description': {
            'type': 'string',
            'description': 'Description',
        },
        'auth_method': {
            'type': 'string',
            'description': 'Auth method',
            'enum': ['NONE', 'BASIC_AUTH'],
        },
        'basic_auth_user': {
            'type': 'string',
            'description': 'Basic auth user',
        },
        'basic_auth_pass': {
            'type': 'string',
            'description': 'Basic auth password',
        },
        'extra_params': {
            'type': 'object',
            'description': 'Extra parameters',
        },
        'timeout': {
            'type': 'integer',
            'description': 'Response model timeout',
        },
    },
    'required': [],
}


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Add ML Backend',
        description="""
    Add an ML backend to a project using the Label Studio UI or by sending a POST request using the following cURL 
    command:
    ```bash
    curl -X POST -H 'Content-type: application/json' {host}/api/ml -H 'Authorization: Token abc123'\\
    --data '{{"url": "http://localhost:9090", "project": {{project_id}}}}' 
    """.format(
            host=(settings.HOSTNAME or 'https://localhost:8080')
        ),
        request={
            'application/json': _ml_backend_schema,
        },
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'create',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='List ML backends',
        description="""
    List all configured ML backends for a specific project by ID.
    Use the following cURL command:
    ```bash
    curl {host}/api/ml?project={{project_id}} -H 'Authorization: Token abc123'
    """.format(
            host=(settings.HOSTNAME or 'https://localhost:8080')
        ),
        parameters=[
            OpenApiParameter(name='project', type=OpenApiTypes.INT, location='query', description='Project ID'),
        ],
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'list',
            'x-fern-audiences': ['public'],
        },
    ),
)
class MLBackendListAPI(generics.ListCreateAPIView):
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    permission_required = ViewClassPermission(
        GET=all_permissions.projects_view,
        POST=all_permissions.projects_change,
    )
    serializer_class = MLBackendSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_interactive']

    def get_queryset(self):
        project_pk = self.request.query_params.get('project')
        project = generics.get_object_or_404(Project, pk=project_pk)

        self.check_object_permissions(self.request, project)

        ml_backends = project.update_ml_backends_state()

        return ml_backends

    def perform_create(self, serializer):
        ml_backend = serializer.save()
        ml_backend.update_state()

        project = ml_backend.project

        # In case we are adding the model, let's set it as the default
        # to obtain predictions. This approach is consistent with uploading
        # offline predictions, which would be set automatically.
        if project.show_collab_predictions and not project.model_version:
            project.model_version = ml_backend.title
            project.save(update_fields=['model_version'])


@method_decorator(
    name='patch',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Update ML Backend',
        description="""
    Update ML backend parameters using the Label Studio UI or by sending a PATCH request using the following cURL command:
    ```bash
    curl -X PATCH -H 'Content-type: application/json' {host}/api/ml/{{ml_backend_ID}} -H 'Authorization: Token abc123'\\
    --data '{{"url": "http://localhost:9091"}}' 
    """.format(
            host=(settings.HOSTNAME or 'https://localhost:8080')
        ),
        request={
            'application/json': _ml_backend_schema,
        },
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'update',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Get ML Backend',
        description="""
    Get details about a specific ML backend connection by ID. For example, make a GET request using the
    following cURL command:
    ```bash
    curl {host}/api/ml/{{ml_backend_ID}} -H 'Authorization: Token abc123'
    """.format(
            host=(settings.HOSTNAME or 'https://localhost:8080')
        ),
        request=None,
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'get',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='delete',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Remove ML Backend',
        description="""
    Remove an existing ML backend connection by ID. For example, use the
    following cURL command:
    ```bash
    curl -X DELETE {host}/api/ml/{{ml_backend_ID}} -H 'Authorization: Token abc123'
    """.format(
            host=(settings.HOSTNAME or 'https://localhost:8080')
        ),
        request=None,
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'delete',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(name='put', decorator=extend_schema(exclude=True))
class MLBackendDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    serializer_class = MLBackendSerializer
    permission_required = all_permissions.projects_change
    queryset = MLBackend.objects.all()

    def get_object(self):
        ml_backend = super(MLBackendDetailAPI, self).get_object()
        ml_backend.update_state()
        return ml_backend

    def perform_update(self, serializer):
        ml_backend = serializer.save()
        ml_backend.update_state()


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Train',
        description="""
        After you add an ML backend, call this API with the ML backend ID to start training with 
        already-labeled tasks. 
        
        Get the ML backend ID by [listing the ML backends for a project](https://labelstud.io/api/#operation/api_ml_list).
        """,
        parameters=[
            OpenApiParameter(
                name='id',
                type=OpenApiTypes.INT,
                location='path',
                description='A unique integer value identifying this ML backend.',
            ),
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'use_ground_truth': {
                        'type': 'boolean',
                        'description': 'Whether to include ground truth annotations in training',
                    },
                },
            },
        },
        responses={
            200: OpenApiResponse(description='Training has successfully started.'),
            500: OpenApiResponse(
                description='Training error',
                response={
                    'description': 'Error message',
                    'type': 'string',
                    'example': 'Server responded with an error.',
                },
            ),
        },
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'train',
            'x-fern-audiences': ['public'],
        },
    ),
)
class MLBackendTrainAPI(APIView):

    permission_required = all_permissions.projects_change

    def post(self, request, *args, **kwargs):
        ml_backend = generics.get_object_or_404(MLBackend, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, ml_backend)

        ml_backend.train()
        return Response(status=status.HTTP_200_OK)


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Test prediction',
        description="""
        After you add an ML backend, call this API with the ML backend ID to run a test prediction on specific task data               
        """,
        parameters=[
            OpenApiParameter(
                name='id',
                type=OpenApiTypes.INT,
                location='path',
                description='A unique integer value identifying this ML backend.',
            ),
        ],
        responses={
            200: OpenApiResponse(description='Predicting has successfully started.'),
            500: OpenApiResponse(
                description='Predicting error',
                response={
                    'description': 'Error message',
                    'type': 'string',
                    'example': 'Server responded with an error.',
                },
            ),
        },
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'test_predict',
            'x-fern-audiences': ['internal'],
        },
    ),
)
class MLBackendPredictTestAPI(APIView):
    serializer_class = MLBackendSerializer
    permission_required = all_permissions.projects_change

    def post(self, request, *args, **kwargs):
        ml_backend = generics.get_object_or_404(MLBackend, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, ml_backend)

        random = request.query_params.get('random', False)
        if random:
            task = Task.get_random(project=ml_backend.project)
            if not task:
                return Response(
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    data={
                        'detail': 'Project has no tasks to run prediction on, import at least 1 task to run prediction'
                    },
                )

            kwargs = ml_backend._predict(task)
            if not kwargs:
                return Response(
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    data={
                        'detail': 'ML backend did not return any predictions, check ML backend logs for more details'
                    },
                )
            return Response(**kwargs)

        else:
            return Response(
                status=status.HTTP_501_NOT_IMPLEMENTED,
                data={'error': 'Not implemented - you must provide random=true query parameter'},
            )


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Request Interactive Annotation',
        description="""
        Send a request to the machine learning backend set up to be used for interactive preannotations to retrieve a
        predicted region based on annotator input. 
        See [set up machine learning](https://labelstud.io/guide/ml.html#Get-interactive-preannotations) for more.
        """,
        parameters=[
            OpenApiParameter(
                name='id',
                type=OpenApiTypes.INT,
                location='path',
                description='A unique integer value identifying this ML backend.',
            ),
        ],
        request=MLInteractiveAnnotatingRequest,
        responses={
            200: OpenApiResponse(description='Interactive annotation has succeeded.'),
        },
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'predict_interactive',
            'x-fern-audiences': ['public'],
        },
    ),
)
class MLBackendInteractiveAnnotating(APIView):
    """
    Send a request to the machine learning backend set up to be used for interactive preannotations to retrieve a
    predicted region based on annotator input.
    """

    permission_required = all_permissions.tasks_view

    def _error_response(self, message, log_function=logger.info):
        log_function(message)
        return Response({'errors': [message]}, status=status.HTTP_200_OK)

    def _get_task(self, ml_backend, validated_data):
        return generics.get_object_or_404(Task, pk=validated_data['task'], project=ml_backend.project)

    def _get_credentials(self, request, context, project):
        if flag_set('ff_back_dev_2362_project_credentials_060722_short', request.user):
            context.update(
                project_credentials_login=project.task_data_login,
                project_credentials_password=project.task_data_password,
            )
        return context

    def post(self, request, *args, **kwargs):
        """
        Send a request to the machine learning backend set up to be used for interactive preannotations to retrieve a
        predicted region based on annotator input.
        """
        ml_backend = generics.get_object_or_404(MLBackend, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, ml_backend)
        serializer = MLInteractiveAnnotatingRequest(data=request.data)
        serializer.is_valid(raise_exception=True)

        task = self._get_task(ml_backend, serializer.validated_data)
        context = self._get_credentials(request, serializer.validated_data.get('context', {}), task.project)

        result = ml_backend.interactive_annotating(task, context, user=request.user)

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Machine Learning'],
        summary='Get model versions',
        description='Get available versions of the model.',
        responses={
            200: OpenApiResponse(
                description='List of available versions.',
                response={
                    'type': 'object',
                    'properties': {
                        'versions': {
                            'type': 'array',
                            'items': {
                                'type': 'string',
                            },
                        },
                        'message': {
                            'type': 'string',
                        },
                    },
                },
            ),
        },
        extensions={
            'x-fern-sdk-group-name': 'ml',
            'x-fern-sdk-method-name': 'list_model_versions',
            'x-fern-audiences': ['public'],
        },
    ),
)
class MLBackendVersionsAPI(generics.RetrieveAPIView):
    # TODO(jo): implement this view with a serializer and replace the handwritten schema above with it
    permission_required = all_permissions.projects_change

    def get(self, request, *args, **kwargs):
        ml_backend = generics.get_object_or_404(MLBackend, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, ml_backend)
        versions_response = ml_backend.get_versions()
        if versions_response.status_code == 200:
            result = {'versions': versions_response.response.get('versions', [])}
            return Response(data=result, status=200)
        elif versions_response.status_code == 404:
            result = {'versions': [ml_backend.model_version], 'message': 'Upgrade your ML backend version to latest.'}
            return Response(data=result, status=200)
        else:
            result = {'error': str(versions_response.error_message)}
            status_code = versions_response.status_code if versions_response.status_code > 0 else 500
            return Response(data=result, status=status_code)
