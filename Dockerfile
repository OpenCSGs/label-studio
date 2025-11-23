# syntax=docker/dockerfile:1.6
ARG NODE_VERSION=22
ARG PYTHON_VERSION=3.12
ARG POETRY_VERSION=2.1.3
ARG VERSION_OVERRIDE
ARG BRANCH_OVERRIDE
ARG BUILD_CN=false
ARG BASE_IMAGE_PATH=

################################ Overview

# This Dockerfile builds a Label Studio environment.
# It consists of three main stages:
# 1. "frontend-builder" - Compiles the frontend assets using Node.
# 2. "frontend-version-generator" - Generates version files for frontend sources.
# 3. "venv-builder" - Prepares the virtualenv environment.
# 4. "py-version-generator" - Generates version files for python sources.
# 5. "prod" - Creates the final production image with the Label Studio, Nginx, and other dependencies.

################################ Stage: frontend-builder (build frontend assets)
FROM ${BASE_IMAGE_PATH}node:${NODE_VERSION} AS frontend-builder

ENV BUILD_NO_SERVER=true \
    BUILD_NO_HASH=true \
    BUILD_NO_CHUNKS=true \
    BUILD_MODULE=true \
    YARN_CACHE_FOLDER=/root/web/.yarn \
    NX_CACHE_DIRECTORY=/root/web/.nx \
    NODE_ENV=production

WORKDIR /label-studio/web

# Fix Docker Arm64 Build
RUN set -eux; \ 
    if [ "${BUILD_CN:-false}" = "true" ]; then \
      yarn config set registry https://registry.npmmirror.com/ && \
      yarn config set disturl https://npmmirror.com/dist && \
      yarn config set electron_mirror https://npmmirror.com/mirrors/electron/ && \
      yarn config set puppeteer_download_host https://npmmirror.com/mirrors/ && \
      yarn config set chromedriver_cdnurl https://npmmirror.com/mirrors/chromedriver/ && \
      yarn config set operadriver_cdnurl https://npmmirror.com/mirrors/operadriver/ && \
      yarn config set phantomjs_cdnurl https://npmmirror.com/mirrors/phantomjs/ && \
      yarn config set sass_binary_site https://npmmirror.com/mirrors/node-sass/ && \
      yarn config set python_mirror https://npmmirror.com/mirrors/python/; \
    else \
      yarn config set registry https://registry.npmjs.org/; \
    fi; \
    yarn config set network-timeout 1200000

COPY web/package.json .
COPY web/yarn.lock .
COPY web/tools tools
RUN --mount=type=cache,target=${YARN_CACHE_FOLDER},sharing=locked \
    --mount=type=cache,target=${NX_CACHE_DIRECTORY},sharing=locked \
    --mount=type=cache,target=/root/.cache/yarn,sharing=locked \
    yarn install --prefer-offline --no-progress --frozen-lockfile --ignore-engines --non-interactive --production=false

COPY web .
COPY pyproject.toml ../pyproject.toml
RUN --mount=type=cache,target=${YARN_CACHE_FOLDER},sharing=locked \
    --mount=type=cache,target=${NX_CACHE_DIRECTORY},sharing=locked \
    yarn run build

################################ Stage: frontend-version-generator
FROM frontend-builder AS frontend-version-generator

RUN --mount=type=cache,target=${YARN_CACHE_FOLDER},sharing=locked \
    --mount=type=cache,target=${NX_CACHE_DIRECTORY},sharing=locked \
    --mount=type=bind,source=.git,target=/label-studio/.git \
    yarn version:libs

################################ Stage: venv-builder (prepare the virtualenv)
FROM ${BASE_IMAGE_PATH}python:${PYTHON_VERSION}-slim AS venv-builder
ARG POETRY_VERSION

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100 \
    PIP_CACHE_DIR="/.cache" \
    POETRY_CACHE_DIR="/.poetry-cache" \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    PATH="/opt/poetry/bin:$PATH"

ADD https://install.python-poetry.org /tmp/install-poetry.py
RUN python /tmp/install-poetry.py

ARG BUILD_CN=false
RUN --mount=type=cache,target="/var/cache/apt",sharing=locked \
    --mount=type=cache,target="/var/lib/apt/lists",sharing=locked \
    set -eux; \
    if [ "$BUILD_CN" = "true" ]; then \
      sed -i 's#http://deb.debian.org/#https://mirrors.tuna.tsinghua.edu.cn/#' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install --no-install-recommends -y build-essential git; \
    apt-get clean; rm -rf /var/lib/apt/lists/*

WORKDIR /label-studio

ENV VENV_PATH="/label-studio/.venv"
ENV PATH="$VENV_PATH/bin:$PATH"

## Starting from this line all packages will be installed in $VENV_PATH

# Copy dependency files
COPY pyproject.toml poetry.lock README.md ./

# Set a default build argument for including dev dependencies
ARG INCLUDE_DEV=false

# Install dependencies without dev packages
RUN --mount=type=cache,target=$POETRY_CACHE_DIR,sharing=locked \
    if [ "$BUILD_CN" = "true" ]; then \
      poetry config repositories.tuna https://pypi.tuna.tsinghua.edu.cn/simple/ && \
      poetry config pypi-token.pypi --unset && \
      poetry source add --priority=primary tuna https://pypi.tuna.tsinghua.edu.cn/simple/; \
    fi && \
    poetry lock && \
    poetry check --lock && \
    if [ "$INCLUDE_DEV" = "true" ]; then \
        poetry install --no-interaction --no-ansi --no-root --extras uwsgi --with test; \
    else \
        poetry install --no-interaction --no-ansi --no-root --without test --extras uwsgi; \
    fi

# Install LS
COPY label_studio label_studio
RUN --mount=type=cache,target=$POETRY_CACHE_DIR,sharing=locked \
    # `--extras uwsgi` is mandatory here due to poetry bug: https://github.com/python-poetry/poetry/issues/7302
    poetry install --only-root --extras uwsgi; \
    python3 label_studio/manage.py collectstatic --no-input

################################ Stage: py-version-generator
FROM venv-builder AS py-version-generator
ARG VERSION_OVERRIDE
ARG BRANCH_OVERRIDE

# Create version_.py and ls-version_.py
RUN --mount=type=bind,source=.git,target=/label-studio/.git \
    VERSION_OVERRIDE=${VERSION_OVERRIDE} BRANCH_OVERRIDE=${BRANCH_OVERRIDE} poetry run python label_studio/core/version.py

FROM ${BASE_IMAGE_PATH}python:${PYTHON_VERSION}-slim AS production

ENV LS_DIR=/label-studio \
    HOME=/label-studio \
    LABEL_STUDIO_BASE_DATA_DIR=/label-studio/data \
    OPT_DIR=/opt/heartex/instance-data/etc \
    PATH="/label-studio/.venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=core.settings.label_studio \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR $LS_DIR

# install prerequisites for app
ARG BUILD_CN=false
RUN --mount=type=cache,target="/var/cache/apt",sharing=locked \
    --mount=type=cache,target="/var/lib/apt/lists",sharing=locked \
    if [ "$BUILD_CN" = "true" ]; then \
      sed -i 's#http://deb.debian.org/#https://mirrors.tuna.tsinghua.edu.cn/#' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install --no-install-recommends -y libexpat1 libgl1 libglx-mesa0 libglib2.0-0t64 gnupg2 curl nginx; \
    apt-get clean; rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    mkdir -p $LS_DIR $LABEL_STUDIO_BASE_DATA_DIR $OPT_DIR; \
    chown -R 1001:0 $LS_DIR $LABEL_STUDIO_BASE_DATA_DIR $OPT_DIR /var/log/nginx /etc/nginx

COPY --chown=1001:0 deploy/default.conf /etc/nginx/nginx.conf

# Copy essential files for installing Label Studio and its dependencies
COPY --chown=1001:0 pyproject.toml .
COPY --chown=1001:0 poetry.lock .
COPY --chown=1001:0 README.md .
COPY --chown=1001:0 LICENSE LICENSE
COPY --chown=1001:0 licenses licenses
COPY --chown=1001:0 deploy deploy

RUN chmod +x ./deploy/docker-entrypoint.sh

# Copy files from build stages
COPY --chown=1001:0 --from=venv-builder               $LS_DIR                                           $LS_DIR
COPY --chown=1001:0 --from=py-version-generator       $LS_DIR/label_studio/core/version_.py             $LS_DIR/label_studio/core/version_.py
COPY --chown=1001:0 --from=frontend-builder           $LS_DIR/web/dist                                  $LS_DIR/web/dist
COPY --chown=1001:0 --from=frontend-version-generator $LS_DIR/web/dist/apps/labelstudio/version.json    $LS_DIR/web/dist/apps/labelstudio/version.json
COPY --chown=1001:0 --from=frontend-version-generator $LS_DIR/web/dist/libs/editor/version.json         $LS_DIR/web/dist/libs/editor/version.json
COPY --chown=1001:0 --from=frontend-version-generator $LS_DIR/web/dist/libs/datamanager/version.json    $LS_DIR/web/dist/libs/datamanager/version.json

USER 1001

EXPOSE 8080

ENTRYPOINT ["/label-studio/deploy/docker-entrypoint.sh"]
CMD ["label-studio"]
