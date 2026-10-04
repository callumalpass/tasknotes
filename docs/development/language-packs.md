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

The test exercises native picker switching, French download, offline plugin reload, corrupt German data and retry, and a superseded Russian request. It restores the fixture's settings afterward. Mobile acceptance remains a separate requirement.

## Publication boundary

CI tests and exports catalogues and attaches them to its build artifact. It does not currently publish to R2. The normal CI/release build remains fully bundled.

Future publication should upload immutable locale objects first, verify them, and publish the manifest last, with an appropriate cache policy. Retain versions needed by installed plugin releases. No global `/latest` catalogue is consumed by the plugin.

## Follow-up

- Mobile acceptance coverage and additional desktop upgrade/failure scenarios.
- Guarded Cloudflare publication with an explicit production host and least-privilege credentials.
- Optional cache pruning that preserves the current catalogue.
- Lingui/generated-ID migration as a separate change, after a representative pilot.
- Shared glossary and local agent workflow conventions across the initiative workspace.
