#!/bin/sh

if [ -n "$SPARK_WEB_TOKEN" ]; then
  echo "⚡ Starting Spark sidecar on port ${SPARK_WEB_PORT:-8081}"
  bun extensions/spark-web/services/sparkWeb.ts &
fi

exec bun index.ts
