#!/bin/bash

# Exit on error
set -e

# Configuration
BUILD_DIRECTORY="./dist"
GLOBAL_EXECUTABLE_FOLDER="/d/executables/mangaviewer"

# Step 1: Clean build directory
echo "Cleaning build directory..."
rm -rf "${BUILD_DIRECTORY:?}"/*

# Step 2: Build client and server
echo "Building client..."
yarn --cwd ./client build

echo "Building server..."
yarn --cwd ./server build

# Step 3: Copy server package.json and install dependencies
echo "Preparing server in build directory..."
mkdir -p "${BUILD_DIRECTORY}/server"
cp ./server/package.json "${BUILD_DIRECTORY}/server/"
yarn --cwd "${BUILD_DIRECTORY}/server" install

# Step 4: Clean target executable folder
echo "Cleaning global executable folder..."
rm -rf "${GLOBAL_EXECUTABLE_FOLDER}"

# Step 5: Copy build to executable folder
echo "Copying build to global executable folder..."
cp -r "${BUILD_DIRECTORY}" "${GLOBAL_EXECUTABLE_FOLDER}"

echo "Build and execution files have been successfully copied."
