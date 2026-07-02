# CSGHub 二开：导出结果上传到 CSGHub

import os
import shutil
from pathlib import Path

from django.conf import settings


def upload_without_cache_check(request, target_dataset, target_branch, local_folder):
    """将本地导出目录上传到 CSGHub 数据集。 """
    try:
        from pycsghub.upload_large_folder.main import upload_large_folder_internal
    except ImportError:
        raise RuntimeError('CSGHub 导出需要安装 pycsghub: pip install csghub-sdk')

    token = getattr(request.user, 'user_token', None) or ''
    endpoint = os.environ.get('CSGHUB_ENDPOINT', 'http://net-power.9free.com.cn:58120')

    if not endpoint:
        raise ValueError('未配置 CSGHUB_ENDPOINT')
    if not target_dataset:
        raise ValueError('未指定目标数据集')
    if not target_branch:
        raise ValueError('未指定目标分支')

    cache_dir = Path(local_folder) / '.cache'
    if cache_dir.exists():
        shutil.rmtree(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    # 使用用户指定的分支，添加 _label 后缀
    revision_label = f"{target_branch}_label"

    upload_large_folder_internal(
        repo_id=target_dataset,
        local_path=local_folder,
        repo_type='dataset',
        revision=revision_label,
        endpoint=endpoint.rstrip('/'),
        token=token,
        num_workers=1,
        print_report=False,
        print_report_every=5,
        allow_patterns=['*'],
        ignore_patterns=['.cache/*'],
    )
