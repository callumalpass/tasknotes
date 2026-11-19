# TaskNotes-maintained Zod compatibility fork

This private package preserves the Zod 3 root API required by `@tasknotes/model`
and `zod-to-json-schema`, while providing the MCP SDK's Zod 4 entry points from
upstream **4.6.6**, which fixes GHSA-mrhx-c7xc-m3w5. It must not be published as an
upstream Zod release.

## Upstream inputs (MIT; see LICENSE)

- `zod@3.25.76`: https://registry.npmjs.org/zod/-/zod-3.25.76.tgz
  Integrity: `sha512-gzUt/qt81nXsFGKIFcC3YnfEAx5NkunCfnDlvuBSSFS02bcXu4Lmea0AFIUwbLWxWPx3d9p8S5QoaujKcNQxcQ==`.
  Supplies root entry points, `v3/`, README and license.
- `zod@4.6.6`: https://registry.npmjs.org/zod/-/zod-4.6.6.tgz
  Integrity: `sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA==`.
  Supplies `v4/` and `v4-mini/`, unchanged.

`UPSTREAM-SHA256.json` records distributed files before modification. Source-only
export conditions and build scripts are removed: the vendored package contains
runtime JS and declarations, not the upstream TypeScript build tree. All ordinary
ESM/CommonJS entry points remain available. The root dependency and `$zod`
override route the plugin, model, JSON Schema adapter and MCP SDK to this package.

## Security backport

Upstream fix: https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd

In `v3/types.js` and `v3/types.cjs`, oversized arrays (`max` or the upper side of
`length`) and sets (`max`/`size`) abort immediately after adding the existing
size issue, before copying/walking entries or running element/outer refinements.
This mirrors upstream's constrained-container rejection, retaining the v3 API,
issue code, message and path. Undersized inputs retain existing behavior. V3
maps have no size-bound API. Unconstrained collections are still unbounded, as
with upstream's fix; this is not a general input-size or recursion limit.

The shipped Zod 4 code already contains upstream's size gates for arrays, sets,
maps and compiled validation. No Zod 4 code is locally modified.

## Verification and maintenance

Run `node --test scripts/dependency-security.test.mjs`, all strict Jest and
conformance suites, typecheck, builds and bundle/dependency checks. Tests cover
ESM/CommonJS, aliases, async rejection before callbacks, nested error paths,
valid collections and installed-consumer resolution; provenance tests ensure
only the documented v3 runtime files differ from upstream hashes.

**npm audit does not evaluate local forks against registry advisories.** A zero
registry audit is not proof of this backport; review and regressions are required.
When the model supports a fixed upstream Zod version, replace this package and
remove the override after rerunning compatibility and security tests.
