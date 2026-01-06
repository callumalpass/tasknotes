#!/bin/bash
set -eu -o pipefail

# E2E Test Setup Script for Linux
# Adapted from biblib for tasknotes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OBSIDIAN_APPIMAGE="${1:-$HOME/Applications/Obsidian-1.8.10.AppImage}"
OBSIDIAN_DATA_DIR="$HOME/.config/obsidian"
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

# Find the latest obsidian.asar in the data directory
OBSIDIAN_ASAR=$(ls -t "$OBSIDIAN_DATA_DIR"/obsidian-*.asar 2>/dev/null | head -1)
if [[ -z "$OBSIDIAN_ASAR" ]]; then
    echo_error "No obsidian.asar found in $OBSIDIAN_DATA_DIR"
    exit 1
fi
echo_info "Using Obsidian ASAR: $OBSIDIAN_ASAR"

# Step 1: Extract AppImage to get Electron
echo_info "Extracting Obsidian AppImage..."
TEMP_EXTRACT="/tmp/obsidian-appimage-extract-$$"
rm -rf "$TEMP_EXTRACT"
cd /tmp
"$OBSIDIAN_APPIMAGE" --appimage-extract > /dev/null 2>&1
mv squashfs-root "$TEMP_EXTRACT"

# Step 2: Unpack the ASAR
echo_info "Unpacking Obsidian ASAR..."
rm -rf "$UNPACKED_DIR"
mkdir -p "$UNPACKED_DIR"

# Copy Electron files from extracted AppImage
cp -r "$TEMP_EXTRACT"/* "$UNPACKED_DIR/"

# Unpack the main obsidian.asar
npx @electron/asar extract "$OBSIDIAN_ASAR" "$UNPACKED_DIR/resources/app"

# Also extract the app.asar loader if it exists
if [[ -f "$UNPACKED_DIR/resources/app.asar" ]]; then
    npx @electron/asar extract "$UNPACKED_DIR/resources/app.asar" "$UNPACKED_DIR/resources/app-loader"
fi

# Clean up temp extraction
rm -rf "$TEMP_EXTRACT"

# Step 3: Build the plugin
echo_info "Building the plugin..."
cd "$SCRIPT_DIR"
npm run build

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
