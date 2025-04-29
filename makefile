# build directory should match the one in the package.json
_BUILD_DIRECTORY := ./dist  

# set this to the path where you want to copy over the build files
# you can setup an alias for this path in your shell config
# e.g. alias startmangaviewer='node D:\\executables\\mangaviewer\\server\\main.js'
# NOTE: don't add spaces around the path
GLOBAL_EXECUTABLE_FOLDER := /d/executables/mangaviewer

###########
# Commands
###########
build:
	rm -rf ${strip _BUILD_DIRECTORY}/*
	yarn --cwd ./client build
	yarn --cwd ./server build
	cp ./server/package.json ${strip _BUILD_DIRECTORY}/server/
	yarn --cwd ${strip _BUILD_DIRECTORY}/server install

start: build
	 node ${_BUILD_DIRECTORY}/server/main.js


build-exec: build
	rm -rf ${strip GLOBAL_EXECUTABLE_FOLDER}
	cp  ${strip _BUILD_DIRECTORY} ${strip GLOBAL_EXECUTABLE_FOLDER} -r
