# Downloadable language packs

This opt-in delivery layer serves the shared Lingui UI catalogues. Translation authoring remains in committed PO files; CI validates authored completeness before fallback and exports compiled JSON without AI calls. Normal builds still bundle all ten locales synchronously; the separate NLP configuration in `src/locales/` is unchanged.

## Build modes

- **Ordinary builds:** all supported locales remain bundled. No language-pack endpoint is configured and no language-pack requests occur.
- **Experimental remote builds:** explicitly set `TASKNOTES_LANGUAGE_PACK_BASE_URL`. The bundler includes English only, exports the existing locale resources, and embeds the exact manifest and base URL in the plugin. Available languages still appear in the picker.

Do not configure this for published releases until their packs are available and desktop/mobile acceptance testing is complete.

## Export

```bash
npm run i18n:check
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

The catalogues are JSON **data**, not remotely executable code. `tasknotes-lingui-v1` contains the locale, English source hash and a generated-ID dictionary of compiled ICU arrays, never functions or flat translation strings. It deliberately rejects the obsolete `tasknotes-ui-v1` shape. The manifest contains the product, format, catalogue version, source hash, and each pack's filename, byte length, and SHA-256 digest.

Canonical serialization makes exports reproducible. Changing English or a target translation changes the catalogue version. Re-exporting identical inputs is idempotent. Existing immutable artifacts with different content are rejected. The manifest is written after all locale files.

English defines the authoritative generated-ID set. Export requires exactly all ten supported catalogues and a complete matching ID set in each. Ordinary export/build/test entry points first check extraction sync, authored POs and source guards, then compile; Lingui `--strict` alone is not sufficient because it permits fallback-filled translations. ICU validation preserves argument names/roles, fixed select and exact-number arms, offsets, numeric rich tags and pound bindings while allowing locale-specific plural/ordinal categories. Required plural/ordinal categories are those reached by integer counts 0–999 after the ICU offset; exact `=N` cases match the original count and satisfy a category only when they cover all its representatives in that range. Million-only `many` categories in fr/es/pt/it are optional; the follow-up removes all 90 mechanically added es/fr `many` arms. The plugin mirrors `mdbase-connect` kit `e61ab062`'s coverage rule locally: the kit exposes no standalone coverage helper, and the plugin retains stricter English-source coverage and scoped English-arm rejection. The Italian adoption pins kit `49bea0aa`; this plugin does not consume the shared UI package. There are no legacy suffix-parameter exemptions. Literal template/path/code examples remain protected data. PO is authoritative; use normal clean extraction after integration. The legacy converter and its refresh flags have been retired.

## Local fixture

```bash
npm run i18n:export
python -m http.server 19280 --bind 127.0.0.1 --directory dist/language-packs
```

In another terminal:

```bash
TASKNOTES_LANGUAGE_PACK_BASE_URL=http://127.0.0.1:19280 npm run build
npm run check:bundle-size
```

The requested path is `<base-url>/<catalogue-version>/<locale>.json`. Production hosts must use HTTPS. HTTP is allowed only on localhost/loopback for testing. Credentials, query strings, and fragments are not accepted in the base URL.

The build automatically exports the exact packs corresponding to its embedded manifest. A publisher must upload those same artifacts, not subsequently regenerate a different catalogue and assume compatibility.

## Runtime behaviour

- Startup has English immediately and does not await language-pack downloads.
- If a preferred non-English locale is unloaded, its compatible cache is checked first.
- Cached and downloaded files must match the pinned size, digest, format, locale, source hash, message types, key set, and placeholder contract.
- Only a complete, successfully validated pack is registered and activated. Incomplete or incompatible packs are rejected; failure retains the active language or synchronous English fallback.
- Invalid or unreadable cache triggers a network attempt; it does not silently activate corrupt data.
- Network failure preserves the currently active language. The settings picker includes a retry button in experimental builds.
- Concurrent requests for one locale are deduplicated. A slow result cannot override a newer selection. Unloading the plugin prevents later activation.
- Cache reads and writes each have a one-second best-effort deadline. A failed/stalled read falls through to the network; a failed/stalled write does not prevent activation. Late reads are ignored; late writes persist only the same validated content-addressed bytes.
- No background refresh is scheduled. The download has a 15-second deadline; Obsidian's `requestUrl` transport may finish later, but the timed-out result is not used.
- The 1 MB limit bounds accepted catalogue data, **not transport memory**: `requestUrl` buffers the entire response and does not expose streaming byte limits or cancellation. A broken endpoint may consume excess memory; timed-out retries may leave multiple transfers outstanding. This residual availability risk must be reassessed (with mobile acceptance) before enabling ordinary remote releases.

Cache files live under the installed plugin directory:

```text
<plugin-directory>/language-packs/<pack-sha256>/<locale>.json
```

They are separate from `data.json`. Content-addressed cache keys let an unchanged pack work offline across catalogue releases, even if another language was corrected. Every cached pack is still validated against the new build's pinned manifest. An upgraded build cannot use an incompatible old pack merely because it is in the cache. Old packs remain available for rollback; automatic cache pruning is not yet implemented.

English selection causes no download. System selection may download the detected system language in an experimental build. Requests contain only the artifact path and ordinary connection metadata, not vault content; see `PRIVACY.md`.

## Data and display policy

Persist English seeds for built-in field/group names, default and newly added status/priority labels, reminder descriptions, new calendar subscription names and untitled provider-event fallbacks. Translate only unchanged known seeds at display boundaries. Custom names and already-localized user data pass through untouched. Label inputs show translated defaults, but rendering or leaving an input untouched never writes that translation back. Edited input becomes user-owned text.

Group identities and sort comparisons remain English; HTTP and MCP JSON use those same stable keys. UI adapters translate display labels only. Ambiguous user text such as `None`, `True` and `False` stays verbatim unless raw values or the property schema prove it is an empty/boolean bucket.

The public NLP parser and API/MCP/instant-conversion paths retain the pre-port (`e70b7ba6`) fallback behaviour, including the persisted English `Untitled Task` title. CLI retains its existing missing-title rejection and explicit-title override. A non-enumerable internal missing-title identity lets interactive dialogs reject title-less input without changing public JSON. Both TaskInfo read paths share a localized read-only missing-title fallback; unrelated updates persist patches, not that synthetic title.

Exported prose is deliberately separate from UI copy. `.ics` DESCRIPTION is restored to its exact pre-port English output (including legacy duration spelling); manual and automatic exports therefore do not switch language by device. Google Calendar metadata/duration/title fallbacks also remain English, preserving configured labels and user values verbatim. Generated Bases status/priority formula values remain the configured English/user-authored data; generated instructional labels and count formulas are deliberately localized on generation. Existing Bases files are never regenerated merely by changing interface language. ICS note-creation/template prose remains the previously documented separate deferred policy, not covered by the `.ics` DESCRIPTION decision.

Historical migration ledgers are immutable records, not current classifications or runtime inputs. `i18n-rereview.json` supersedes the retirement classification of 14 built-in field/group descriptors and two new-status/priority display descriptors: all 128 translations were recovered verbatim from the last pre-retirement authored catalogues. Retired converter tooling, archive-rewriting scripts and unused grouping implementations/tests have been removed. The active descriptor map is hand-maintained; PO is the sole authored catalogue source.

## Validation

`npm run check:ci-workflow` replays the checked-in `.github/workflows/test.yml` shell commands verbatim under Node 22. Run it through `rpnpm --pull dist --pull coverage run check:ci-workflow`. It includes npm installs, coverage, integration, docs, lint, both workflow build jobs and export. It does not dispatch Actions, change workflow triggers/base, provide OAuth secrets, or claim acceptance of checkout/setup/upload actions. The Node-20-only performance step remains skipped under the existing Node-22 matrix. Evidence is `dist/ci-workflow-parity.json`.

```bash
node generate-release-notes-import.mjs
npm run typecheck
npm run check:language-pack-builds # Both production modes and size budgets; restores the bundled build
npm run test:language-packs
npm run test:unit -- --runInBand --runTestsByPath \
  tests/unit/services/i18nService.test.ts \
  tests/unit/services/languagePackLoader.test.ts \
  tests/unit/services/languagePackController.test.ts
```

The standalone script suite exercises real locale exports and local HTTP delivery, offline cache reuse after loader restart, version isolation, immutable exports, and English-only build graph isolation. Unit tests cover malformed data, integrity failures, placeholders, unsupported locales, cache failures, retries, timeouts, switching races, and plugin unload.

For native Obsidian acceptance testing, use only the repository's isolated test vault and user-data directory. Never copy this build into a personal vault or reuse a normal running Obsidian instance. With the isolated Obsidian runtime set up, the following test starts its own local HTTP fixture (do not start another server on that port):

```bash
BASE_URL=http://127.0.0.1:19290/tasknotes
TASKNOTES_LANGUAGE_PACK_BASE_URL="$BASE_URL" \
  OBSIDIAN_PLUGIN_PATH="$PWD/tasknotes-e2e-vault/.obsidian/plugins/tasknotes" \
  npm run build:test
TASKNOTES_LANGUAGE_PACK_BASE_URL="$BASE_URL" \
  TASKNOTES_E2E_REUSE_OBSIDIAN=0 \
  TASKNOTES_E2E_REMOTE_DEBUGGING_PORT=19291 \
  npm run e2e -- e2e/language-packs.spec.ts
```

The tests exercise French download/offline reload, corrupt German delivery/retry and Russian supersession, then native en/ja/de/ru labels, plurals at 0/1/2/5/21 and preservation of existing user-authored Bases files. They also corrupt the Russian cache while offline, require English fallback, and verify explicit retry repairs the pinned cache. Fixture settings are restored even when a test fails. A further en/it/de/ru regression uses real native Kanban pointer drags and creation modals: empty drops remove properties, boolean drops/creation write booleans, empty-column creation does not seed a translated status, and stable saved ordering survives language switches. Its disposable fixture folder is removed in `finally`. The bundled native re-review additionally checks all 14 field/group labels, translated status/priority label inputs without writes, real completed-date grouping/sorting, baseline instant-conversion fallback, and interactive missing-title rejection in English, Italian and German. All fixtures use the isolated vault/profile and are restored/removed in `finally`.

For minified production acceptance, use the preserved artifacts from `npm run check:language-pack-builds "$BASE_URL"` rather than a development build. Copy `dist/language-pack-builds/downloadable/{main.js,styles.css}` into the isolated plugin directory with `cp --remove-destination` (never follow a symlink into another checkout), then run the pack tests above. Copy the corresponding **bundled** artifacts into that same disposable directory and run:

```bash
# No remote base URL: all ten synchronously decoded catalogues must be present.
(unset TASKNOTES_LANGUAGE_PACK_BASE_URL
 TASKNOTES_E2E_REUSE_OBSIDIAN=0 TASKNOTES_E2E_REMOTE_DEBUGGING_PORT=19291 \
   npm run e2e -- e2e/lingui-bundled.spec.ts --output=test-results/bundled)
```

The bundled test cold-starts Italian, asserts ten loaded locales, and checks native en/it/ja/de/ru picker/command labels and 0/1/2/5/21 forms. Its Italian/German control test also checks visible release dates, persisted UI/NLP pickers and Italian NLP fill-form without creating a task. Both modes also run the same en/it/de/ru group-identity regression. Reports and native screenshots are written under `test-results/lingui-native` and `test-results/lingui-bundled`; each mode's `review/review-report.json` records the actual frontmatter and saved order.

`npm run test:fresh-catalogues` removes only ignored generated JSON, typechecks before regeneration, runs ordinary strict Jest, removes JSON again and builds/checks documentation. Authored POs are never deleted or fallback-filled by that acceptance command. Development requires Node 22.22+ and initialized `docs/spec` (`git submodule update --init --checkout docs/spec`).

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

Historical evidence: the pre-Lingui keyed-resource delivery layer passed this test on Android 16 / API 36 with Obsidian 1.13.8. This is not current Lingui-port Android acceptance, iOS validation, physical-device performance testing, or a complete older-Android compatibility matrix.

## R2 hosting and publication

The public host is `https://i18n.mdbase.dev`, with TaskNotes assets under `/tasknotes/<catalogue-version>/`. The dedicated `product-language-packs` bucket contains public translation data only, never notes or credentials. Target account, bucket, domain, zone and TLS policy are recorded in `infra/language-packs.json`; read-only wildcard CORS is in `infra/language-packs.cors.json`. The exporter also emits English for reference, but the plugin never downloads English.

```bash
npm run i18n:check
npm run i18n:publish                 # Local dry run; no cloud writes or authentication
npm run i18n:publish -- --verify     # Verify public bytes and HTTP metadata; no cloud writes
npm run i18n:publish -- --apply      # Operator-only Wrangler path; serialize publishers
npm run i18n:publish -- --apply-s3   # Atomic create-if-absent with explicit bucket-scoped credentials
```

`--apply` verifies the account-pinned bucket and preflights every object against the authenticated origin, not the CDN. Conflicting existing bytes abort before any upload; identical objects are reused. Locale JSON and the MIT license are uploaded first, their public hashes/MIME types/cache headers/CORS are checked, and the immutable versioned manifest is published last. Retain versions needed by installed releases; there is no automatic deletion and the plugin does not consume a global `/latest` catalogue.

All versioned files use `Cache-Control: public, max-age=31536000, immutable`. CORS permits only public GET/HEAD without credentials. TLS minimum is 1.2; the rate-limited `r2.dev` development URL is not enabled. JSON is not edge-cache eligible by default: current responses show `CF-Cache-Status: DYNAMIC`. A host-scoped Cache Rule is a follow-up optimization, not a prerequisite for local caching or offline use.

The operator `--apply` path uses Wrangler's existing OAuth/API-token authentication, kept in process memory with debug-file logging explicitly disabled. Its origin preflight is **not atomic**: serialize these publishers. It is not the CI path.

### Atomic S3 publication and CI activation

`--apply-s3` uses the account-pinned R2 endpoint and region `auto`. It requires `LANGUAGE_PACK_R2_ACCESS_KEY_ID` and `LANGUAGE_PACK_R2_SECRET_ACCESS_KEY`; there is no AWS default credential chain, arbitrary endpoint, or fallback to personal Wrangler credentials. Use an R2 **Object Read & Write** credential scoped only to `product-language-packs`, not an account-administration token. An optional `LANGUAGE_PACK_R2_SESSION_TOKEN` supports operator temporary credentials.

Every PUT includes `If-None-Match: *`. Identical concurrent creates are reconciled against the authenticated, strongly consistent origin. Conflicting bytes, missing buckets, permission failures and unsupported conditions fail closed. An uncertain response is inspected at the origin before proceeding, never retried as an unconditional overwrite. Nothing is deleted. Data objects are still publicly verified before manifest publication; upload counts treat identical/reconciled races as reuse.

`.github/workflows/publish-language-packs.yml` is a separate manual-dispatch workflow, restricted to `main` with an affirmative publication input and non-cancelling concurrency. Before use:

1. Review and merge the implementation through the ordinary repository process.
2. Configure GitHub environment `language-packs-production` with required reviewers and a main-only deployment rule. Merely naming an environment in YAML does not establish those protections.
3. In Cloudflare R2 → Manage API Tokens, create an **account-owned Object Read & Write** token scoped only to `product-language-packs`. Account-token creation needs `Account API Tokens Write`; the existing Wrangler OAuth session does not have it. Do not substitute broad OAuth/account credentials. Install the resulting Access Key ID and Secret Access Key through GitHub CLI's interactive secret prompts (never paste into code, logs or chat):

    ```bash
    gh secret set LANGUAGE_PACK_R2_ACCESS_KEY_ID --repo callumalpass/tasknotes --env language-packs-production
    gh secret set LANGUAGE_PACK_R2_SECRET_ACCESS_KEY --repo callumalpass/tasknotes --env language-packs-production
    ```

    The named GitHub environment has been configured with a required `callumalpass` review and an exact `main` **branch** deployment rule. Self-review is allowed for the sole maintainer; this is an explicit owner-approval gate, not an independent second-reviewer guarantee. Bucket-scoped keys were installed on October 6, 2026; rotate them before their October 6, 2027 expiry.

4. Dispatch at the exact reviewed main commit, approve the environment, and verify the source/catalogue receipt and candidate artifact.

The workflow checks committed translations without AI calls, runs strict lint/typecheck/unit/export tests, builds and size-checks an explicitly remote candidate before cloud writes, conditionally publishes and verifies, and records the pinned public manifest URL. Its experimental candidate is an artifact, **not a plugin release**. Credentials are present only in the publish step. The protected GitHub environment is now configured and read back. The workflow is not on remote main and no CI publication has run. Bucket-scoped S3 credentials were installed on October 6, 2026, and live conditional-create/reuse acceptance passed; this does not authorize dispatching the workflow.

Ordinary CI/release builds remain fully bundled. Integrating the publication step into a normal plugin release and enabling the remote URL remain separate release decisions.

## Follow-up

- Older/physical Android and additional desktop upgrade/failure scenarios. iOS testing was explicitly waived by the user; iOS compatibility remains an unverified assumption, not a passed check.
- After merge and separate owner authorization, activate protected-environment S3 publication using the installed bucket-scoped credentials.
- A Cache Rule scoped only to the language-pack host, enabling edge caching of JSON.
- Optional cache pruning that preserves the current catalogue.
- Current Lingui-build mobile acceptance before ordinary remote releases; desktop evidence does not establish mobile compatibility.
- Shared glossary and local agent workflow conventions across the initiative workspace.
