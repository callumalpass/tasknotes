# Downloadable language packs

This is an opt-in delivery layer for the existing TaskNotes translation system, not a Lingui migration or a hosted translation-management platform. Translation authoring runs locally; CI validates and exports committed resources without AI calls.

## Build modes

- **Ordinary builds:** all supported locales remain bundled. No language-pack endpoint is configured and no language-pack requests occur.
- **Experimental remote builds:** explicitly set `TASKNOTES_LANGUAGE_PACK_BASE_URL`. The bundler includes English only, exports the existing locale resources, and embeds the exact manifest and base URL in the plugin. Available languages still appear in the picker.

Do not configure this for published releases until their packs are available and desktop/mobile acceptance testing is complete.

## Export

```bash
npm run i18n:verify
npm run i18n:export
```

For machine-readable manifest and output-directory information, use `node scripts/export-language-packs.mjs --json`.

Optional output directory:

```bash
npm run i18n:export -- /path/to/output
```

The exporter writes:

```text
dist/language-packs/<catalogue-version>/
  en.json
  fr.json
  de.json
  ...
  manifest.json
```

The catalogues are JSON **data**, not remotely executable code. They contain a format identifier, locale, English source hash, and flat message dictionary. The manifest contains the product, format, catalogue version, source hash, and each pack's filename, byte length, and SHA-256 digest.

Canonical serialization makes exports reproducible. Changing English or a target translation changes the catalogue version. Re-exporting identical inputs is idempotent. Existing immutable artifacts with different content are rejected. The manifest is written after all locale files.

English defines the authoritative key set. Obsolete keys remaining in old target resources are excluded from exported packs; the original source files are not rewritten. Placeholder validation rejects missing semantic parameters and invented parameters. Explicit legacy exceptions permit languages to omit English grammatical suffixes such as `{plural}` where appropriate. Double-brace template examples in descriptions are not treated as interface interpolation values.

## Local fixture

```bash
npm run i18n:export
python -m http.server 8123 --bind 127.0.0.1 --directory dist/language-packs
```

In another terminal:

```bash
TASKNOTES_LANGUAGE_PACK_BASE_URL=http://127.0.0.1:8123 npm run build
npm run check:bundle-size
```

The requested path is `<base-url>/<catalogue-version>/<locale>.json`. Production hosts must use HTTPS. HTTP is allowed only on localhost/loopback for testing. Credentials, query strings, and fragments are not accepted in the base URL.

The build automatically exports the exact packs corresponding to its embedded manifest. A publisher must upload those same artifacts, not subsequently regenerate a different catalogue and assume compatibility.

## Runtime behaviour

- Startup has English immediately and does not await language-pack downloads.
- If a preferred non-English locale is unloaded, its compatible cache is checked first.
- Cached and downloaded files must match the pinned size, digest, format, locale, source hash, message types, key set, and placeholder contract.
- Only a successfully validated pack is registered and activated. Missing target messages fall back to bundled English.
- Invalid or unreadable cache triggers a network attempt; it does not silently activate corrupt data.
- Network failure preserves the currently active language. The settings picker includes a retry button in experimental builds.
- Concurrent requests for one locale are deduplicated. A slow result cannot override a newer selection. Unloading the plugin prevents later activation.
- A failed cache write does not prevent using a validated pack in the current session.
- No background refresh is scheduled. The download has a 15-second deadline; Obsidian's `requestUrl` transport may finish later, but the timed-out result is not used.

Cache files live under the installed plugin directory:

```text
<plugin-directory>/language-packs/<pack-sha256>/<locale>.json
```

They are separate from `data.json`. Content-addressed cache keys let an unchanged pack work offline across catalogue releases, even if another language was corrected. Every cached pack is still validated against the new build's pinned manifest. An upgraded build cannot use an incompatible old pack merely because it is in the cache. Old packs remain available for rollback; automatic cache pruning is not yet implemented.

English selection causes no download. System selection may download the detected system language in an experimental build. Requests contain only the artifact path and ordinary connection metadata, not vault content; see `PRIVACY.md`.

## Validation

```bash
node generate-release-notes-import.mjs
npm run typecheck
npm run test:language-packs
npm run test:unit -- --runInBand --runTestsByPath \
  tests/unit/services/i18nService.test.ts \
  tests/unit/services/languagePackLoader.test.ts \
  tests/unit/services/languagePackController.test.ts
```

The standalone script suite exercises real locale exports and local HTTP delivery, offline cache reuse after loader restart, version isolation, immutable exports, and English-only build graph isolation. Unit tests cover malformed data, integrity failures, placeholders, unsupported locales, cache failures, retries, timeouts, switching races, and plugin unload.

For native Obsidian acceptance testing, use only the repository's isolated test vault and user-data directory. Never copy this build into a personal vault or reuse a normal running Obsidian instance. With the isolated Obsidian runtime set up, the following test starts its own local HTTP fixture (do not start another server on that port):

```bash
BASE_URL=http://127.0.0.1:18452/tasknotes
TASKNOTES_LANGUAGE_PACK_BASE_URL="$BASE_URL" \
  OBSIDIAN_PLUGIN_PATH="$PWD/tasknotes-e2e-vault/.obsidian/plugins/tasknotes" \
  npm run build:test
TASKNOTES_LANGUAGE_PACK_BASE_URL="$BASE_URL" \
  TASKNOTES_E2E_REUSE_OBSIDIAN=0 \
  TASKNOTES_E2E_REMOTE_DEBUGGING_PORT=18453 \
  npm run e2e -- e2e/language-packs.spec.ts
```

The test exercises native picker switching, French download, offline plugin reload, corrupt German data and retry, and a superseded Russian request. It restores the fixture's settings afterward.

### Actual Android acceptance

`npm run e2e:android:language-packs` operates the **real Obsidian Android app**, not a desktop mobile-mode simulation. It uses Playwright's experimental Android WebView support plus explicitly targeted ADB operations. It refuses physical devices, AVDs not named `tasknotes-language-packs`, and vaults without the exact fixture identity. It restores emulator networking after the test. The vault and all cache changes are disposable test data.

Prerequisites: Android SDK, KVM (or another supported accelerator), an installed Android 36 x86_64 image, and the official Obsidian Android APK. Register a fresh AVD under this worktree, never reuse a personal AVD:

```bash
export ANDROID_AVD_HOME="$PWD/.tmp/android-avd"
mkdir -p "$ANDROID_AVD_HOME"
avdmanager create avd --name tasknotes-language-packs \
  --package 'system-images;android-36;google_apis_playstore;x86_64' \
  --device pixel_7 --path "$ANDROID_AVD_HOME/tasknotes-language-packs.avd"
emulator -avd tasknotes-language-packs -port 5574 -no-snapshot \
  -no-window -no-audio -gpu swiftshader -memory 2048 -cores 2
```

In another terminal, install the official APK on **only** `emulator-5574`. Complete onboarding without Sync, creating a device-storage vault named `TaskNotesLanguagePacks` under `Documents`. Trust only the locally built TaskNotes plugin in this disposable vault. Then:

```bash
PLAYWRIGHT_SKIP_BROWSER_GC=1 npx --no-install playwright install android
TASKNOTES_LANGUAGE_PACK_BASE_URL=https://i18n.mdbase.dev/tasknotes npm run build
SERIAL=emulator-5574
VAULT=/sdcard/Documents/TaskNotesLanguagePacks
adb -s "$SERIAL" emu avd name # Must be tasknotes-language-packs
adb -s "$SERIAL" push e2e/fixtures/android-language-pack-vault-identity.txt "$VAULT/vault-identity.txt"
adb -s "$SERIAL" shell am force-stop md.obsidian
adb -s "$SERIAL" shell mkdir -p "$VAULT/.obsidian/plugins/tasknotes"
for FILE in main.js styles.css manifest.json; do
  adb -s "$SERIAL" push "$FILE" "$VAULT/.obsidian/plugins/tasknotes/$FILE"
done
adb -s "$SERIAL" push e2e/fixtures/android-language-pack-data.json "$VAULT/.obsidian/plugins/tasknotes/data.json"
adb -s "$SERIAL" shell am start -W -n md.obsidian/.MainActivity
# Enable TaskNotes in this vault's Community plugins settings if not already enabled.
npm run e2e:android:language-packs
```

Repeat runs must begin with the fixture's English settings and no previously downloaded German pack. Reset only this disposable vault's generated `language-packs/` cache while Obsidian is stopped. Never use these reset commands against a personal vault. The fixture suppresses the starter-note walkthrough so it cannot dismiss the settings screen mid-test.

Evidence is written to `.tmp/android-language-packs/`: a structured report and native screenshots. The test verifies real mobile storage and WebCrypto, French picker download from public R2, offline full app force-stop/relaunch and translated commands, an uncached German failure preserving French, recovery through the retry button, every remaining target locale, and rejection/repair of a same-length corrupted French cache. Reconnection waits for real connectivity and tolerates native DNS negative-cache expiry; no transport or platform flag is mocked.

Android 16 / API 36 with Obsidian 1.13.8 passed this acceptance test. This is not iOS validation, physical-device performance testing, or a complete older-Android compatibility matrix.

## R2 hosting and publication

The public host is `https://i18n.mdbase.dev`, with TaskNotes assets under `/tasknotes/<catalogue-version>/`. The dedicated `product-language-packs` bucket contains public translation data only, never notes or credentials. Target account, bucket, domain, zone and TLS policy are recorded in `infra/language-packs.json`; read-only wildcard CORS is in `infra/language-packs.cors.json`. The exporter also emits English for reference, but the plugin never downloads English.

```bash
npm run i18n:verify
npm run i18n:publish                 # Local dry run; no cloud writes or authentication
npm run i18n:publish -- --verify     # Verify public bytes and HTTP metadata; no cloud writes
npm run i18n:publish -- --apply      # Explicitly publish using authenticated project-local Wrangler
```

`--apply` verifies the account-pinned bucket and preflights every object against the authenticated origin, not the CDN. Conflicting existing bytes abort before any upload; identical objects are reused. Locale JSON and the MIT license are uploaded first, their public hashes/MIME types/cache headers/CORS are checked, and the immutable versioned manifest is published last. Retain versions needed by installed releases; there is no automatic deletion and the plugin does not consume a global `/latest` catalogue.

All versioned files use `Cache-Control: public, max-age=31536000, immutable`. CORS permits only public GET/HEAD without credentials. TLS minimum is 1.2; the rate-limited `r2.dev` development URL is not enabled. JSON is not edge-cache eligible by default: current responses show `CF-Cache-Status: DYNAMIC`. A host-scoped Cache Rule is a follow-up optimization, not a prerequisite for local caching or offline use.

The current operator publisher uses Wrangler's existing OAuth/API-token authentication, kept in process memory and never logged or committed. Its origin preflight is **not an atomic conditional create**: serialize publishers. Before automatic CI publication, add an S3 conditional-write backend and bucket-scoped Object Read & Write credentials. Bucket-item tokens work with the S3 API, not Wrangler's Cloudflare REST API; do not export a personal OAuth token or grant an account-wide administration token to CI.

CI tests and exports catalogues and attaches them to its build artifact. It does not currently publish to R2. The normal CI/release build remains fully bundled; setting up this host does not authorize a plugin release or enable the release-build URL automatically.

## Follow-up

- iOS and older/physical Android acceptance, plus additional desktop upgrade/failure scenarios.
- S3 conditional-create publication with bucket-scoped CI credentials and serialized releases.
- A Cache Rule scoped only to the language-pack host, enabling edge caching of JSON.
- Optional cache pruning that preserves the current catalogue.
- Lingui/generated-ID migration as a separate change, after a representative pilot.
- Shared glossary and local agent workflow conventions across the initiative workspace.
