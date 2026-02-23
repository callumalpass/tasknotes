---
title: Network Segmentation Design
status: active
owner: "[[John Smith]]"
review_cycle: quarterly
review_date: 2026-01-15
last_reviewed: 2025-10-15
version: 1970-01-01
tags:
  - document
  - design
  - network
  - security
---

# Network Segmentation Design

## Purpose

Documents the network segmentation architecture for isolating critical systems and controlling traffic flow.

## Zones

### Zone 1 - DMZ
- Public-facing web servers
- Load balancers
- WAF appliances

### Zone 2 - Application
- Application servers
- API gateways
- Message queues

### Zone 3 - Data
- Database servers
- File storage
- Backup systems

### Zone 4 - Management
- Jump servers
- Monitoring systems
- Configuration management

## Firewall Rules Summary

| Source | Destination | Ports | Protocol |
|--------|-------------|-------|----------|
| Internet | DMZ | 443 | HTTPS |
| DMZ | Application | 8080, 8443 | HTTP/S |
| Application | Data | 5432, 3306 | DB |
| Management | All zones | 22 | SSH |

## Compliance Mapping

- PCI DSS Requirement 1: Firewall configuration
- NIST SP 800-41: Firewall policy guidelines
- CIS Controls v8: Control 12 - Network infrastructure management

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.2 | 2025-10-15 | John Smith | Added Zone 4 |
| 1.1 | 2025-07-15 | John Smith | Updated firewall rules |
| 1.0 | 2025-04-15 | John Smith | Initial design |
