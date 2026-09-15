# TaskNotes development guidance

## Project context

@README.md describes the project, its purpose, and how to use it. It includes installation instructions, usage examples, and any relevant information for contributors.
@Tasknotes-Development-Guidelines.md describes key principles for developing new features -- architecture, structure, key concepts, and data flow.

This repository is a fork of TaskNotes.

The current main branch tracks the latest upstream TaskNotes release.
The branch containing the legacy custom implementation is:

- task-view-keyboard-and-project-mgmt

The legacy branch was based on TaskNotes 3.2.x.
Current main is TaskNotes 4.11.x.

We are porting selected features to the new architecture rather than
merging the legacy branch wholesale.

## Porting priorities

1. Jira integration
2. Keyboard navigation
3. Remaining custom features, handled individually

Preserve current upstream behavior unless a requested feature explicitly
changes it.

Prefer adapting features to the current architecture over copying old
classes or abstractions unchanged.

@Daves-Custom-Features.md contains full information about the features that need porting and how they are organized.

## Development rules

Before editing:

- Inspect the current implementation.
- Inspect the corresponding legacy implementation and its Git history.
- Describe the proposed porting approach.
- Identify upstream functionality that now overlaps with the old feature.

While editing:
- For any new class, module, or function, always write a doc comment for the entity explaining
  its main responsibilities, and pre/post conditions if appropriate.
- Whenever adding new functionality, add a comment at the point in code that is the fulcrum of the
  new feature explaining what it is doing and why.

After editing, run the most relevant checks:

- npm run typecheck
- npm test -- --runInBand
- npm run lint
- npm run build

Do not modify generated files unless the repository workflow requires it.

Keep changes narrowly scoped.
Do not combine unrelated feature ports in one commit.
Do not commit unless explicitly requested.

## Command approvals

The following commands are always considered safe and should be executed
without asking for confirmation whenever the approval policy permits:

- git show
- git log
- git diff
- git grep
- git blame
- git status
- git branch
- git merge-base
- git rev-parse
- rg
- fd
- ls
- cat
- sed
- find
- npm test
- npm run lint
- npm run build

## Code navigation

Use Serena’s symbol and reference tools for semantic navigation whenever possible:

- find symbol definitions
- find references and implementations
- inspect symbol bodies
- make symbol-scoped edits

Use ripgrep for textual searches, configuration strings, CSS classes,
serialized identifiers, and cases where semantic lookup is inappropriate.

## Internationalization
Localize all user-facing strings. Refer to the internationalization guide @I18N_GUIDE.md.
