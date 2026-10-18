#!/bin/bash
set -eu -o pipefail

# E2E Test Setup Script for Linux
# Adapted from biblib for tasknotes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OBSIDIAN_APPIMAGE="${1:-${OBSIDIAN_APPIMAGE:-$(node "$SCRIPT_DIR/scripts/e2e-runtime.mjs" appimage)}}"
OBSIDIAN_APPIMAGE="$(realpath "$OBSIDIAN_APPIMAGE")"
OBSIDIAN_DATA_DIR="${OBSIDIAN_DATA_DIR:-$HOME/.config/obsidian}"
UNPACKED_DIR="$SCRIPT_DIR/.obsidian-unpacked"
E2E_VAULT_DIR="$SCRIPT_DIR/tasknotes-e2e-vault"
PLUGIN_DIR="$E2E_VAULT_DIR/.obsidian/plugins/tasknotes"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
if [[ ! -f "$OBSIDIAN_APPIMAGE" ]]; then
    echo_error "Obsidian AppImage not found at: $OBSIDIAN_APPIMAGE"
    echo "Usage: $0 [path-to-obsidian-appimage]"
    exit 1
fi

if [[ ! -d "$E2E_VAULT_DIR" ]]; then
    echo_error "E2E vault not found at: $E2E_VAULT_DIR"
    echo "Please create the e2e-vault directory first."
    exit 1
fi

# Extract privately: simultaneous setup runs must not share /tmp/squashfs-root.
echo_info "Extracting Obsidian AppImage: $OBSIDIAN_APPIMAGE"
TEMP_EXTRACT="$(mktemp -d "${TMPDIR:-/tmp}/tasknotes-obsidian-setup.XXXXXX")"
trap 'rm -rf "$TEMP_EXTRACT"' EXIT
cd "$TEMP_EXTRACT"
# Avoid desktop AppImageLauncher interception during headless setup.
APPIMAGELAUNCHER_DISABLE=1 "$OBSIDIAN_APPIMAGE" --appimage-extract > /dev/null

# Install the selected app package where the Electron loader actually reads it.
# Prefer the newest package by version, not file modification time. A compatible
# bundled package also works without an existing personal Obsidian profile.
node "$SCRIPT_DIR/scripts/e2e-runtime.mjs" install \
    "$TEMP_EXTRACT/squashfs-root/resources" "$OBSIDIAN_DATA_DIR"

# Only replace the old runtime after extraction and compatibility checks pass.
rm -rf "$UNPACKED_DIR"
mv "$TEMP_EXTRACT/squashfs-root" "$UNPACKED_DIR"

# Step 3: Build the plugin
echo_info "Building the plugin..."
cd "$SCRIPT_DIR"
if [[ "${TASKNOTES_E2E_SKIP_BUILD:-0}" != "1" ]]; then
    npm run build
else
    echo_warn "Skipping plugin build; using the existing bundle."
fi

# Step 4: Set up symlinks in the test vault
echo_info "Setting up plugin symlinks in test vault..."
mkdir -p "$PLUGIN_DIR"

# Remove existing symlinks/files
rm -f "$PLUGIN_DIR/main.js" "$PLUGIN_DIR/manifest.json" "$PLUGIN_DIR/styles.css"

# Create symlinks
ln -sf "$SCRIPT_DIR/main.js" "$PLUGIN_DIR/main.js"
ln -sf "$SCRIPT_DIR/manifest.json" "$PLUGIN_DIR/manifest.json"
if [[ -f "$SCRIPT_DIR/styles.css" ]]; then
    ln -sf "$SCRIPT_DIR/styles.css" "$PLUGIN_DIR/styles.css"
fi

echo_info "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run: npm run e2e:launch"
echo "     This will open Obsidian with the test vault."
echo "  2. Enable community plugins in Settings > Community plugins"
echo "  3. Enable the 'TaskNotes' plugin"
echo "  4. Close Obsidian"
echo "  5. Run: npm run e2e"
echo ""
echo_warn "Note: First-time setup requires manual plugin activation."
