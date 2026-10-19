#!/bin/bash
set -eu -o pipefail

# Launch Obsidian with the e2e test vault for manual setup/testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNPACKED_DIR="${TASKNOTES_E2E_RUNTIME_DIR:-$SCRIPT_DIR/.obsidian-unpacked}"
E2E_VAULT_DIR="${TASKNOTES_E2E_VAULT_DIR:-$SCRIPT_DIR/tasknotes-e2e-vault}"
USER_DATA_DIR="${TASKNOTES_E2E_USER_DATA_DIR:-$SCRIPT_DIR/.obsidian-config-e2e}"
UNPACKED_DIR="$(realpath "$UNPACKED_DIR")"
E2E_VAULT_DIR="$(realpath "$E2E_VAULT_DIR")"
USER_DATA_DIR="$(realpath -m "$USER_DATA_DIR")"

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

# Never hand the test vault to the user's normal Obsidian instance.
mkdir -p "$USER_DATA_DIR"
node - "$USER_DATA_DIR" "$E2E_VAULT_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const [profile, vault] = process.argv.slice(2);
const configPath = path.join(profile, 'obsidian.json');
let config = {};
if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.updateDisabled = true;
config.vaults = { 'tasknotes-e2e': { path: vault, ts: Date.now(), open: true } };
fs.writeFileSync(configPath, JSON.stringify(config));
NODE
cd "$UNPACKED_DIR"
OBSIDIAN_CONFIG_DIR="$USER_DATA_DIR" ./obsidian --no-sandbox --password-store=basic \
    --user-data-dir="$USER_DATA_DIR" "$E2E_VAULT_DIR"
