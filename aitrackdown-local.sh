#!/bin/bash
# AI-Trackdown Tools Local CLI Wrapper
# This script runs the locally built CLI tool

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the local CLI with all passed arguments
node "$SCRIPT_DIR/dist/index.js" "$@"