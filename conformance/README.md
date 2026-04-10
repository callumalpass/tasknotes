# Conformance Waivers

`npm run conformance:test` in `tasknotes` can skip specific `tasknotes-spec` fixture IDs without editing the shared spec repo.

Configure waivers in [waivers.json](/home/calluma/projects/tasknotes/conformance/waivers.json).

Each waiver must include:

- `id`: fixture id such as `link.0028`
- `scope`: short category such as `host-controlled`, `known-deviation`, or `spec-gap`
- `reason`: short human-readable summary
- `justification`: why the fixture is not currently actionable for TaskNotes

Example:

```json
{
  "waivers": [
    {
      "id": "link.0028",
      "scope": "host-controlled",
      "reason": "Ambiguous simple-name wikilink resolution is delegated to Obsidian",
      "justification": "TaskNotes passes link paths to metadataCache.getFirstLinkpathDest and does not own the final candidate tie-break policy."
    }
  ]
}
```

Behavior:

- The local runner filters waived fixtures after generation and restores the spec fixtures afterward.
- The waiver summary is printed before the test run.
- Waiver ids must match generated fixture ids, and every waiver must include a justification.
