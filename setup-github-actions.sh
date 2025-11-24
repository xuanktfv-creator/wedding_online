#!/bin/bash
# This script helps set up the service account key for GitHub Actions

echo "Creating service account key file from secret..."
printf '%s' "$GOOGLE_SERVICE_ACCOUNT_KEY" > service-account-key.json

