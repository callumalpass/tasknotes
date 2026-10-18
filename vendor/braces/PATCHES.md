# TaskNotes-maintained braces fork

Upstream: `braces@3.0.3`, https://github.com/micromatch/braces (MIT; see LICENSE).
Source archive: https://registry.npmjs.org/braces/-/braces-3.0.3.tgz
Archive integrity: `sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==`.
`UPSTREAM-SHA256.json` records the original source-file hashes before modification.

This private fork is named `@tasknotes/braces`, version `3.0.3-tasknotes.1`.
The root development dependency and `$braces` override route all consumers to
this directory. It is not an upstream release and must not be published as one.

## Security change

Addresses GHSA-vfj7-8cjw-p6xm / CVE-2026-93687: recursive AST walkers can exhaust
the JavaScript stack with deeply nested patterns below the existing input-length
limit. Upstream compile reproduced `RangeError: Maximum call stack size exceeded`
with 4,000 nested braces around one character (8,001 characters total).

- New `lib/depth.js` enforces a hard limit of 128 nested containers.
- `lib/parse.js` checks the parser stack before opening either a brace or a
  parenthesis, including mixed nesting and unclosed patterns. Quoted and escaped
  delimiters retain their existing literal behavior.
- `lib/{compile,expand,stringify}.js` validate child-edge AST depth iteratively
  before recursion, covering callers that supply their own ASTs or import these
  modules directly. Cycles through child edges are rejected as malformed ASTs.
- The ceiling cannot be disabled through caller options. Excess nesting throws
  `SyntaxError` with code `ERR_BRACES_MAX_DEPTH`; child cycles use
  `ERR_BRACES_AST_CYCLE`. This is deliberate input rejection, not a promise that
  arbitrary hostile AST objects or all resource-exhaustion patterns are safe.
- Existing length and expansion-range limits remain unchanged.

Other upstream runtime files and the MIT license are retained unchanged. Package
metadata is reduced to the private fork's runtime requirements. Upstream README
examples are retained for reference; the new depth restriction takes precedence.

## Verification and maintenance

Run `npm ci`, `node --test scripts/braces-security.test.mjs`, all Jest suites,
strict source/generated-CSS lint, typecheck, docs/build and dependency checks.
The regression suite includes bounded subprocess attack tests, depth boundaries,
normal glob/range behavior, direct AST calls, and installed-consumer resolution.

**npm audit does not evaluate this local fork against registry advisories.** A
clean registry audit is not evidence that this patch is correct; the source
review and regression tests are required independently. Do not rename/reversion
an unpatched library merely to remove an audit finding.

When upstream publishes a fixed version, review its fixes, run these same tests
against it, and remove the local dependency/override and vendor directory in a
separate reviewed change. Keep this fork limited to the documented security fix.
