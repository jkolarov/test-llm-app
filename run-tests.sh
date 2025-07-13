#!/bin/bash

echo "Starting containers..."
docker-compose up -d

echo "Waiting for containers to be ready..."
sleep 10

echo "Running backend tests..."
docker-compose exec backend pytest -v

echo "Running frontend tests..."
docker-compose exec frontend npm test -- --run

echo "Tests completed!" 