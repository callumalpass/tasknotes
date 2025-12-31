---
title: Deploy authentication update
status: open
priority: high
due: 2025-12-31
tags:
  - deployment
  - task
contexts:
  - "@dev"
timeEstimate: 30
blockedBy:
  - uid: "[[Code review PR 123]]"
    reltype: FINISHTOSTART
---

# Deploy authentication update

Deploy the reviewed authentication changes to production.

## Deployment checklist
- [ ] Run final tests
- [ ] Backup database
- [ ] Deploy to staging
- [ ] Deploy to production
