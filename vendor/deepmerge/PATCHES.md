# TaskNotes-maintained deepmerge fork

Private development-only fork of `deepmerge@4.3.1` (MIT; see license.txt).
Upstream: https://github.com/TehShrike/deepmerge
Archive: https://registry.npmjs.org/deepmerge/-/deepmerge-4.3.1.tgz
Integrity: `sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A==`.
`UPSTREAM-SHA256.json` records the original distributed-file hashes.

## Security change

GHSA-gcqx-w48m-w2h4 / CVE-2026-93753: assigning an enumerable own `__proto__`
key from the target, or from a source merged into a null-prototype target, can
invoke the inherited setter on the fresh destination object. Its prototype then
contains attacker-controlled values.

`index.js`, `dist/cjs.js` and `dist/umd.js` now write destination keys through
`Object.defineProperty` with ordinary writable/enumerable/configurable data
property descriptors. Existing source-key filtering and merge/clone options
remain unchanged. Dangerous-looking keys are not broadly deleted: an allowed
`__proto__` becomes own data, never a prototype mutation. Symbols retain their
usual behavior. Caller-supplied getters/custom merge functions are not sandboxed.

The root development dependency and `$deepmerge` override route Jest to this
private package. It is not an upstream release and must not be published as one.

## Verification and maintenance

Run `node --test scripts/dependency-security.test.mjs` and all Jest suites.
Regressions exercise malicious target/source/nested data, null-prototype input,
CommonJS/UMD builds, normal arrays/options/symbols and installed Jest resolution.

**npm audit does not evaluate this local fork against registry advisories.** Do
not treat its absence from audit results as proof of a fix. Replace it with a
reviewed upstream fix when available, rerun regressions and remove the override.
