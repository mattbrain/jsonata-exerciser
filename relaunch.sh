#!/bin/bash

# Variables
IMAGE_NAME="jsonata-app"
CONTAINER_NAME="jsonata-app"
DOCKERFILE_PATH="."
NETWORK_NAME="actionableintelligence_default"
PORT="3000"

echo "Stopping and removing existing container..."
# Stop and remove the existing container if it exists
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

echo "Building new Docker image..."
# Build the new Docker image
docker build -t $IMAGE_NAME $DOCKERFILE_PATH

echo "Running new container..."
# Run the new container with the same network configuration
docker run -d --name $CONTAINER_NAME --network $NETWORK_NAME -p $PORT:$PORT $IMAGE_NAME

echo "Container restarted successfully!"
