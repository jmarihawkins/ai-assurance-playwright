#!/usr/bin/env bash

set -e

npm ci

npx playwright install chromium

echo "Setup complete. Run: npm test"