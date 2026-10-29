# ---- build stage: install the workspace, build client + server ----
FROM node:24-alpine AS build

# pnpm version comes from "packageManager" in package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

# install deps first so they're cached unless a manifest or the lockfile changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile

COPY client ./client
COPY server ./server
RUN pnpm build

# self-contained copy of the server (dist + production node_modules only)
RUN pnpm --filter @mangaviewer/server deploy --prod /prod/server

# ---- runtime stage: same layout as the repo, so dist/app.js finds ../../client/dist ----
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    BASE_MANGA_FOLDER=/manga \
    METADATA_FOLDER=/data/metadata

WORKDIR /app

COPY --from=build /prod/server ./server
COPY --from=build /app/client/dist ./client/dist

# the metadata cache, writable by the app since /manga is mounted read-only
RUN mkdir -p /data/metadata && chown -R node:node /data

USER node

EXPOSE 8080
VOLUME ["/manga"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/mangas" > /dev/null || exit 1

CMD ["node", "server/dist/main.js"]
