"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import csv
import io
import logging
import mimetypes



try:
    import ujson as json
except:  # noqa: E722
    import json

from core.utils.common import timeit
from core.utils.io import ssrf_safe_get
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError
from urllib.parse import unquote
from .models import FileUpload
from urllib.parse import urlparse,parse_qs, parse_qsl
import re
logger = logging.getLogger(__name__)
csv.field_size_limit(131072 * 10)

import shutil
import os
import requests


def clear_folder(folder_path):
    """清空文件夹下的所有文件和子文件夹，但保留文件夹本身"""
    if not os.path.exists(folder_path):
        return

    # 遍历文件夹内所有内容
    for item in os.listdir(folder_path):
        item_path = os.path.join(folder_path, item)
        try:
            # 删除文件或符号链接
            if os.path.isfile(item_path) or os.path.islink(item_path):
                os.unlink(item_path)
            # 删除子文件夹及其内容
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
        except Exception as e:
            print(f"删除 {item_path} 失败: {e}")
def is_binary(f):
    return isinstance(f, (io.RawIOBase, io.BufferedIOBase))


def csv_generate_header(file):
    """Generate column names for headless csv file"""
    file.seek(0)
    names = []
    line = file.readline()

    num_columns = len(line.split(b',' if isinstance(line, bytes) else ','))
    for i in range(num_columns):
        names.append('column' + str(i + 1))
    file.seek(0)
    return names


def check_max_task_number(tasks):
    # max tasks
    if len(tasks) > settings.TASKS_MAX_NUMBER:
        raise ValidationError(
            f'Maximum task number is {settings.TASKS_MAX_NUMBER}, ' f'current task number is {len(tasks)}'
        )


def check_tasks_max_file_size(value):
    if value >= settings.TASKS_MAX_FILE_SIZE:
        raise ValidationError(
            f'Maximum total size of all files is {settings.TASKS_MAX_FILE_SIZE} bytes, '
            f'current size is {value} bytes'
        )


def check_extensions(files):
    for filename, file_obj in files.items():
        _, ext = os.path.splitext(file_obj.name)
        if ext.lower() not in settings.SUPPORTED_EXTENSIONS:
            raise ValidationError(f'{ext} extension is not supported')


def check_request_files_size(files):
    total = sum([file.size for _, file in files.items()])

    check_tasks_max_file_size(total)


def create_file_upload(user, project, file):
    instance = FileUpload(user=user, project=project, file=file)
    if settings.SVG_SECURITY_CLEANUP:
        content_type, encoding = mimetypes.guess_type(str(instance.file.name))
        if content_type in ['image/svg+xml']:
            clean_xml = allowlist_svg(instance.file.read().decode())
            instance.file.seek(0)
            instance.file.write(clean_xml.encode())
            instance.file.truncate()
    instance.save()
    return instance


def allowlist_svg(dirty_xml):
    """Filter out malicious/harmful content from SVG files
    by defining allowed tags
    """
    from lxml.html import clean

    allow_tags = [
        'xml',
        'svg',
        'circle',
        'ellipse',
        'line',
        'path',
        'polygon',
        'polyline',
        'rect',
    ]

    cleaner = clean.Cleaner(
        allow_tags=allow_tags,
        style=True,
        links=True,
        add_nofollow=False,
        page_structure=True,
        safe_attrs_only=False,
        remove_unknown_tags=False,
    )

    clean_xml = cleaner.clean_html(dirty_xml)
    return clean_xml


def str_to_json(data):
    try:
        json_acceptable_string = data.replace("'", '"')
        return json.loads(json_acceptable_string)
    except ValueError:
        return None


def tasks_from_url(file_upload_ids,project, user, body, could_be_tasks_list):
    """Download file using URL and read tasks from it"""
    # process URL with tasks

    # TARGET_DOMAINS = "https://hub.opencsg.com" # 目标域名列表
    #
    # LOCAL_FOLDER_PATH = "D:\label-studio\label-studio-develop\label_studio\data_import\Downloads"  # 本地文件夹路径
    # try:
    #     from pycsghub.snapshot_download import snapshot_download
    #     token = 'e35e638270df4a5bb4dc0b181bb9453e'
    #     endpoint = "https://hub.opencsg.com"  # 修改 endpoint
    #     repo_type = "dataset"
    #     repo_id = 'shenren123/admin'
    #     # cache_dir = "Downloads/"
    #     cache_dir = LOCAL_FOLDER_PATH


    # LOCAL_FOLDER_PATH = "D:\label-studio\label-studio-develop\label_studio\data_import\Downloads"  # 本地文件夹路径
    # LOCAL_FOLDER_PATH = r"D:\name\label-studio-develop\label-studio-develop\label_studio\data_import\Downloads"  # 本地文件夹路径
    LOCAL_FOLDER_PATH = os.path.join(os.path.dirname(__file__), 'Downloads')  # 本地文件夹路径
    os.makedirs(LOCAL_FOLDER_PATH, exist_ok=True)  # 确保目录存在
    try:
        from pycsghub.snapshot_download import snapshot_download
        import uuid


        # print(type(user),'tasks_from_url',100*'*')
        # print(str(user).split('@')[0])
        # print(eval(url),'tasks_from_url',100*'*')

        # print(body)
        decoded_str = unquote(body.decode('utf-8'))
        # print(decoded_str)

        result_qs = parse_qs(decoded_str)
        token = user.user_token



        # print(result_qs['dataset'][0])
        # print(result_qs['datasetBranches'][0])

        # print(str(user).split('@')[0])
        # print(type(str(user).split('@')[0]))
        # TK = get_data(str(user).split('@')[0])['user_token']
        # from label_studio.projects.models import Project
        # 获取dataset和datasetBranches值
        dataset = result_qs.get('dataset', [''])[0]
        dataset_branches = result_qs.get('datasetBranches', [''])[0]

        # 更新项目字段
        project.dataset = dataset
        project.datasetBranches = dataset_branches
        project.save(update_fields=['dataset', 'datasetBranches'])  # 只更新这两个字段



        endpoint =  os.environ['CSG_HUB_ENDPOINT']
        repo_id = project.dataset
        repo_type = "dataset"
        revision = project.datasetBranches
        # revision = 'v1'


        cache_dir = LOCAL_FOLDER_PATH
        snapshot_download(repo_id, repo_type=repo_type, cache_dir=cache_dir, endpoint=endpoint, token=token,revision=revision)



        # 上传本地文件夹所有文件

        if not os.path.exists(LOCAL_FOLDER_PATH):
            raise ValidationError(f"Local folder {LOCAL_FOLDER_PATH} does not exist")

        # 遍历本地文件夹
        # 递归遍历本地文件夹及其子文件夹
        for root, dirs, files in os.walk(LOCAL_FOLDER_PATH):
            # print(100 * '2-+')
            for filename in files:
                # print(filename)
                # 跳过空文件名
                if not filename.strip():
                    logger.warning(f"Skipping file with empty name in {root}")
                    print("Skipping file with empty name",100*'*')
                    continue

                file_path = os.path.join(root, filename)
                if os.path.isfile(file_path):
                    # 读取文件内容并创建上传记录
                    with open(file_path, 'rb') as f:
                        file_content = f.read()

                    # 保持相对路径结构（可选）
                    relative_path = os.path.relpath(file_path, LOCAL_FOLDER_PATH)

                    # 处理相对路径为空的极端情况（如文件在根目录且名为空，或路径计算异常）
                    if not relative_path.strip():
                        default_name = f"auto-file-{uuid.uuid4().hex[:10]}"  # 生成唯一默认名
                        logger.warning(f"Empty relative path detected, using default name: {default_name}")
                        relative_path = default_name

                        #  确保文件名合法（避免包含系统保留字符）
                    sanitized_name = relative_path.replace('/', '_').replace('\\', '_').replace(':', '-')
                    if sanitized_name != relative_path:
                        logger.warning(f"Sanitized invalid filename from '{relative_path}' to '{sanitized_name}'")

                    # 创建上传环境
                    file_upload = create_file_upload(
                        user,
                        project,
                        SimpleUploadedFile(sanitized_name, file_content)  # 使用相对路径作为文件名
                    )
                    if file_upload.format_could_be_tasks_list:
                        could_be_tasks_list = True
                    file_upload_ids.append(file_upload.id)

        # 从上传的本地文件加载任务
        tasks, found_formats, data_keys = FileUpload.load_tasks_from_uploaded_files(
            project, file_upload_ids
        )
        # print(data_keys,100*'*')
        # print(found_formats,100*'*')
        # print(tasks,100*'*')
        # print(file_upload_ids,100*'*')
        # print(could_be_tasks_list,100*'*')
        # 确认上传和解析完成后，删除本地文件夹内容
        clear_folder(LOCAL_FOLDER_PATH)
        return data_keys, found_formats, tasks, file_upload_ids, could_be_tasks_list

    except ValidationError as e:
        raise e
    except Exception as e:
        raise ValidationError(str(e))


    #     #  原有逻辑
    #     filename = url.rsplit('/', 1)[-1]
    #
    #     response = ssrf_safe_get(
    #         url, verify=project.organization.should_verify_ssl_certs(), stream=True, headers={'Accept-Encoding': None}
    #     )
    #
    #     # Try to get filename from resolved URL after redirects
    #     resolved_url = response.url if hasattr(response, 'url') else url
    #     if resolved_url != url:
    #         # Parse filename from the resolved URL after redirect
    #         from urllib.parse import unquote, urlparse
    #
    #         parsed_url = urlparse(resolved_url)
    #         path = unquote(parsed_url.path)
    #         resolved_filename = path.rsplit('/', 1)[-1]
    #         # Remove query parameters
    #         if '?' in resolved_filename:
    #             resolved_filename = resolved_filename.split('?')[0]
    #         _, resolved_ext = os.path.splitext(resolved_filename)
    #         filename = resolved_filename
    #
    #     # Check file extension
    #     _, ext = os.path.splitext(filename)
    #     if ext and ext.lower() not in settings.SUPPORTED_EXTENSIONS:
    #         raise ValidationError(f'{ext} extension is not supported')
    #
    #     # Check file size before downloading
    #     content_length = response.headers.get('content-length')
    #     if content_length:
    #         check_tasks_max_file_size(int(content_length))
    #
    #     file_content = response.content
    #     file_upload = create_file_upload(user, project, SimpleUploadedFile(filename, file_content))
    #     if file_upload.format_could_be_tasks_list:
    #         could_be_tasks_list = True
    #     file_upload_ids.append(file_upload.id)
    #     tasks, found_formats, data_keys = FileUpload.load_tasks_from_uploaded_files(project, file_upload_ids)
    #
    # except ValidationError as e:
    #     raise e
    # except Exception as e:
    #     raise ValidationError(str(e))
    # return data_keys, found_formats, tasks, file_upload_ids, could_be_tasks_list


@timeit
def create_file_uploads(user, project, FILES):
    could_be_tasks_list = False
    file_upload_ids = []
    check_request_files_size(FILES)
    check_extensions(FILES)
    for _, file in FILES.items():
        file_upload = create_file_upload(user, project, file)
        if file_upload.format_could_be_tasks_list:
            could_be_tasks_list = True
        file_upload_ids.append(file_upload.id)

    logger.debug(f'created file uploads: {file_upload_ids} could_be_tasks_list: {could_be_tasks_list}')
    return file_upload_ids, could_be_tasks_list


def load_tasks_for_async_import(project_import, user):
    """Load tasks from different types of request.data / request.files saved in project_import model"""
    file_upload_ids, found_formats, data_keys = [], [], set()

    if project_import.file_upload_ids:
        file_upload_ids = project_import.file_upload_ids
        tasks, found_formats, data_keys = FileUpload.load_tasks_from_uploaded_files(
            project_import.project, file_upload_ids
        )

    # take tasks from url address
    elif project_import.url:
        url = project_import.url
        # try to load json with task or tasks from url as string
        json_data = str_to_json(url)
        if json_data:
            file_upload = create_file_upload(
                user,
                project_import.project,
                SimpleUploadedFile('inplace.json', url.encode()),
            )
            file_upload_ids.append(file_upload.id)
            tasks, found_formats, data_keys = FileUpload.load_tasks_from_uploaded_files(
                project_import.project, file_upload_ids
            )

        # download file using url and read tasks from it
        else:
            could_be_tasks_list = False
            (
                data_keys,
                found_formats,
                tasks,
                file_upload_ids,
                could_be_tasks_list,
            ) = tasks_from_url(file_upload_ids, project_import.project, user, url, could_be_tasks_list)
            if could_be_tasks_list:
                project_import.could_be_tasks_list = True
                project_import.save(update_fields=['could_be_tasks_list'])

    elif project_import.tasks:
        tasks = project_import.tasks

    # check is data root is list
    if not isinstance(tasks, list):
        raise ValidationError('load_tasks: Data root must be list')

    # empty tasks error
    if not tasks:
        raise ValidationError('load_tasks: No tasks added')

    check_max_task_number(tasks)
    return tasks, file_upload_ids, found_formats, list(data_keys)


def load_tasks(request, project):
    # print(100 * '-+')
    """Load tasks from different types of request.data / request.files"""
    file_upload_ids, found_formats, data_keys = [], [], set()
    could_be_tasks_list = False

    # take tasks from request FILES
    if len(request.FILES):
        # print(100 * '-+1')
        raw_body = request.body
        # 1. 将字节流解码为字符串（处理中文和特殊字符）
        form_str = raw_body.decode('utf-8', errors='ignore')  # errors='ignore' 避免图片二进制解码报错

        # 正则表达式匹配规则
        # 匹配 pattern: name="字段名"\r\n\r\n字段值\r\n------
        pattern = r'(dataset|datasetBranches)"\r\n\r\n(.*?)\r\n------'

        # 查找所有匹配项（非贪婪模式）
        matches = re.findall(pattern, form_str, re.DOTALL)

        # 提取结果
        result = {}
        for name, value in matches:
            result[name] = value

        # # 输出结果
        # print(f"dataset: {result.get('dataset')}")
        # print(f"datasetBranches: {result.get('datasetBranches')}")
        project.dataset = result.get('dataset')
        project.datasetBranches = result.get('datasetBranches')
        project.save(update_fields=['dataset', 'datasetBranches'])
        # # 输出结果
        # print(f"dataset: {dataset}")
        # print(f"datasetBranches: {dataset_branches}")
        #
        # # 输出结果
        # print(f"dataset: {dataset}")
        # print(f"datasetBranches: {dataset_branches}")
        # print(100 * '-+1')
        check_request_files_size(request.FILES)
        check_extensions(request.FILES)
        for filename, file in request.FILES.items():
            file_upload = create_file_upload(request.user, project, file)
            if file_upload.format_could_be_tasks_list:
                could_be_tasks_list = True
            file_upload_ids.append(file_upload.id)
        tasks, found_formats, data_keys = FileUpload.load_tasks_from_uploaded_files(project, file_upload_ids)

    # take tasks from url address
    elif 'application/x-www-form-urlencoded' in request.content_type:
        # empty url
        # url = request.data.get('url')
        # if not url:
        #     raise ValidationError('"url" is not found in request data')

        # try to load json with task or tasks from url as string
        # json_data = str_to_json(url)
        # if json_data:
        #     file_upload = create_file_upload(request.user, project, SimpleUploadedFile('inplace.json', url.encode()))
        #     file_upload_ids.append(file_upload.id)
        #     tasks, found_formats, data_keys = FileUpload.load_tasks_from_uploaded_files(project, file_upload_ids)
        #
        # # download file using url and read tasks from it
        # else:、
        # 1. 获取原始请求体数据 (bytes)
        raw_body = request.body  # 原始字节数据
        # print(raw_body,'raw_body',100*'*')
        # # 2. 获取已解析的请求体数据 (DRF自动根据Content-Type解析)
        # parsed_data = request.data  # 对于JSON会自动转为dict/list，表单数据转为QueryDict
        # print(parsed_data,'parsed_data',100*'*')
        (
            data_keys,
            found_formats,
            tasks,
            file_upload_ids,
            could_be_tasks_list,
        ) = tasks_from_url(file_upload_ids, project, request.user, raw_body, could_be_tasks_list)

    # take one task from request DATA
    elif 'application/json' in request.content_type and isinstance(request.data, dict):
        raw_body = request.body  # 原始字节数据

        # print(raw_body, 'raw_body', 100 * '*')

        (
            data_keys,
            found_formats,
            tasks,
            file_upload_ids,
            could_be_tasks_list,
        ) = tasks_from_url(file_upload_ids, project, request.user, raw_body, could_be_tasks_list)
        # tasks = [request.data]

    # take many tasks from request DATA
    elif 'application/json' in request.content_type and isinstance(request.data, list):
        # print(100 * '-+2')
        tasks = request.data

    # incorrect data source
    else:
        # print(100 * '-+3')
        raise ValidationError('load_tasks: No data found in DATA or in FILES')

    # check is data root is list
    if not isinstance(tasks, list):
        raise ValidationError('load_tasks: Data root must be list')

    # empty tasks error
    if not tasks:
        raise ValidationError(f"抱歉，您所需的文件不存在.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff','.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac','.mp4', '.avi', '.mov', '.mkv', '.webm'")
    # print(100 * '-+4')
    check_max_task_number(tasks)
    # print(tasks, file_upload_ids, could_be_tasks_list, found_formats, list(data_keys),"load_tasks123")
    return tasks, file_upload_ids, could_be_tasks_list, found_formats, list(data_keys)
