---
title: Access Control Policy
status: open
owner: "[[Jane Doe]]"
review_cycle: annual
review_date: 2025-12-01
last_reviewed: 2024-12-01
version: 1970-01-01
tags:
  - document
  - policy
  - access-control
  - security
---

# Access Control Policy

## Purpose

Establishes requirements for managing access to organizational systems and data.

## Scope

All employees, contractors, and third parties requiring system access.

## Principles

### Least Privilege
Users receive only the minimum access necessary to perform their job functions.

### Separation of Duties
Critical functions require multiple approvals to prevent unauthorized actions.

### Need to Know
Information access is restricted based on job requirements.

## Access Management

### Account Provisioning

1. Manager submits access request
2. Security team reviews against role requirements
3. Access granted with appropriate permissions
4. User completes security training

### Access Review

| Review Type | Frequency | Scope |
|-------------|-----------|-------|
| Privileged accounts | Monthly | All admin accounts |
| Standard accounts | Quarterly | Random 25% |
| Service accounts | Semi-annually | All service accounts |
| Third-party access | Annually | All external accounts |

### Account Deprovisioning

- Voluntary termination: Same day
- Involuntary termination: Immediate
- Role change: Within 24 hours

## Authentication Requirements

| Access Type | Minimum Requirement |
|-------------|---------------------|
| Standard user | Password + MFA |
| Privileged user | Password + Hardware MFA |
| Remote access | VPN + MFA |
| Admin console | Hardware token required |

## Compliance

This policy aligns with:
- NIST SP 800-53 AC controls
- ISO 27001 A.9
- SOC 2 CC6.1-6.3

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.5 | 2024-12-01 | Jane Doe | Added MFA requirements |
| 1.4 | 2023-12-01 | Jane Doe | Updated review frequencies |
| 1.0 | 2022-12-01 | John Smith | Initial version |
