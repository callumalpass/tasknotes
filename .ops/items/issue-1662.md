---
id: 'github:callumalpass/tasknotes:issue:1662'
provider: github
kind: issue
key: '1662'
external_ref: callumalpass/tasknotes#1662
repo: callumalpass/tasknotes
number: 1662
remote_state: OPEN
remote_title: >-
  [Bug]: Event Creation ignores Template file properties
remote_author: victorhg
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1662'
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: >-
  When creating a note from a calendar event, the template file's frontmatter properties are
  overwritten by the default frontmatter built in ICSNoteService, because the merge order is
  wrong - defaults are spread last instead of first.
notes: |-
  Root cause:
  - In src/services/ICSNoteService.ts line ~268, the merge is:
    `frontmatter = { ...frontmatter, ...processed.frontmatter }`. This spreads the default
    frontmatter first and the template's processed frontmatter second, which should give template
    precedence. However, after this merge, lines 289-294 build the YAML header by iterating
    Object.entries(frontmatter) using formatYamlValue(), which may re-serialize values incorrectly.
    The real issue is likely that processTemplate() in src/utils/templateProcessor.ts parses the
    template frontmatter after replacing {{variables}}, and if Templater syntax (<% tp.xxx %>) is
    present, parseYaml() fails silently and returns {}, causing the spread to keep only defaults.
    Template properties using Templater syntax cannot be processed by processTemplate since it only
    handles {{mustache}} variables.

  Suggested fix (preferred):
  - Preserve raw template frontmatter lines that contain unrecognized syntax (like Templater <%...%>)
    as literal strings rather than trying to parse them. Alternatively, pass the raw template content
    through to the created file without YAML parsing, letting Templater process it post-creation.

  Fallback options:
  - Document that ICS event templates should use {{mustache}} syntax instead of Templater syntax
    for frontmatter properties.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
