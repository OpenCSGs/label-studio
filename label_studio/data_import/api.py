"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import json
import logging
import mimetypes
import time
from urllib.parse import unquote, urlparse

import os
import requests
from core.decorators import override_report_only_csp
from core.feature_flags import flag_set
from core.permissions import ViewClassPermission, all_permissions
from core.redis import start_job_async_or_sync
from core.utils.common import retry_database_locked, timeit
from core.utils.params import bool_from_request, list_of_strings_from_request
from csp.decorators import csp
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from projects.models import Project, ProjectImport, ProjectReimport
from ranged_fileresponse import RangedFileResponse
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView
from tasks.functions import update_tasks_counters
from tasks.models import Prediction, Task
from users.models import User
from webhooks.models import WebhookAction
from webhooks.utils import emit_webhooks_for_instance

from label_studio.core.utils.common import load_func
from rest_framework.decorators import permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .functions import (
    async_import_background,
    async_reimport_background,
    reformat_predictions,
    set_import_background_failure,
    set_reimport_background_failure,
)
from .models import FileUpload
from .serializers import FileUploadSerializer, ImportApiSerializer, PredictionSerializer
from .uploader import create_file_uploads, load_tasks

logger = logging.getLogger(__name__)

ProjectImportPermission = load_func(settings.PROJECT_IMPORT_PERMISSION)

task_create_response_scheme = {
    201: OpenApiResponse(
        description='Tasks successfully imported',
        response={
            'title': 'Task creation response',
            'description': 'Task creation response',
            'type': 'object',
            'properties': {
                'task_count': {
                    'title': 'task_count',
                    'description': 'Number of tasks added',
                    'type': 'integer',
                },
                'annotation_count': {
                    'title': 'annotation_count',
                    'description': 'Number of annotations added',
                    'type': 'integer',
                },
                'predictions_count': {
                    'title': 'predictions_count',
                    'description': 'Number of predictions added',
                    'type': 'integer',
                },
                'duration': {
                    'title': 'duration',
                    'description': 'Time in seconds to create',
                    'type': 'number',
                },
                'file_upload_ids': {
                    'title': 'file_upload_ids',
                    'description': 'Database IDs of uploaded files',
                    'type': 'array',
                    'items': {
                        'title': 'File Upload IDs',
                        'type': 'integer',
                    },
                },
                'could_be_tasks_list': {
                    'title': 'could_be_tasks_list',
                    'description': 'Whether uploaded files can contain lists of tasks, like CSV/TSV files',
                    'type': 'boolean',
                },
                'found_formats': {
                    'title': 'found_formats',
                    'description': 'The list of found file formats',
                    'type': 'array',
                    'items': {
                        'title': 'File format',
                        'type': 'string',
                    },
                },
                'data_columns': {
                    'title': 'data_columns',
                    'description': 'The list of found data columns',
                    'type': 'array',
                    'items': {
                        'title': 'Data column name',
                        'type': 'string',
                    },
                },
            },
        },
    ),
    400: OpenApiResponse(
        description='Bad Request',
        response={
            'title': 'Incorrect task data',
            'description': 'String with error description',
            'type': 'string',
        },
    ),
}

# from label_studio.users.user_t_data import get_data, set_data, delete_data, list_all_accounts


# # 获取数据
# user_info = get_data("z275748353")
# print(user_info)
#
# # 设置数据
# set_data("new_user", {"token": "new_token123"})
#
# # 删除数据
# delete_data("old_user")
#
# # 列出所有账号
# all_accounts = list_all_accounts()
# print(all_accounts)

@permission_classes([IsAuthenticated])  # 仅允许已登录用户访问
class PublicListAPI(APIView):
    # 获取用户数据

    print(100*'*')
    def get(self, request):
        user_token1 = request.user.user_token
        authorization = request.user.authorization
        user_name = request.user.user_name


        # 从当前登录用户对象中获取用户名（自动获取，无需前端传参）
        # user_name = str(request.user).split('@')[0]
        # user_name = str(request.user).split('@')[0]

        # print(user_data)
        # print(user_data['authorization'])
        if not user_name:
            return Response(
                {"error": "当前用户未设置用户名"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # # 获取用户数据
        # user_data = get_data(user_name)
        # print(user_name)
        # print(user_data['authorization'])
        if user_name is None:
            return Response(
                {"error": f"用户 '{user_name}' 的数据不存在"},
                status=status.HTTP_404_NOT_FOUND
            )


        # print(user_name)
        # print(user_data['authorization'])
        # 调用外部API（使用当前用户的authorization）
        # os.environ['CSGHUB_ENDPOINT']
        url = f"{os.environ['CSGHUB_ENDPOINT']}/api/v1/user/{user_name}/datasets?per=50&page=1"
        headers = {
            "Authorization": authorization
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()  # 处理HTTP错误状态码
            list=[]

            data = response.json()
            # print(data)
            for i in data['data']:
                list.append(i['path'])
            return Response(list)
            # return Response(
            #     {"error": "当前用户未设置用户名"},
            #     status=status.HTTP_400_BAD_REQUEST
            # )
        except requests.exceptions.RequestException as e:
            return Response(
                {"error": f"调用外部API失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



@permission_classes([IsAuthenticated])
class DatasetBranchesAPI(APIView):
    def get(self, request):
        user_token1 = request.user.user_token
        authorization = request.user.authorization
        user_name = request.user.user_name
        # base_url = "http://net-power.9free.com.cn:18120"

        repo_id = request.query_params.get('repo_id')

        endpoint = f"/api/v1/datasets/{repo_id}/branches"
        url = f"{os.environ['CSGHUB_ENDPOINT']}{endpoint}"

        headers = {
            "Authorization": authorization
        }
        # 发送GET请求
        response = requests.get(url, headers=headers)
        # 解析JSON响应
        branches_data = response.json()
        # print(branches_data,100*'-')
        list = []
        for i in branches_data['data']:
            list.append(i['name'])

        #TODO: 添加逻辑以处理数据 并增加日志
        return Response(list)

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ObjectDoesNotExist
from projects.models import Project
import logging
from time import timezone
# class ProImportAPI(APIView):
#     """
#     专业版任务创建接口
#     支持通过多种方式创建标注任务
#     """
#
#     def post(self, request, pk):
#         response = {'message': 'Importing tasks is not available in Community edition'}
#         return Response(
#             response,
#             status=status.HTTP_200_OK
#         )
#     def _create_tasks(self, project, validated_data):
#         response = {'message': 'Importing tasks is not available in Community edition'}
#         return Response(response, status=status.HTTP_201_CREATED)

@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Import'],
        responses=task_create_response_scheme,
        parameters=[
            OpenApiParameter(
                name='id',
                type=OpenApiTypes.INT,
                location='path',
                description='A unique integer value identifying this project.',
            ),
            OpenApiParameter(
                name='commit_to_project',
                type=OpenApiTypes.BOOL,
                location='query',
                description='Set to "true" to immediately commit tasks to the project.',
                default=True,
                required=False,
            ),
            OpenApiParameter(
                name='return_task_ids',
                type=OpenApiTypes.BOOL,
                location='query',
                description='Set to "true" to return task IDs in the response.',
                default=False,
                required=False,
            ),
            OpenApiParameter(
                name='preannotated_from_fields',
                many=True,
                location='query',
                description='List of fields to preannotate from the task data. For example, if you provide a list of'
                ' `{"text": "text", "prediction": "label"}` items in the request, the system will create '
                'a task with the `text` field and a prediction with the `label` field when '
                '`preannoted_from_fields=["prediction"]`.',
                default=None,
                required=False,
            ),
        ],
        summary='Import tasks',
        description="""
            Import data as labeling tasks in bulk using this API endpoint. You can use this API endpoint to import multiple tasks.
            One POST request is limited at 250K tasks and 200 MB.

            **Note:** Imported data is verified against a project *label_config* and must
            include all variables that were used in the *label_config*. For example,
            if the label configuration has a *$text* variable, then each item in a data object
            must include a "text" field.
            <br>

            ## POST requests
            <hr style="opacity:0.3">

            There are three possible ways to import tasks with this endpoint:

            ### 1. **POST with data**
            Send JSON tasks as POST data. Only JSON is supported for POSTing files directly.
            Update this example to specify your authorization token and Label Studio instance host, then run the following from
            the command line.

            ```bash
            curl -H 'Content-Type: application/json' -H 'Authorization: Token abc123' \\
            -X POST '{host}/api/projects/1/import' --data '[{{"text": "Some text 1"}}, {{"text": "Some text 2"}}]'
            ```

            ### 2. **POST with files**
            Send tasks as files. You can attach multiple files with different names.

            - **JSON**: text files in JavaScript object notation format
            - **CSV**: text files with tables in Comma Separated Values format
            - **TSV**: text files with tables in Tab Separated Value format
            - **TXT**: simple text files are similar to CSV with one column and no header, supported for projects with one source only

            Update this example to specify your authorization token, Label Studio instance host, and file name and path,
            then run the following from the command line:

            ```bash
            curl -H 'Authorization: Token abc123' \\
            -X POST '{host}/api/projects/1/import' -F 'file=@path/to/my_file.csv'
            ```

            ### 3. **POST with URL**
            You can also provide a URL to a file with labeling tasks. Supported file formats are the same as in option 2.

            ```bash
            curl -H 'Content-Type: application/json' -H 'Authorization: Token abc123' \\
            -X POST '{host}/api/projects/1/import' \\
            --data '[{{"url": "http://example.com/test1.csv"}}, {{"url": "http://example.com/test2.csv"}}]'
            ```

            <br>
        """.format(
            host=(settings.HOSTNAME or 'https://localhost:8080')
        ),
        request={
            'type': 'array',
            'items': {'type': 'object'},
            # TODO: this example doesn't work - perhaps we need to migrate to drf-spectacular for "anyOf" support
            # also fern will change to at least provide a list of examples FER-1969
            # right now we can only rely on documenation examples
            # properties={
            #     'data': openapi.Schema(type=OpenApiTypes.OBJECT, description='Data of the task'),
            #     'annotations': openapi.Schema(
            #         many=True,
            #         description='Annotations for this task',
            #     ),
            #     'predictions': openapi.Schema(
            #         many=True,
            #         description='Predictions for this task',
            #     )
            # },
            # example={
            #     'data': {'image': 'http://example.com/image.jpg'},
            #     'annotations': [annotation_response_example],
            #     'predictions': [prediction_response_example]
            # }
        },
        extensions={
            'x-fern-sdk-group-name': 'projects',
            'x-fern-sdk-method-name': 'import_tasks',
            'x-fern-audiences': ['public'],
        },
    ),
)
# Import
class ImportAPI(generics.CreateAPIView):
    permission_required = all_permissions.projects_change
    permission_classes = api_settings.DEFAULT_PERMISSION_CLASSES + [ProjectImportPermission]
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    serializer_class = ImportApiSerializer
    queryset = Task.objects.all()

    def get_serializer_context(self):
        project_id = self.kwargs.get('pk')
        if project_id:
            project = generics.get_object_or_404(Project.objects.for_user(self.request.user), pk=project_id)
        else:
            project = None
        return {'project': project, 'user': self.request.user}

    def post(self, *args, **kwargs):
        return super(ImportAPI, self).post(*args, **kwargs)

    def _save(self, tasks):
        serializer = self.get_serializer(data=tasks, many=True)
        serializer.is_valid(raise_exception=True)
        task_instances = serializer.save(project_id=self.kwargs['pk'])
        project = generics.get_object_or_404(Project.objects.for_user(self.request.user), pk=self.kwargs['pk'])
        emit_webhooks_for_instance(
            self.request.user.active_organization, project, WebhookAction.TASKS_CREATED, task_instances
        )
        return task_instances, serializer

    def sync_import(self, request, project, preannotated_from_fields, commit_to_project, return_task_ids):
        start = time.time()
        tasks = None
        # upload files from request, and parse all tasks
        # TODO: Stop passing request to load_tasks function, make all validation before

        parsed_data, file_upload_ids, could_be_tasks_list, found_formats, data_columns = load_tasks(request, project)

        if preannotated_from_fields:
            # turn flat task JSONs {"column1": value, "column2": value} into {"data": {"column1"..}, "predictions": [{..."column2"}]
            parsed_data = reformat_predictions(parsed_data, preannotated_from_fields)

        if commit_to_project:
            # Immediately create project tasks and update project states and counters
            tasks, serializer = self._save(parsed_data)
            task_count = len(tasks)
            annotation_count = len(serializer.db_annotations)
            prediction_count = len(serializer.db_predictions)

            recalculate_stats_counts = {
                'task_count': task_count,
                'annotation_count': annotation_count,
                'prediction_count': prediction_count,
            }

            # Update counters (like total_annotations) for new tasks and after bulk update tasks stats. It should be a
            # single operation as counters affect bulk is_labeled update
            project.update_tasks_counters_and_task_states(
                tasks_queryset=tasks,
                maximum_annotations_changed=False,
                overlap_cohort_percentage_changed=False,
                tasks_number_changed=True,
                recalculate_stats_counts=recalculate_stats_counts,
            )
            logger.info('Tasks bulk_update finished (sync import)')

            project.summary.update_data_columns(parsed_data)
            # TODO: project.summary.update_created_annotations_and_labels
        else:
            # Do nothing - just output file upload ids for further use
            task_count = len(parsed_data)
            annotation_count = None
            prediction_count = None

        duration = time.time() - start

        response = {
            'task_count': task_count,
            'annotation_count': annotation_count,
            'prediction_count': prediction_count,
            'duration': duration,
            'file_upload_ids': file_upload_ids,
            'could_be_tasks_list': could_be_tasks_list,
            'found_formats': found_formats,
            'data_columns': data_columns,
        }
        if tasks and return_task_ids:
            response['task_ids'] = [task.id for task in tasks]
        # print(response)
        # import json
        # response = json.dumps(response,ensure_ascii= False)
        # return Response(response, status=status.HTTP_201_CREATED)
        return Response(response, status=status.HTTP_200_OK)
        # return Response("abcdefg", status=status.HTTP_200_OK)

    @timeit
    def async_import(self, request, project, preannotated_from_fields, commit_to_project, return_task_ids):

        project_import = ProjectImport.objects.create(
            project=project,
            preannotated_from_fields=preannotated_from_fields,
            commit_to_project=commit_to_project,
            return_task_ids=return_task_ids,
        )

        if len(request.FILES):
            logger.debug(f'Import from files: {request.FILES}')
            file_upload_ids, could_be_tasks_list = create_file_uploads(request.user, project, request.FILES)
            project_import.file_upload_ids = file_upload_ids
            project_import.could_be_tasks_list = could_be_tasks_list
            project_import.save(update_fields=['file_upload_ids', 'could_be_tasks_list'])
        elif 'application/x-www-form-urlencoded' in request.content_type:
            logger.debug(f'Import from url: {request.data.get("url")}')
            # empty url
            url = request.data.get('url')
            if not url:
                raise ValidationError('"url" is not found in request data')
            project_import.url = url
            project_import.save(update_fields=['url'])
        # take one task from request DATA
        elif 'application/json' in request.content_type and isinstance(request.data, dict):
            project_import.tasks = [request.data]
            project_import.save(update_fields=['tasks'])

        # take many tasks from request DATA
        elif 'application/json' in request.content_type and isinstance(request.data, list):
            project_import.tasks = request.data
            project_import.save(update_fields=['tasks'])

        # incorrect data source
        else:
            raise ValidationError('load_tasks: No data found in DATA or in FILES')

        start_job_async_or_sync(
            async_import_background,
            project_import.id,
            request.user.id,
            queue_name='high',
            on_failure=set_import_background_failure,
            project_id=project.id,
            organization_id=request.user.active_organization.id,
        )

        response = {'import': project_import.id}
        return Response(response, status=status.HTTP_201_CREATED)

    def create(self, request, *args, **kwargs):
        # response = {'message': 'Importing tasks is not available in Community edition'}
        # print(response)
        # # import json
        # # response = json.dumps(response,ensure_ascii= False)
        # # return Response(response, status=status.HTTP_201_CREATED)
        # return Response(response, status=status.HTTP_200_OK)
        # print(request,100*'*')
        commit_to_project = bool_from_request(request.query_params, 'commit_to_project', True)
        # commit_to_project = False
        return_task_ids = bool_from_request(request.query_params, 'return_task_ids', False)
        preannotated_from_fields = list_of_strings_from_request(request.query_params, 'preannotated_from_fields', None)

        # check project permissions
        project = generics.get_object_or_404(Project.objects.for_user(self.request.user), pk=self.kwargs['pk'])

        if settings.VERSION_EDITION != 'Community':
            return self.async_import(request, project, preannotated_from_fields, commit_to_project, return_task_ids)
        else:

            return self.sync_import(request, project, preannotated_from_fields, commit_to_project, return_task_ids)


# Import
@extend_schema(exclude=True)
class ImportPredictionsAPI(generics.CreateAPIView):
    permission_required = all_permissions.projects_change
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    serializer_class = PredictionSerializer
    queryset = Project.objects.all()

    def create(self, request, *args, **kwargs):
        # check project permissions
        project = self.get_object()

        tasks_ids = set(Task.objects.filter(project=project).values_list('id', flat=True))

        logger.debug(
            f'Importing {len(self.request.data)} predictions to project {project} with {len(tasks_ids)} tasks'
        )
        predictions = []
        for item in self.request.data:
            if item.get('task') not in tasks_ids:
                raise ValidationError(
                    f'{item} contains invalid "task" field: corresponding task ID couldn\'t be retrieved '
                    f'from project {project} tasks'
                )
            predictions.append(
                Prediction(
                    task_id=item['task'],
                    project_id=project.id,
                    result=Prediction.prepare_prediction_result(item.get('result'), project),
                    score=item.get('score'),
                    model_version=item.get('model_version', 'undefined'),
                )
            )
        predictions_obj = Prediction.objects.bulk_create(predictions, batch_size=settings.BATCH_SIZE)
        start_job_async_or_sync(update_tasks_counters, Task.objects.filter(id__in=tasks_ids))
        return Response({'created': len(predictions_obj)}, status=status.HTTP_201_CREATED)


@extend_schema(exclude=True)
class TasksBulkCreateAPI(ImportAPI):
    # just for compatibility - can be safely removed
    pass


class ReImportAPI(ImportAPI):
    permission_required = all_permissions.projects_change

    def sync_reimport(self, project, file_upload_ids, files_as_tasks_list):
        start = time.time()
        tasks, found_formats, data_columns = FileUpload.load_tasks_from_uploaded_files(
            project, file_upload_ids, files_as_tasks_list=files_as_tasks_list
        )

        with transaction.atomic():
            project.remove_tasks_by_file_uploads(file_upload_ids)
            tasks, serializer = self._save(tasks)
        duration = time.time() - start

        task_count = len(tasks)
        annotation_count = len(serializer.db_annotations)
        prediction_count = len(serializer.db_predictions)

        # Update counters (like total_annotations) for new tasks and after bulk update tasks stats. It should be a
        # single operation as counters affect bulk is_labeled update
        project.update_tasks_counters_and_task_states(
            tasks_queryset=tasks,
            maximum_annotations_changed=False,
            overlap_cohort_percentage_changed=False,
            tasks_number_changed=True,
            recalculate_stats_counts={
                'task_count': task_count,
                'annotation_count': annotation_count,
                'prediction_count': prediction_count,
            },
        )
        logger.info('Tasks bulk_update finished (sync reimport)')

        project.summary.update_data_columns(tasks)
        # TODO: project.summary.update_created_annotations_and_labels

        return Response(
            {
                'task_count': task_count,
                'annotation_count': annotation_count,
                'prediction_count': prediction_count,
                'duration': duration,
                'file_upload_ids': file_upload_ids,
                'found_formats': found_formats,
                'data_columns': data_columns,
            },
            status=status.HTTP_201_CREATED,
        )

    def async_reimport(self, project, file_upload_ids, files_as_tasks_list, organization_id):

        project_reimport = ProjectReimport.objects.create(
            project=project, file_upload_ids=file_upload_ids, files_as_tasks_list=files_as_tasks_list
        )

        start_job_async_or_sync(
            async_reimport_background,
            project_reimport.id,
            organization_id,
            self.request.user,
            queue_name='high',
            on_failure=set_reimport_background_failure,
            project_id=project.id,
        )

        response = {'reimport': project_reimport.id}
        return Response(response, status=status.HTTP_201_CREATED)

    @retry_database_locked()
    def create(self, request, *args, **kwargs):
        files_as_tasks_list = bool_from_request(request.data, 'files_as_tasks_list', True)
        file_upload_ids = self.request.data.get('file_upload_ids')

        # check project permissions
        project = generics.get_object_or_404(Project.objects.for_user(self.request.user), pk=self.kwargs['pk'])

        if not file_upload_ids:
            return Response(
                {
                    'task_count': 0,
                    'annotation_count': 0,
                    'prediction_count': 0,
                    'duration': 0,
                    'file_upload_ids': [],
                    'found_formats': {},
                    'data_columns': [],
                },
                status=status.HTTP_200_OK,
            )

        if (
            flag_set('fflag_fix_all_lsdv_4971_async_reimport_09052023_short', request.user)
            and settings.VERSION_EDITION != 'Community'
        ):
            return self.async_reimport(
                project, file_upload_ids, files_as_tasks_list, request.user.active_organization_id
            )
        else:
            return self.sync_reimport(project, file_upload_ids, files_as_tasks_list)

    @extend_schema(
        exclude=True,
        summary='Re-import tasks',
        description="""
        Re-import tasks using the specified file upload IDs for a specific project.
        """,
    )
    def post(self, *args, **kwargs):
        return super(ReImportAPI, self).post(*args, **kwargs)


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Import'],
        summary='Get files list',
        parameters=[
            OpenApiParameter(
                name='all',
                type=OpenApiTypes.BOOL,
                location='query',
                description='Set to "true" if you want to retrieve all file uploads',
            ),
            OpenApiParameter(
                name='ids',
                many=True,
                location='query',
                description='Specify the list of file upload IDs to retrieve, e.g. ids=[1,2,3]',
            ),
        ],
        description="""
        Retrieve the list of uploaded files used to create labeling tasks for a specific project.
        """,
        extensions={
            'x-fern-sdk-group-name': ['projects', 'file_uploads'],
            'x-fern-sdk-method-name': 'list',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='delete',
    decorator=extend_schema(
        tags=['Import'],
        summary='Delete files',
        description="""
        Delete uploaded files for a specific project.
        """,
        extensions={
            'x-fern-sdk-group-name': ['projects', 'file_uploads'],
            'x-fern-sdk-method-name': 'delete_many',
            'x-fern-audiences': ['public'],
        },
    ),
)
class FileUploadListAPI(generics.mixins.ListModelMixin, generics.mixins.DestroyModelMixin, generics.GenericAPIView):
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    serializer_class = FileUploadSerializer
    permission_required = ViewClassPermission(
        GET=all_permissions.projects_view,
        DELETE=all_permissions.projects_change,
    )
    queryset = FileUpload.objects.all()

    def get_queryset(self):
        project = generics.get_object_or_404(Project.objects.for_user(self.request.user), pk=self.kwargs.get('pk', 0))
        if project.is_draft or bool_from_request(self.request.query_params, 'all', False):
            # If project is in draft state, we return all uploaded files, ignoring queried ids
            logger.debug(f'Return all uploaded files for draft project {project}')
            return FileUpload.objects.filter(project_id=project.id, user=self.request.user)

        # If requested in regular import, only queried IDs are returned to avoid showing previously imported
        ids = json.loads(self.request.query_params.get('ids', '[]'))
        logger.debug(f'File Upload IDs found: {ids}')
        return FileUpload.objects.filter(project_id=project.id, id__in=ids, user=self.request.user)

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        project = generics.get_object_or_404(Project.objects.for_user(self.request.user), pk=self.kwargs['pk'])
        ids = self.request.data.get('file_upload_ids')
        if ids is None:
            deleted, _ = FileUpload.objects.filter(project=project).delete()
        elif isinstance(ids, list):
            deleted, _ = FileUpload.objects.filter(project=project, id__in=ids).delete()
        else:
            raise ValueError('"file_upload_ids" parameter must be a list of integers')
        return Response({'deleted': deleted}, status=status.HTTP_200_OK)


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Import'],
        summary='Get file upload',
        description='Retrieve details about a specific uploaded file.',
        extensions={
            'x-fern-sdk-group-name': ['projects', 'file_uploads'],
            'x-fern-sdk-method-name': 'get',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='patch',
    decorator=extend_schema(
        tags=['Import'],
        summary='Update file upload',
        description='Update a specific uploaded file.',
        request=FileUploadSerializer,
        extensions={
            'x-fern-sdk-group-name': ['projects', 'file_uploads'],
            'x-fern-sdk-method-name': 'update',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='delete',
    decorator=extend_schema(
        tags=['Import'],
        summary='Delete file upload',
        description='Delete a specific uploaded file.',
        extensions={
            'x-fern-sdk-group-name': ['projects', 'file_uploads'],
            'x-fern-sdk-method-name': 'delete',
            'x-fern-audiences': ['public'],
        },
    ),
)
class FileUploadAPI(generics.RetrieveUpdateDestroyAPIView):
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    permission_classes = (IsAuthenticated,)
    serializer_class = FileUploadSerializer
    queryset = FileUpload.objects.all()

    def get(self, *args, **kwargs):
        return super(FileUploadAPI, self).get(*args, **kwargs)

    def patch(self, *args, **kwargs):
        return super(FileUploadAPI, self).patch(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return super(FileUploadAPI, self).delete(*args, **kwargs)

    @extend_schema(exclude=True)
    def put(self, *args, **kwargs):
        return super(FileUploadAPI, self).put(*args, **kwargs)


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Import'],
        summary='Download file',
        description='Download a specific uploaded file.',
        extensions={
            'x-fern-sdk-group-name': ['projects', 'file_uploads'],
            'x-fern-sdk-method-name': 'download',
            'x-fern-audiences': ['public'],
        },
        responses={
            200: OpenApiResponse(description='File downloaded successfully'),
        },
    ),
)
class UploadedFileResponse(generics.RetrieveAPIView):
    """Serve uploaded files from local drive"""

    permission_classes = (IsAuthenticated,)

    @override_report_only_csp
    @csp(SANDBOX=[])
    def get(self, *args, **kwargs):
        request = self.request
        filename = kwargs['filename']
        # XXX needed, on windows os.path.join generates '\' which breaks FileUpload
        file = settings.UPLOAD_DIR + ('/' if not settings.UPLOAD_DIR.endswith('/') else '') + filename
        logger.debug(f'Fetch uploaded file by user {request.user} => {file}')
        file_upload = FileUpload.objects.filter(file=file).last()

        if not file_upload.has_permission(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        file = file_upload.file
        if file.storage.exists(file.name):
            content_type, encoding = mimetypes.guess_type(str(file.name))
            content_type = content_type or 'application/octet-stream'
            return RangedFileResponse(request, file.open(mode='rb'), content_type=content_type)

        return Response(status=status.HTTP_404_NOT_FOUND)


@extend_schema(exclude=True)
class DownloadStorageData(APIView):
    """
    Secure file download API for persistent storage (S3, GCS, Azure, etc.)

    This view provides authenticated access to uploaded files and user avatars stored in
    cloud storage or local filesystems. It supports two operational modes for optimal
    performance and flexibility (simplicity).

    ## Operation Modes:

    ### 1. NGINX Mode (Default - USE_NGINX_FOR_UPLOADS=True)
    - **High Performance**: Uses X-Accel-Redirect headers for efficient file serving
    - **How it works**:
      1. Validates user permissions and file access
      2. Returns HttpResponse with X-Accel-Redirect header pointing to storage URL
      3. NGINX intercepts and serves the file directly from storage
    - **Benefits**: Reduces Django server load, better performance for large files

    ### 2. Direct Mode (USE_NGINX_FOR_UPLOADS=False)
    - **Direct Serving**: Django serves files using RangedFileResponse
    - **How it works**:
      1. Validates user permissions and file access
      2. Opens file from storage and streams it with range request support
      3. Supports partial content requests (HTTP 206)
    - **Benefits**: Works without NGINX, supports range requests for media files

    ## Content-Disposition Logic:
    - **Inline**: PDFs, audio, video files - because media files are directly displayed in the browser
    """

    http_method_names = ['get']
    permission_classes = (IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        """Get export files list"""
        filepath = request.GET.get('filepath')
        if filepath is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        filepath = unquote(request.GET['filepath'])

        file_obj = None
        if filepath.startswith(settings.UPLOAD_DIR):
            logger.debug(f'Fetch uploaded file by user {request.user} => {filepath}')
            file_upload = FileUpload.objects.filter(file=filepath).last()

            if file_upload is not None and file_upload.has_permission(request.user):
                file_obj = file_upload.file
        elif filepath.startswith(settings.AVATAR_PATH):
            user = User.objects.filter(avatar=filepath).first()
            if user is not None and request.user.active_organization.has_user(user):
                file_obj = user.avatar

        if file_obj is None:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # NGINX handling is the default for better performance
        if settings.USE_NGINX_FOR_UPLOADS:
            url = file_obj.storage.url(file_obj.name, storage_url=True)

            protocol = urlparse(url).scheme
            response = HttpResponse()
            # The below header tells NGINX to catch it and serve, see deploy/default.conf
            redirect = '/file_download/' + protocol + '/' + url.replace(protocol + '://', '')
            response['X-Accel-Redirect'] = redirect
            response['Content-Disposition'] = f'inline; filename="{filepath}"'
            return response

        # No NGINX: standard way for direct file serving
        else:
            content_type, _ = mimetypes.guess_type(filepath)
            content_type = content_type or 'application/octet-stream'
            response = RangedFileResponse(request, file_obj.open(mode='rb'), content_type=content_type)
            response['Content-Disposition'] = f'inline; filename="{filepath}"'
            response['filename'] = filepath
            return response
