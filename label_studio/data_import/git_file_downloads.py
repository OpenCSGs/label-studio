from pycsghub.snapshot_download import snapshot_download
token="9eba3d0173eb48ed99bb6952233bbb50"
endpoint = "http://net-power.9free.com.cn:18120"
repo_id = 'z275748353/test'
repo_type="dataset"
cache_dir = 'Downloads/'

revision="v1"

result = snapshot_download(repo_id, repo_type=repo_type, cache_dir=cache_dir, endpoint=endpoint, token=token,revision=revision)


# print(result)