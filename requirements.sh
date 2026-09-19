#!/usr/bin/env bash
set -e

npm install
npx playwright install chromium

echo "Setup complete. Run: npm test"
