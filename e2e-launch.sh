#!/bin/bash
set -eu -o pipefail

# Launch Obsidian with the e2e test vault for manual setup/testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNPACKED_DIR="$SCRIPT_DIR/.obsidian-unpacked"
E2E_VAULT_DIR="$SCRIPT_DIR/tasknotes-e2e-vault"

if [[ ! -x "$UNPACKED_DIR/obsidian" ]]; then
    echo "Error: Unpacked Obsidian not found. Run e2e-setup.sh first."
    exit 1
fi

if [[ ! -d "$E2E_VAULT_DIR" ]]; then
    echo "Error: E2E vault not found at $E2E_VAULT_DIR"
    exit 1
fi

echo "Launching Obsidian with e2e vault..."
echo "Vault: $E2E_VAULT_DIR"

# Launch the unpacked Obsidian binary with the test vault
# Pass the vault path directly as an argument
cd "$UNPACKED_DIR"
./obsidian --no-sandbox "$E2E_VAULT_DIR"
