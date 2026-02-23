---
title: Asset Inventory Standard
status: done
owner: "[[John Smith]]"
review_cycle: monthly
review_date: 2026-02-15
last_reviewed: 2026-01-15
version: 1970-01-01
tags:
  - document
  - standard
  - asset-management
  - inventory
---

# Asset Inventory Standard

## Purpose

Defines requirements for maintaining an accurate inventory of all organizational IT assets.

## Asset Categories

| Category | Examples | Update Frequency |
|----------|----------|-----------------|
| Hardware | Servers, laptops, network devices | On change |
| Software | Licensed applications, OS versions | Monthly |
| Cloud | SaaS subscriptions, IaaS instances | Weekly |
| Data | Databases, file shares, backups | Quarterly |

## Required Fields

Every asset record must include:

- **Asset ID** - Unique identifier
- **Name** - Human-readable name
- **Category** - From categories above
- **Owner** - Responsible individual
- **Location** - Physical or cloud location
- **Classification** - Data sensitivity level
- **Status** - Active, decommissioned, etc.
- **Last verified** - Date of last audit

## Audit Schedule

| Asset Type | Verification | Frequency |
|-----------|-------------|-----------|
| Physical | On-site scan | Monthly |
| Virtual | Automated discovery | Weekly |
| Cloud | API inventory | Daily |
| Software | License audit | Quarterly |

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.8 | 2026-01-15 | John Smith | Added cloud category |
| 1.5 | 2025-10-15 | John Smith | Updated audit schedule |
| 1.0 | 2025-01-15 | John Smith | Initial standard |
