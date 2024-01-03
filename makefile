build:
	yarn --cwd ./client build
	yarn --cwd ./server build
	cp ./server/package.json ./dist/server/
	yarn --cwd ./dist/server install

start: build
	yarn --cwd ./client preview --host
	yarn --cwd ./dist/server start

