from pycsghub.snapshot_download import snapshot_download
token="c3e3c62f913d468190be6171fd4646cb"
endpoint = "http://net-power.9free.com.cn:18120"
repo_id = 'z275748353/test'
repo_type="dataset"
cache_dir = 'Downloads/'

revision="main"

result = snapshot_download(repo_id, repo_type=repo_type, cache_dir=cache_dir, endpoint=endpoint, token=token,revision=revision)


print(result)