# Historical Lingui migration evidence

These JSON ledgers record one-shot source marking, codemods and audit decisions
for the original Lingui port at `797ebe3a`. They are historical evidence, not
runtime inputs, translation sources, or proof that later changes pass acceptance.
The independent review found data/display boundary errors despite those ledgers.
Current evidence is maintained in `../i18n-acceptance.json` and the review follow-up.

The one-shot mutation tools and unused legacy dictionaries/state manifests were
removed. Their exact sources and translator inputs remain available in Git at
`797ebe3a`; do not rerun them against current POs. Only the diagnostic guard ledger
and the legacy-concept test lookup remain under `scripts/`.

`scripts/reconcile-plugin-audit.mjs` can reconcile these historical rows with a
new source-guard report. This does not establish native or translation acceptance.
