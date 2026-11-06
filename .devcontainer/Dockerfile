FROM mcr.microsoft.com/devcontainers/typescript-node:5-26-trixie

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx libnginx-mod-stream postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@12.16.1
