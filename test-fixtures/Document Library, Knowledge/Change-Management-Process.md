---
title: Change Management Process
status: active
review_cycle: quarterly
review_date: 2026-04-01
last_reviewed: 2026-01-01
version: 1970-01-01
tags:
  - document
  - process
  - change-management
  - itil
---

# Change Management Process

## Purpose

Defines the process for requesting, reviewing, approving, and implementing changes to production systems.

## Change Categories

### Standard Changes
- Pre-approved, low-risk changes
- Follow documented procedures
- No CAB review needed
- Example: Patching, certificate renewal

### Normal Changes
- Require CAB review and approval
- Risk assessment required
- Scheduled maintenance window
- Example: Application deployment, configuration change

### Emergency Changes
- Bypass normal approval process
- Post-implementation review required
- Limited to critical business impact
- Example: Security patch for active exploit

## Approval Matrix

| Change Type | Approver | Lead Time |
|-------------|----------|-----------|
| Standard | Auto-approved | 24 hours |
| Normal (Low) | Team Lead | 3 days |
| Normal (Medium) | Manager + CAB | 5 days |
| Normal (High) | Director + CAB | 10 days |
| Emergency | On-call Manager | Immediate |

## Process Flow

1. **Request** - Submitter creates change request
2. **Classify** - Change coordinator assigns category
3. **Assess** - Technical review and risk assessment
4. **Approve** - Appropriate approver signs off
5. **Schedule** - Maintenance window assigned
6. **Implement** - Change executed per plan
7. **Validate** - Post-implementation testing
8. **Close** - Documentation updated

## Note

This document has no `owner` field - useful for testing Convert edge cases.

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 5.1 | 2026-01-01 | Jane Doe | Updated approval matrix |
| 5.0 | 2025-10-01 | John Smith | Added emergency process |
