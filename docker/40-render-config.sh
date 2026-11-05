#!/bin/sh
# Runs from the nginx image's entrypoint. Lets one image target any API.
set -eu

if [ -n "${API_URL:-}" ]; then
  printf '{ "apiUrl": "%s" }\n' "$API_URL" > /usr/share/nginx/html/config.json
fi
