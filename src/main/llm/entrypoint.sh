#!/usr/bin/env bash

printf "Starting the Ollama agent"

exec /bin/ollama serve > /dev/null 2>&1 &

until $(curl --output /dev/null --silent --head --fail ${OLLAMA_HOST}); do
  printf '.'
  sleep 1
done

echo ""
echo "Pulling the default model ${AI_MODEL}"

ollama pull ${AI_MODEL}

echo "Starting application with command: ${@}"

exec $@