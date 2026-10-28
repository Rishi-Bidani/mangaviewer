# ---- build stage: compile client (vite) and server (tsc) into /app/dist ----
FROM node:24-alpine AS build

WORKDIR /app

# install deps first so they're cached unless the lockfiles change
COPY client/package.json client/yarn.lock ./client/
COPY server/package.json server/yarn.lock ./server/
RUN yarn --cwd ./client install --frozen-lockfile \
    && yarn --cwd ./server install --frozen-lockfile

COPY client ./client
COPY server ./server

RUN yarn --cwd ./client build \
    && yarn --cwd ./server build

# ---- runtime stage: only the built output + production server deps ----
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    BASE_MANGA_FOLDER=/manga

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY server/package.json server/yarn.lock ./dist/server/
RUN yarn --cwd ./dist/server install --frozen-lockfile --production \
    && yarn cache clean

USER node

EXPOSE 8080
VOLUME ["/manga"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/mangas" > /dev/null || exit 1

CMD ["node", "dist/server/main.js"]
