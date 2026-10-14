#!/bin/bash
# Mangohub legacy compatibility wrapper
# This script is maintained for backward compatibility. Please migrate to install.sh.

echo "Notice: install-komari.sh has been renamed to install.sh in Mangohub."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
if [ -f "$SCRIPT_DIR/install.sh" ]; then
    exec bash "$SCRIPT_DIR/install.sh" "$@"
else
    exec bash -c "$(curl -fsSL https://raw.githubusercontent.com/dengyie/mangohub/main/hub/install.sh)" -- "$@"
fi
