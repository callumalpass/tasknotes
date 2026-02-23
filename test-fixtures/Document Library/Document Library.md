# Document Library

This folder contains sample documents for testing the TaskNotes bulk workflow features (Generate Tasks + Convert to Tasks).

## Documents

| Document | Status | Owner | Review Cycle | Notes |
|----------|--------|-------|-------------|-------|
| Access Control Policy | active | Jane Doe | annual | Overdue review |
| Data Handling SOP | active | Jane Doe | annual | Upcoming review |
| Incident Response Plan | active | John Smith | quarterly | Overdue review |
| Vendor Risk Assessment | active | Jane Doe | quarterly | Upcoming review |
| Employee Onboarding Checklist | active | John Smith | annual | Future review |
| Backup Recovery Procedure | **draft** | John Smith | quarterly | Not yet approved |
| Password Policy | **deprecated** | Jane Doe | annual | Superseded |
| Network Segmentation Design | active | John Smith | quarterly | Overdue review |
| Security Awareness Training | active | Jane Doe | annual | Future review |
| Change Management Process | active | *no owner* | quarterly | Missing owner field |
| Asset Inventory Standard | active | John Smith | monthly | Recent review |

## Testing Scenarios

### Generate Tasks
Open `Document Library.base` -> click "Generate Tasks" -> mode "Generate new tasks" -> creates task files in `TaskNotes/Tasks/` linked back to each document via `projects` field.

### Convert to Tasks
Open `Document Library.base` -> click "Generate Tasks" -> mode "Convert to tasks" -> adds `isTask: true` + status/priority to each document's frontmatter IN-PLACE.

### Duplicate Detection
After generating, clicking "Generate Tasks" again with "Skip existing" should show all items as skipped (no duplicates).

## Document Frontmatter Schema

```yaml
---
type: document
title: Document Title
status: active | draft | deprecated | archived
owner: "[[Person Name]]"
review_cycle: annual | quarterly | monthly
review_date: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
version: X.Y
tags:
  - document
  - category-tag
---
```

## Bases Views

- **Document Library.base** - All documents (for Generate/Convert testing)
- **Documents Coming Due.base** - Active documents with review tracking (for notification testing)
