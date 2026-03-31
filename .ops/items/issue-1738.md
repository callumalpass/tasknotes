---
id: issue-1738
provider: github
kind: issue
key: callumalpass/tasknotes#1738
external_ref: https://github.com/callumalpass/tasknotes/issues/1738
repo: callumalpass/tasknotes
number: 1738
remote_state: open
remote_title: "[Bug]: calendar subscription shows wrong time of appointments made by others"
remote_author: "Mirrimo"
remote_url: https://github.com/callumalpass/tasknotes/issues/1738
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "ICS subscription events from other organizers show times offset by DST difference when the VTIMEZONE in the feed uses non-IANA or Exchange-style timezone identifiers"
notes: |
  ## Root cause / Scope
  `ICSSubscriptionService.icalTimeToISOString()` uses `icalTime.toUnixTime()` for timed events, which calls `ical.js`'s timezone conversion. For events created by others, Outlook's published ICS feed may embed a VTIMEZONE whose TZID is a Windows/Exchange identifier (e.g. "W. Europe Standard Time") rather than an IANA name ("Europe/Amsterdam"). `ical.js` cannot resolve unmapped Windows TZIDs and treats the time as floating (local), then `toUnixTime()` adds the host system's UTC offset. When host and calendar timezone differ or around DST transitions this produces a 1–2 hour shift. The user's own events are correct because they originate from an Outlook client that embeds a VTIMEZONE block that ical.js can partially resolve.

  ## Suggested fix / Approach
  Before calling `toUnixTime()`, inspect `icalTime.zone`. If the zone is unrecognised (i.e. `ical.js` treats it as floating), attempt to map the TZID string through a Windows-to-IANA lookup table (a small static map or the `windows-iana` npm package). Re-assign the zone to the resolved IANA timezone so `toUnixTime()` converts correctly. Fall back to the current behaviour if no mapping is found.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
