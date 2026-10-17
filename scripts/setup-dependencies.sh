#!/bin/bash

# Setup Dependencies Script
# Installs all project dependencies via pnpm using the lockfile.

set -euo pipefail

# cd to the project root (directory containing this script's parent)
cd "$(dirname "$0")/.."

echo "===== Installing Dependencies ====="

pnpm install --frozen-lockfile

echo ""
echo "===== Dependency Installation Complete ====="
echo ""
echo "To build for production, run:"
echo "  pnpm run build"
