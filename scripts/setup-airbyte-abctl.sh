#!/usr/bin/env bash
set -euo pipefail

HOST="${AIRBYTE_HOST:-localhost}"
LOW_RESOURCE="${AIRBYTE_LOW_RESOURCE:-false}"
INSECURE_COOKIES="${AIRBYTE_INSECURE_COOKIES:-false}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required before installing Airbyte with abctl." >&2
  exit 1
fi

if ! command -v abctl >/dev/null 2>&1; then
  echo "abctl is not installed."
  echo "Install with one of:"
  echo "  curl -LsfS https://get.airbyte.com | bash -"
  echo "  brew tap airbytehq/tap && brew install abctl"
  exit 1
fi

args=(local install)

if [[ "$HOST" != "localhost" ]]; then
  args+=(--host "$HOST")
fi

if [[ "$LOW_RESOURCE" == "true" ]]; then
  args+=(--low-resource-mode)
fi

if [[ "$INSECURE_COOKIES" == "true" ]]; then
  args+=(--insecure-cookies)
fi

echo "Installing Airbyte with: abctl ${args[*]}"
abctl "${args[@]}"

echo
echo "Airbyte is installed. Retrieve credentials with:"
echo "  abctl local credentials"
echo
echo "Then set AIRBYTE_API_URL and AIRBYTE_API_TOKEN in apps/admin/.env.local or .env.local."
