# 导入必要的库和模块
from pycsghub.cmd.repo_types import RepoType  # 仓库类型定义
from pycsghub.upload_large_folder.main import upload_large_folder_internal  # 大文件上传核心函数
import os  # 操作系统接口
from pathlib import Path  # 面向对象的文件系统路径
import shutil  # 高级文件操作
from django.conf import settings
from rest_framework.request import Request

# def upload_without_cache_check(request: Request, project, local_folder):
#     token = request.user.user_token
from projects.models import Project

def upload_without_cache_check(request,project,local_folder = r"D:\admin\flow",):
    """
    跳过缓存和哈希检查的直接上传方法

    功能：
    - 强制清理并重建缓存目录
    - 直接上传文件到指定仓库
    - 跳过常规的缓存检查和哈希验证

    异常处理：
    - 捕获并打印上传过程中的任何异常
    """
    try:
        # ========== 配置参数部分 ==========
        # user_name = user

        # repo_id = "z275748353/test"  # 目标仓库ID（格式：用户名/仓库名）
          # 本地待上传文件夹路径
        # token = get_data(user_name)['user_token']  # 用户认证令牌
        token = request.user.user_token
        endpoint = os.environ['CSG_HUB_ENDPOINT']
        # revision = get_data(user_name)['datasetBranches'][0]
        # ========== 缓存目录处理部分 ==========
        # 构建缓存目录路径（位于上传目录下的.cache文件夹）
        cache_dir = Path(local_folder) / ".cache"

        # 如果缓存目录已存在，则递归删除整个目录树
        if cache_dir.exists():
            shutil.rmtree(cache_dir)  # 强制删除现有缓存

        # 创建新的空缓存目录（exist_ok=True避免目录已存在时报错）
        os.makedirs(cache_dir, exist_ok=True)

        # ========== 文件上传执行部分 ==========
        # 调用底层上传函数（关键参数说明见下方注释）
        repo_id = project.dataset
        upload_large_folder_internal(
            repo_id=repo_id,  # 数据集
            local_path=local_folder,  # 本地源文件路径
            repo_type="dataset",  # 仓库类型（数据集）
            revision=str(project.datasetBranches)+'_label',  # 目标分支名称
            # revision=project.datasetBranches,  # 目标分支名称
            endpoint=endpoint,  # API服务地址
            token=token,  # 认证令牌
            num_workers=1,  # 工作线程数（设为1禁用并行处理）
            print_report=False,  # 禁用进度报告输出
            print_report_every=5,  # 报告间隔时间（秒）
            allow_patterns=["*"],  # 允许上传所有文件
            ignore_patterns=[".cache/*"]  # 忽略缓存目录内容
        )

        # 上传成功提示（使用Path对象获取文件夹名称）
        print(f"\n✅ 直接上传完成! {Path(local_folder).name} -> {repo_id}")

    except Exception as e:
        # 异常处理：捕获并打印错误信息
        print(f"\n❌ 上传异常: {str(e)}")


# 主程序入口
if __name__ == "__main__":
    upload_without_cache_check()  # 执行上传函数
