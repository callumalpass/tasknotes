# Internationalization (i18n) CI/CD System

This project uses an automated CI/CD system to ensure translation consistency and prevent missing translations from being deployed.

## 📋 Overview

The i18n system tracks:
- **Manifest**: Hashes of all English (source) strings
- **State**: Translation status for each locale
- **CI Enforcement**: Automatic verification in GitHub Actions

## 🚀 Quick Start

### For Developers

When you modify English strings in `src/i18n/resources/en.ts`:

```bash
# 1. Edit the English translation file
vim src/i18n/resources/en.ts

# 2. Update the manifest and state files
npm run i18n:sync

# 3. Commit all changes (including generated files)
git add src/i18n/resources/en.ts i18n.manifest.json i18n.state.json
git commit -m "feat: add new translation keys for feature X"
```

### For Translators

To translate strings to another language:

```bash
# 1. Check what needs translation
npm run i18n:verify

# 2. Edit the translation file (e.g., French)
vim src/i18n/resources/fr.ts

# 3. Update state to mark translations as current
npm run i18n:sync

# 4. Commit your changes
git add src/i18n/resources/fr.ts i18n.state.json
git commit -m "feat: add French translations for feature X"
```

## 📜 Available Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run i18n:sync` | Update manifest and state files | After changing ANY translation files |
| `npm run i18n:verify` | Check for missing/stale translations | Before releasing (fails on issues) |
| `npm run i18n:status` | Show translation coverage summary | To check overall progress |

## 🔍 How It Works

### 1. Manifest File (`i18n.manifest.json`)
Contains SHA1 hashes of all English strings:
```json
{
  "common.appName": "6458145fdd07ad08ff52a2e72d531588936bdca6",
  "common.cancel": "77dfd2135f4db726c47299bb55be26f7f4525a46"
}
```

### 2. State File (`i18n.state.json`)
Tracks translation status for each locale:
```json
{
  "fr": {
    "common.appName": "6458145fdd07ad08ff52a2e72d531588936bdca6",  // ✅ Up-to-date
    "common.cancel": ""                                            // ❌ Missing
  }
}
```

### 3. CI/CD Enforcement
The GitHub Actions workflow automatically:
- Runs `npm run i18n:sync` on every PR/push
- Fails the build if manifest/state files are out of date
- Forces developers to commit synchronized files

## 🔄 Workflow Examples

### Adding a New English String

```bash
# 1. Add to en.ts
export const en = {
  common: {
    newFeature: 'My new feature'  // ← Add this
  }
}

# 2. Sync
npm run i18n:sync
# ✓ Generated manifest from "en.ts" with 1210 keys.
# ✓ Updated state for locales: fr.

# 3. Check status
npm run i18n:status
# fr: 99% translated, 0% stale  (1 new missing key)

# 4. Commit everything
git add src/i18n/resources/en.ts i18n.manifest.json i18n.state.json
git commit -m "feat: add newFeature translation key"
```

### Translating to French

```bash
# 1. See what needs translation
npm run i18n:verify
# ❌ Missing translations:
#   [fr] 1 missing keys:
#     - common.newFeature

# 2. Add French translation
# Edit fr.ts and add: newFeature: 'Ma nouvelle fonctionnalité'

# 3. Mark as current
npm run i18n:sync
# ✓ Updated state for locales: fr.

# 4. Verify completion
npm run i18n:verify
# ✅ All translations are up-to-date.

# 5. Commit
git add src/i18n/resources/fr.ts i18n.state.json
git commit -m "feat: add French translation for newFeature"
```

### When English String Changes

```bash
# 1. Modify existing English string
# Change "My new feature" → "My awesome feature"

# 2. Sync (this marks French as stale)
npm run i18n:sync

# 3. Check status
npm run i18n:verify
# ⚠️  Stale translations (source text changed):
#   [fr] 1 stale keys:
#     - common.newFeature

# 4. Update French translation
# Edit fr.ts: "Ma nouvelle fonctionnalité" → "Ma fonctionnalité géniale"

# 5. Mark as current
npm run i18n:sync

# 6. Commit all changes
git add src/i18n/resources/en.ts src/i18n/resources/fr.ts i18n.manifest.json i18n.state.json
git commit -m "feat: improve newFeature translation"
```

## 🛠️ Technical Details

### File Structure
```
├── scripts/i18n-manager.mjs     # Core management script
├── i18n.manifest.json           # Source string hashes
├── i18n.state.json              # Translation state tracking
├── src/i18n/resources/
│   ├── en.ts                    # English (source) translations
│   └── fr.ts                    # French translations
└── .github/workflows/test.yml   # CI/CD enforcement
```

### Translation Detection Logic

The system considers a translation:
- **Missing**: Key doesn't exist in translation file
- **Untranslated**: Value is identical to English source
- **Stale**: Source hash doesn't match state hash
- **Current**: Source hash matches state hash

### CI/CD Integration

The workflow step in `.github/workflows/test.yml`:
```yaml
- name: Check i18n manifest is up-to-date
  run: |
    npm run i18n:sync
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "❌ Error: i18n files are out of date"
      exit 1
    fi
```

This ensures:
- No untranslated strings slip into production
- Translation state is always tracked
- Developers must explicitly acknowledge translation needs

## 🎯 Best Practices

1. **Always run `npm run i18n:sync`** after modifying translation files
2. **Commit generated files** (`i18n.manifest.json`, `i18n.state.json`) with your changes
3. **Use descriptive keys** like `features.taskList.emptyState` instead of generic ones
4. **Group related translations** using nested objects for better organization
5. **Test locally** with `npm run i18n:verify` before pushing

## 🐛 Troubleshooting

**CI fails with "i18n files are out of date"**
```bash
npm run i18n:sync
git add i18n.manifest.json i18n.state.json
git commit -m "chore: update i18n manifest and state files"
```

**"Could not load source locale" error**
- Check that `src/i18n/resources/en.ts` exists and has valid syntax
- Ensure the export follows the pattern: `export const en = { ... }`

**Wrong translation statistics**
- Run `npm run i18n:sync` to recalculate
- Check that translated strings are actually different from English

## 📈 Translation Progress

Use these commands to track progress:

```bash
# Quick overview
npm run i18n:status

# Detailed missing/stale report
npm run i18n:verify

# After making changes
npm run i18n:sync
```

---

This system ensures translation quality and consistency while making the workflow as smooth as possible for both developers and translators.