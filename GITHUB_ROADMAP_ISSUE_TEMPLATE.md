# TaskNotes 4.0 Roadmap and Breaking Changes

**Status:** Planning Phase
**Target Release:** ~1 month after Obsidian 1.10.0 GA release
**Feedback Welcome:** Please comment with your thoughts!

---

## 🎯 Goals

TaskNotes 4.0 is a **major refactor** aimed at:

1. **Simplification**: Reduce maintenance burden by leveraging Obsidian's Bases plugin
2. **Flexibility**: More powerful querying and filtering through Bases
3. **Modernization**: Adopt Obsidian 1.10.0's official Bases API
4. **New Features**: OAuth integration with Google Calendar and Outlook

## 🚨 Breaking Changes

### Views Moving to Bases

All native TaskNotes views will be replaced with Bases-powered views:
- ~~Task List~~ → **Bases Task List**
- ~~Kanban~~ → **Bases Kanban**
- ~~Calendar~~ → **Bases Calendar**
- ~~Agenda~~ → **Bases Agenda**
- ~~Notes~~ → **Removed entirely**

**Why?** Obsidian 1.10.0 adds official plugin integration with Bases. This allows us to:
- Reduce ~80% of custom view code
- Give you more flexible querying and filtering
- Leverage Obsidian's native features instead of reimplementing them

### Temporarily Removed: Dependency Filtering

**Blocked/blocking task filtering will NOT be available in v4.0**

**Why?** Currently, Bases formulas cannot query properties from other notes (no cross-note lookups). The Obsidian docs state: _"In the future, plugins will be able to add functions for use in formulas"_ - we're waiting for this API.

**Impact:**
- If you rely on dependency tracking, **stay on v3.x** for now
- v3.x will continue to receive bug fixes
- Dependency filtering will return in v4.x when the Bases API supports it

### Other Changes
- Recurrence (RRULE) support may be limited initially (under investigation)
- Views will require base files (can be auto-generated)

## ✅ What's Staying

- All core task management features
- Task properties and metadata
- Pomodoro and time tracking
- Recurrence support (RRULE)
- Calendar integration
- All your data (fully backward compatible)

## 🆕 New Features

- **OAuth Integration**: Connect Google Calendar and Outlook calendars
- **Bases Flexibility**: More powerful queries using Obsidian's formula language
- **Better Performance**: Native Bases views are optimized by Obsidian

## 📅 Timeline

1. **Now**: Planning phase, gathering feedback
2. **When Obsidian 1.10.0 GA releases**: Begin v4 alpha releases
3. **Alpha period**: Early adopters test via BRAT
4. **Beta period**: Wider testing, bug fixes
5. **v4.0.1 stable**: First stable v4 release (note: skipping 4.0.0 for BRAT compatibility)

## 🔀 Branching Strategy

- **v3.x** (`v3-maintenance` branch): Bug fixes only, stable
- **v4.x** (`main` branch): Active development, breaking changes

## 🧪 Beta Testing

Want to help test v4?
1. Install [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add this repository when alpha releases begin
3. Report issues to help stabilize v4

**Warning:** Beta versions will have bugs. Keep backups!

## 🤔 Should I Upgrade?

### Stay on v3.x if you:
- ✅ Use blocked/blocking (dependency) task filtering
- ✅ Want maximum stability
- ✅ Don't need new features right away

### Upgrade to v4.x if you:
- ✅ Want OAuth calendar integration
- ✅ Want more flexible Bases querying
- ✅ Don't use dependency filtering
- ✅ Want to help beta test

## 💬 We Want Your Feedback!

Before we commit to this direction, we'd love to hear from you:

1. **Do you use blocked/blocking task filtering?** This is the main feature being temporarily removed.
2. **What features are most important to you?** Help us prioritize.
3. **Would you be willing to beta test v4?** We need testers!
4. **Any concerns about this roadmap?** Let us know!

## 📚 Resources

- [Full v4 Planning Document](link to V4_PLANNING.md in repo)
- [Obsidian Bases Documentation](https://help.obsidian.md/Plugins/Bases)
- [Obsidian 1.10.0 Release Notes](link when available)

## 🙏 Thank You

TaskNotes has grown thanks to your support and feedback. This is a big change, and we want to make sure we're heading in the right direction. Please share your thoughts!

---

**Labels:** `v4`, `breaking-change`, `roadmap`, `feedback-wanted`, `announcement`
