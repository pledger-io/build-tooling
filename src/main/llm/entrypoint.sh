#!/usr/bin/env bash

echo "Starting the Ollama agent"

/bin/ollama serve & > /dev/null 2>&1 &

until $(curl --output /dev/null --silent --head --fail ${OLLAMA_HOST}); do
  printf '.'
  sleep 1
done

echo "Pulling the default model ${AI_MODEL}"

ollama pull ${AI_MODEL}

echo "Starting application with command: ${@}"

exec $@