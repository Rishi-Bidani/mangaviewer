build:
	rm -rf ./dist/*
	yarn --cwd ./client build
	yarn --cwd ./server build
	cp ./server/package.json ./dist/server/
	yarn --cwd ./dist/server install

# start: build
# 	yarn --cwd ./client preview --host & yarn --cwd ./dist/server start

# start: build
# 	yarn --cwd ./dist/server start



start: build
	 node ./dist/server/main.js

