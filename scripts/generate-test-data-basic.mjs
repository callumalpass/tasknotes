#!/usr/bin/env node
/**
 * Test Data Generation Script
 *
 * Generates test data for TaskNotes development:
 * - Person notes with varied attributes
 * - Group notes with nested membership
 * - Document notes for bulk task creation testing
 * - Tasks with various states
 *
 * Usage:
 *   node scripts/generate-test-data.mjs [--clean] [--vault-path <path>]
 *
 * Options:
 *   --clean       Remove existing test data before generating
 *   --vault-path  Path to vault (default: parent of plugin folder)
 */

import { writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default vault path (parent of plugin folder which is in .obsidian/plugins/tasknotes)
const DEFAULT_VAULT_PATH = join(__dirname, '..', '..', '..', '..');

// Parse command line arguments
const args = process.argv.slice(2);
const clean = args.includes('--clean');
const vaultPathIndex = args.indexOf('--vault-path');
const vaultPath = vaultPathIndex !== -1 ? args[vaultPathIndex + 1] : DEFAULT_VAULT_PATH;

console.log(`Vault path: ${vaultPath}`);

// ============================================================
// DATA DEFINITIONS
// ============================================================

const PERSONS = [
  {
    name: 'Cybersader',
    role: 'Developer',
    department: 'Engineering',
    email: 'cybersader@example.com',
    reminderTime: '09:00',
    active: true,
  },
  {
    name: 'Alice Chen',
    role: 'Software Engineer',
    department: 'Engineering',
    email: 'alice.chen@example.com',
    reminderTime: '08:30',
    active: true,
  },
  {
    name: 'Bob Wilson',
    role: 'Security Analyst',
    department: 'Security',
    email: 'bob.wilson@example.com',
    reminderTime: '09:00',
    active: true,
  },
  {
    name: 'Carol Davis',
    role: 'Product Manager',
    department: 'Product',
    email: 'carol.davis@example.com',
    reminderTime: '08:00',
    active: true,
  },
  {
    name: 'David Kim',
    role: 'DevOps Engineer',
    department: 'Engineering',
    email: 'david.kim@example.com',
    reminderTime: '10:00',
    active: true,
  },
  {
    name: 'Eva Martinez',
    role: 'UX Designer',
    department: 'Design',
    email: 'eva.martinez@example.com',
    reminderTime: '09:30',
    active: true,
  },
  {
    name: 'Frank Johnson',
    role: 'QA Engineer',
    department: 'Engineering',
    email: 'frank.johnson@example.com',
    reminderTime: '09:00',
    active: false, // Inactive person for testing
  },
];

const GROUPS = [
  {
    name: 'Engineering Team',
    description: 'All engineering staff',
    members: ['Alice Chen', 'David Kim', 'Frank Johnson', 'Cybersader'],
  },
  {
    name: 'Security Team',
    description: 'Security and compliance',
    members: ['Bob Wilson'],
  },
  {
    name: 'Product Team',
    description: 'Product and design',
    members: ['Carol Davis', 'Eva Martinez'],
  },
  {
    name: 'All Staff',
    description: 'Everyone in the organization',
    members: ['Engineering Team', 'Security Team', 'Product Team'], // Nested groups
  },
  {
    name: 'Core Reviewers',
    description: 'Code review team',
    members: ['Alice Chen', 'Bob Wilson', 'Cybersader'],
  },
];

const DOCUMENTS = [
  // Projects folder
  {
    name: 'Project Alpha Requirements',
    folder: 'Document Library, Knowledge/Projects',
    content: `# Project Alpha Requirements

## Overview
A comprehensive system for task management.

## Requirements
- User authentication
- Task CRUD operations
- Notification system
- Reporting dashboard

## Timeline
- Phase 1: Q1 2026
- Phase 2: Q2 2026
`,
  },
  {
    name: 'Sprint 42 Planning',
    folder: 'Document Library, Knowledge/Projects',
    content: `# Sprint 42 Planning

## Goals
- Complete notification system
- Fix bulk task creation bugs
- Improve avatar display

## Tasks
1. Implement person avatars
2. Add assignee dropdown
3. Fix file lookup issues
`,
  },
  {
    name: 'Project Beta Launch Plan',
    folder: 'Document Library, Knowledge/Projects',
    content: `# Project Beta Launch Plan

## Pre-Launch Checklist
- [ ] Complete feature freeze
- [ ] Run load testing
- [ ] Security review
- [ ] Documentation update

## Launch Day
- [ ] Deploy to production
- [ ] Monitor metrics
- [ ] Support team standby
`,
  },
  {
    name: 'Q1 2026 Roadmap',
    folder: 'Document Library, Knowledge/Projects',
    content: `# Q1 2026 Roadmap

## January
- Feature A development
- Team expansion

## February
- Feature B development
- Performance optimization

## March
- Integration testing
- Beta release
`,
  },
  {
    name: 'Mobile App Initiative',
    folder: 'Document Library, Knowledge/Projects',
    content: `# Mobile App Initiative

## Vision
Bring TaskNotes to mobile platforms.

## Platforms
- iOS (React Native)
- Android (React Native)

## Key Features
- Offline sync
- Push notifications
- Quick capture
`,
  },

  // Compliance folder
  {
    name: 'Security Audit Checklist',
    folder: 'Document Library, Knowledge/Compliance',
    content: `# Security Audit Checklist

## Network Security
- [ ] Firewall configuration review
- [ ] VPN access audit
- [ ] Port scanning

## Application Security
- [ ] Code review
- [ ] Dependency audit
- [ ] Penetration testing

## Data Security
- [ ] Encryption at rest
- [ ] Encryption in transit
- [ ] Backup verification
`,
  },
  {
    name: 'GDPR Compliance Review',
    folder: 'Document Library, Knowledge/Compliance',
    content: `# GDPR Compliance Review

## Data Inventory
- [ ] Personal data mapping
- [ ] Data flow documentation
- [ ] Third-party processors list

## Rights Management
- [ ] Access request process
- [ ] Deletion request process
- [ ] Portability implementation

## Documentation
- [ ] Privacy policy update
- [ ] Cookie policy
- [ ] DPA templates
`,
  },
  {
    name: 'SOC 2 Type II Preparation',
    folder: 'Document Library, Knowledge/Compliance',
    content: `# SOC 2 Type II Preparation

## Trust Services Criteria
- Security
- Availability
- Processing Integrity
- Confidentiality
- Privacy

## Evidence Collection
- [ ] Access control logs
- [ ] Change management records
- [ ] Incident response documentation
`,
  },
  {
    name: 'ISO 27001 Gap Analysis',
    folder: 'Document Library, Knowledge/Compliance',
    content: `# ISO 27001 Gap Analysis

## Current State Assessment
- Information Security Policy: Partial
- Risk Assessment: In Progress
- Access Control: Implemented

## Remediation Plan
1. Complete risk assessment
2. Develop incident response plan
3. Implement asset management
`,
  },
  {
    name: 'Vendor Security Assessment Template',
    folder: 'Document Library, Knowledge/Compliance',
    content: `# Vendor Security Assessment

## Vendor Information
- Company: [Vendor Name]
- Service: [Description]
- Data Handled: [Types]

## Security Questionnaire
- [ ] SOC 2 report available?
- [ ] Encryption at rest?
- [ ] MFA required?
- [ ] Incident response plan?
`,
  },

  // Technical folder
  {
    name: 'API Documentation',
    folder: 'Document Library, Knowledge/Technical',
    content: `# API Documentation

## Endpoints

### GET /api/tasks
Returns list of tasks.

### POST /api/tasks
Creates a new task.

### PUT /api/tasks/:id
Updates an existing task.

### DELETE /api/tasks/:id
Deletes a task.
`,
  },
  {
    name: 'Database Schema',
    folder: 'Document Library, Knowledge/Technical',
    content: `# Database Schema

## Tables

### users
- id (uuid, primary key)
- email (varchar, unique)
- created_at (timestamp)

### tasks
- id (uuid, primary key)
- title (varchar)
- status (enum)
- user_id (uuid, foreign key)
- due_date (date)
`,
  },
  {
    name: 'Architecture Overview',
    folder: 'Document Library, Knowledge/Technical',
    content: `# Architecture Overview

## Components
- Frontend: React + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL
- Cache: Redis
- Queue: RabbitMQ

## Infrastructure
- AWS ECS for containers
- RDS for database
- S3 for file storage
- CloudFront for CDN
`,
  },
  {
    name: 'Deployment Guide',
    folder: 'Document Library, Knowledge/Technical',
    content: `# Deployment Guide

## Prerequisites
- Docker installed
- AWS CLI configured
- Terraform >= 1.0

## Steps
1. Build Docker image
2. Push to ECR
3. Apply Terraform
4. Run migrations
5. Verify health checks
`,
  },
  {
    name: 'Performance Tuning Guide',
    folder: 'Document Library, Knowledge/Technical',
    content: `# Performance Tuning Guide

## Database Optimization
- Index frequently queried columns
- Use connection pooling
- Implement query caching

## Application Optimization
- Enable response compression
- Implement pagination
- Use lazy loading
`,
  },
  {
    name: 'Error Handling Standards',
    folder: 'Document Library, Knowledge/Technical',
    content: `# Error Handling Standards

## HTTP Status Codes
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Error Response Format
\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": []
  }
}
\`\`\`
`,
  },

  // HR folder
  {
    name: 'Onboarding Guide',
    folder: 'Document Library, Knowledge/HR',
    content: `# New Employee Onboarding

## Day 1
- [ ] Set up workstation
- [ ] Configure email
- [ ] Meet the team

## Week 1
- [ ] Complete security training
- [ ] Read codebase documentation
- [ ] Shadow a team member

## Month 1
- [ ] Complete first project
- [ ] Present to team
`,
  },
  {
    name: 'Remote Work Policy',
    folder: 'Document Library, Knowledge/HR',
    content: `# Remote Work Policy

## Eligibility
All full-time employees after 90-day probation.

## Requirements
- Reliable internet (25+ Mbps)
- Dedicated workspace
- Available during core hours (10am-3pm)

## Equipment
Company provides:
- Laptop
- Monitor
- Keyboard/mouse
`,
  },
  {
    name: 'Performance Review Template',
    folder: 'Document Library, Knowledge/HR',
    content: `# Performance Review

## Employee Information
- Name:
- Title:
- Manager:
- Review Period:

## Self Assessment
1. Key accomplishments
2. Areas for improvement
3. Goals for next period

## Manager Assessment
1. Performance rating
2. Feedback
3. Development plan
`,
  },
  {
    name: 'Interview Question Bank',
    folder: 'Document Library, Knowledge/HR',
    content: `# Interview Question Bank

## Technical Questions
1. Describe a complex problem you solved
2. How do you approach debugging?
3. Explain your testing philosophy

## Behavioral Questions
1. Tell me about a time you disagreed with a teammate
2. How do you prioritize competing deadlines?
3. Describe a project you're proud of
`,
  },
  {
    name: 'Benefits Overview',
    folder: 'Document Library, Knowledge/HR',
    content: `# Benefits Overview

## Health Insurance
- Medical (100% premium covered)
- Dental (100% premium covered)
- Vision (100% premium covered)

## Time Off
- Unlimited PTO
- 10 company holidays
- Sick leave as needed

## Other Benefits
- 401k with 4% match
- $1000 learning budget
- Home office stipend
`,
  },

  // Meeting Notes folder
  {
    name: 'Weekly Standup 2026-01-27',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Weekly Standup - January 27, 2026

## Attendees
Alice, Bob, Carol, David

## Updates
- Alice: Working on notification system
- Bob: Completed security audit
- Carol: Sprint planning done
- David: DevOps pipeline updates

## Blockers
- Waiting on design review
`,
  },
  {
    name: 'Weekly Standup 2026-02-03',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Weekly Standup - February 3, 2026

## Attendees
Alice, Bob, Carol, Eva

## Updates
- Alice: Avatar component complete
- Bob: Vendor assessment ongoing
- Carol: Roadmap finalized
- Eva: UI mockups ready

## Action Items
- [ ] Schedule design review
- [ ] Update documentation
`,
  },
  {
    name: 'Architecture Review 2026-01-15',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Architecture Review - January 15, 2026

## Topics Discussed
1. Microservices migration
2. Database sharding strategy
3. Caching layer improvements

## Decisions
- Proceed with gradual migration
- Use consistent hashing for shards
- Implement Redis cluster
`,
  },
  {
    name: 'Quarterly Planning Q1 2026',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Quarterly Planning - Q1 2026

## OKRs
1. Increase user retention by 15%
2. Reduce P95 latency to <200ms
3. Launch mobile app beta

## Resource Allocation
- Engineering: 60% features, 40% tech debt
- Design: New features + design system
- QA: Automation focus
`,
  },
  {
    name: 'Incident Postmortem 2026-01-20',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Incident Postmortem - January 20, 2026

## Incident Summary
Production outage lasting 45 minutes.

## Root Cause
Database connection pool exhaustion.

## Timeline
- 14:00 - Alerts triggered
- 14:15 - On-call paged
- 14:30 - Root cause identified
- 14:45 - Mitigation applied

## Action Items
- [ ] Increase connection pool size
- [ ] Add connection pool monitoring
- [ ] Document runbook
`,
  },

  // Research folder
  {
    name: 'AI Integration Research',
    folder: 'Document Library, Knowledge/Research',
    content: `# AI Integration Research

## Use Cases
1. Smart task prioritization
2. Natural language task creation
3. Automated task categorization

## Technologies Evaluated
- OpenAI GPT-4
- Anthropic Claude
- Local LLMs (Llama)

## Recommendation
Start with Claude API for task parsing.
`,
  },
  {
    name: 'Competitor Analysis',
    folder: 'Document Library, Knowledge/Research',
    content: `# Competitor Analysis

## Todoist
- Strengths: Clean UI, cross-platform
- Weaknesses: Limited customization

## Notion
- Strengths: Flexible, collaborative
- Weaknesses: Steep learning curve

## Things 3
- Strengths: Beautiful design
- Weaknesses: Apple-only

## Our Differentiator
Local-first, Obsidian integration.
`,
  },
  {
    name: 'User Feedback Summary Q4 2025',
    folder: 'Document Library, Knowledge/Research',
    content: `# User Feedback Summary - Q4 2025

## Top Requests
1. Mobile app (47 mentions)
2. Better notifications (31 mentions)
3. Team collaboration (28 mentions)
4. Calendar sync (22 mentions)

## Pain Points
- Sync conflicts in shared vaults
- Complex initial setup
- Documentation gaps
`,
  },
  {
    name: 'Technology Radar 2026',
    folder: 'Document Library, Knowledge/Research',
    content: `# Technology Radar 2026

## Adopt
- TypeScript 5
- Bun runtime
- Playwright

## Trial
- Solid.js
- Drizzle ORM
- tRPC

## Assess
- WebAssembly
- Effect-TS
- Tauri

## Hold
- Webpack (use esbuild)
- Jest (use Vitest)
`,
  },

  // Templates folder
  {
    name: 'RFC Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# RFC: [Title]

## Summary
Brief description of the proposal.

## Motivation
Why are we doing this?

## Detailed Design
Technical details of the solution.

## Alternatives Considered
Other approaches we evaluated.

## Rollout Plan
How we'll deploy this.

## Open Questions
Unresolved issues.
`,
  },
  {
    name: 'Bug Report Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# Bug Report

## Description
What happened?

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should have happened?

## Actual Behavior
What actually happened?

## Environment
- OS:
- Browser:
- Version:

## Screenshots
(if applicable)
`,
  },
  {
    name: 'Feature Request Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# Feature Request

## Summary
What feature would you like?

## Use Case
What problem does this solve?

## Proposed Solution
How would this work?

## Alternatives
Other ways to solve this.

## Priority
How important is this?
`,
  },
  {
    name: 'Decision Record Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# ADR-XXX: [Title]

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What is the issue that we're seeing?

## Decision
What is the change that we're proposing?

## Consequences
What becomes easier or harder?
`,
  },

  // Design folder
  {
    name: 'Design System Overview',
    folder: 'Document Library, Knowledge/Design',
    content: `# Design System Overview

## Colors
- Primary: #6366f1
- Secondary: #8b5cf6
- Success: #22c55e
- Warning: #f59e0b
- Error: #ef4444

## Typography
- Headings: Inter
- Body: Inter
- Code: JetBrains Mono

## Spacing
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
`,
  },
  {
    name: 'Component Library',
    folder: 'Document Library, Knowledge/Design',
    content: `# Component Library

## Buttons
- Primary: Solid, accent color
- Secondary: Outline, neutral
- Ghost: Transparent, hover effect
- Destructive: Red, for dangerous actions

## Forms
- Text Input
- Textarea
- Select
- Checkbox
- Radio
- Toggle

## Feedback
- Toast notifications
- Modal dialogs
- Tooltips
- Progress bars
`,
  },
  {
    name: 'Accessibility Guidelines',
    folder: 'Document Library, Knowledge/Design',
    content: `# Accessibility Guidelines

## WCAG 2.1 AA Compliance

### Perceivable
- Color contrast ratio: 4.5:1 minimum
- Text alternatives for images
- Captions for videos

### Operable
- Keyboard navigation
- Focus indicators
- No motion that causes seizures

### Understandable
- Clear language
- Predictable navigation
- Input assistance

### Robust
- Valid HTML
- ARIA labels
- Screen reader testing
`,
  },

  // Operations folder
  {
    name: 'Runbook - Database Failover',
    folder: 'Document Library, Knowledge/Operations',
    content: `# Runbook: Database Failover

## When to Use
- Primary database unresponsive
- Planned maintenance

## Prerequisites
- VPN access
- Database admin credentials
- PagerDuty access

## Steps
1. Verify primary is down
2. Check replication lag
3. Promote replica
4. Update connection strings
5. Verify application health

## Rollback
1. Point back to original primary
2. Resync data
`,
  },
  {
    name: 'Runbook - Scaling',
    folder: 'Document Library, Knowledge/Operations',
    content: `# Runbook: Application Scaling

## When to Use
- High traffic events
- CPU > 80% sustained
- Memory > 85%

## Auto-Scaling Rules
- Min instances: 2
- Max instances: 10
- Scale up: CPU > 70% for 3 minutes
- Scale down: CPU < 30% for 10 minutes

## Manual Scaling
\`\`\`bash
aws ecs update-service --desired-count N
\`\`\`

## Monitoring
- CloudWatch dashboard
- PagerDuty alerts
`,
  },
  {
    name: 'On-Call Handbook',
    folder: 'Document Library, Knowledge/Operations',
    content: `# On-Call Handbook

## Responsibilities
- Acknowledge alerts within 5 minutes
- Assess severity
- Engage others if needed
- Document in incident channel

## Escalation Path
1. Primary on-call
2. Secondary on-call
3. Engineering manager
4. CTO

## Useful Links
- [Runbooks](./Runbooks)
- [Monitoring Dashboard](#)
- [Status Page](#)
`,
  },

  // Security folder
  {
    name: 'Security Incident Response Plan',
    folder: 'Document Library, Knowledge/Security',
    content: `# Security Incident Response Plan

## Severity Levels
- P1: Data breach, production down
- P2: Security vulnerability exploited
- P3: Suspicious activity detected
- P4: Potential vulnerability found

## Response Steps
1. Contain the incident
2. Preserve evidence
3. Notify stakeholders
4. Remediate
5. Post-incident review

## Contacts
- Security Team: security@example.com
- Legal: legal@example.com
`,
  },
  {
    name: 'Secret Management Guide',
    folder: 'Document Library, Knowledge/Security',
    content: `# Secret Management Guide

## Approved Solutions
- AWS Secrets Manager (production)
- Doppler (development)
- 1Password (personal)

## Never Do
- Commit secrets to git
- Share via Slack/email
- Store in plain text files

## Rotation Policy
- API keys: 90 days
- Database passwords: 180 days
- SSH keys: Annually
`,
  },
  {
    name: 'Penetration Test Report 2025',
    folder: 'Document Library, Knowledge/Security',
    content: `# Penetration Test Report - December 2025

## Executive Summary
Annual penetration test completed by SecureCorp.

## Findings Summary
- Critical: 0
- High: 1
- Medium: 3
- Low: 5

## High Findings
### H1: Session Fixation
- Status: Remediated
- Fix: Regenerate session on login

## Remediation Status
All high and medium findings addressed.
`,
  },
];

// Sample tasks with various states for testing views
const TASKS = [
  // Overdue tasks
  {
    name: 'Review security findings',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(-3),
    assignee: 'Bob Wilson',
    projects: ['Security Audit Checklist'],
  },
  {
    name: 'Submit compliance report',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(-1),
    assignee: 'Bob Wilson',
    projects: ['SOC 2 Type II Preparation'],
  },

  // Due today
  {
    name: 'Update API documentation',
    status: 'in-progress',
    priority: 'medium',
    scheduled: getTodayDate(),
    assignee: 'Alice Chen',
    projects: ['API Documentation'],
  },
  {
    name: 'Deploy hotfix to production',
    status: 'pending',
    priority: 'high',
    due: getTodayDate(),
    assignee: 'David Kim',
    contexts: ['urgent', 'production'],
  },
  {
    name: 'Review pull requests',
    status: 'pending',
    priority: 'medium',
    due: getTodayDate(),
    assignee: 'Core Reviewers',
    projects: ['Sprint 42 Planning'],
  },

  // Due tomorrow
  {
    name: 'Complete sprint planning',
    status: 'pending',
    priority: 'high',
    due: getTomorrowDate(),
    assignee: 'Carol Davis',
    projects: ['Sprint 42 Planning'],
  },
  {
    name: 'Finalize design mockups',
    status: 'in-progress',
    priority: 'medium',
    due: getTomorrowDate(),
    assignee: 'Eva Martinez',
    projects: ['Mobile App Initiative'],
  },

  // Due this week
  {
    name: 'Fix notification bugs',
    status: 'in-progress',
    priority: 'medium',
    due: getDateOffset(3),
    assignee: 'Cybersader',
    contexts: ['bug', 'notifications'],
  },
  {
    name: 'Write unit tests for avatar component',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(4),
    assignee: 'Alice Chen',
    contexts: ['testing'],
  },
  {
    name: 'Prepare demo for stakeholders',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(5),
    assignee: 'Carol Davis',
    projects: ['Project Alpha Requirements'],
  },

  // Due next week
  {
    name: 'Complete database migration',
    status: 'pending',
    priority: 'medium',
    due: getNextWeekDate(),
    assignee: 'David Kim',
    projects: ['Architecture Overview'],
  },
  {
    name: 'Update runbooks',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(10),
    assignee: 'David Kim',
    projects: ['Runbook - Database Failover'],
  },
  {
    name: 'Conduct user interviews',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(12),
    assignee: 'Eva Martinez',
    projects: ['User Feedback Summary Q4 2025'],
  },

  // Due later
  {
    name: 'Plan Q2 roadmap',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(30),
    assignee: 'Carol Davis',
    projects: ['Q1 2026 Roadmap'],
  },
  {
    name: 'Implement AI task parsing',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(45),
    assignee: 'Cybersader',
    projects: ['AI Integration Research'],
  },

  // Completed tasks
  {
    name: 'Design avatar component',
    status: 'done',
    priority: 'low',
    completedDate: getYesterdayDate(),
    assignee: 'Eva Martinez',
  },
  {
    name: 'Set up CI pipeline',
    status: 'done',
    priority: 'high',
    completedDate: getDateOffset(-5),
    assignee: 'David Kim',
    projects: ['Deployment Guide'],
  },
  {
    name: 'Complete security training',
    status: 'done',
    priority: 'medium',
    completedDate: getDateOffset(-7),
    assignee: 'Engineering Team',
    projects: ['Onboarding Guide'],
  },

  // No due date
  {
    name: 'Research GraphQL adoption',
    status: 'pending',
    priority: 'low',
    assignee: 'Alice Chen',
    projects: ['Technology Radar 2026'],
  },
  {
    name: 'Document coding standards',
    status: 'pending',
    priority: 'low',
    assignee: 'Engineering Team',
  },
  {
    name: 'Evaluate new monitoring tools',
    status: 'pending',
    priority: 'medium',
    assignee: 'David Kim',
    contexts: ['operations', 'research'],
  },

  // Assigned to groups
  {
    name: 'Team retrospective',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(7),
    assignee: 'All Staff',
    contexts: ['meeting'],
  },
  {
    name: 'Security awareness session',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(14),
    assignee: 'Security Team',
    projects: ['Security Incident Response Plan'],
  },
  {
    name: 'Design review meeting',
    status: 'pending',
    priority: 'medium',
    due: getTomorrowDate(),
    assignee: 'Product Team',
    contexts: ['meeting', 'design'],
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getNextWeekDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`  Created directory: ${dirPath}`);
  }
}

function cleanDir(dirPath) {
  if (existsSync(dirPath)) {
    const files = readdirSync(dirPath);
    for (const file of files) {
      const filePath = join(dirPath, file);
      rmSync(filePath, { recursive: true });
    }
    console.log(`  Cleaned: ${dirPath}`);
  }
}

// ============================================================
// GENERATORS
// ============================================================

function generatePersonNote(person) {
  const frontmatter = {
    type: 'person',
    email: person.email,
    role: person.role,
    department: person.department,
    active: person.active,
    reminderTime: person.reminderTime,
    notificationEnabled: true,
    tags: ['person', person.department.toLowerCase().replace(/\s+/g, '-')],
  };

  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
      }
      if (typeof value === 'string' && value.includes(':')) {
        return `${key}: "${value}"`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  return `---
${yaml}
---

# ${person.name}

## Role

${person.role} in the ${person.department} department.

## Contact

- Email: ${person.email}
`;
}

function generateGroupNote(group) {
  const memberLinks = group.members.map(m => `  - "[[${m}]]"`).join('\n');

  return `---
type: group
title: ${group.name}
members:
${memberLinks}
tags:
  - group
---

# ${group.name}

${group.description}

## Members

${group.members.map(m => `- [[${m}]]`).join('\n')}
`;
}

function generateDocumentNote(doc) {
  return doc.content;
}

function generateTaskNote(task) {
  const frontmatter = {
    type: 'task',
    status: task.status,
    priority: task.priority,
  };

  if (task.due) frontmatter.due = task.due;
  if (task.scheduled) frontmatter.scheduled = task.scheduled;
  if (task.completedDate) frontmatter.completedDate = task.completedDate;
  if (task.assignee) frontmatter.assignee = `[[${task.assignee}]]`;
  if (task.projects) frontmatter.projects = task.projects.map(p => `[[${p}]]`);
  if (task.contexts) frontmatter.contexts = task.contexts;

  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  return `---
${yaml}
---

# ${task.name}

Task details go here.
`;
}

// ============================================================
// MAIN EXECUTION
// ============================================================

function main() {
  console.log('TaskNotes Test Data Generator');
  console.log('==============================\n');

  const userDbPath = join(vaultPath, 'User-DB');
  const peoplePath = join(userDbPath, 'People');
  const groupsPath = join(userDbPath, 'Groups');
  const documentsPath = join(vaultPath, 'Document Library, Knowledge');
  const tasksPath = join(vaultPath, 'TaskNotes', 'Tasks');

  if (clean) {
    console.log('Cleaning existing test data...');
    cleanDir(peoplePath);
    cleanDir(groupsPath);
    // Don't clean documents - might have user data
    console.log('');
  }

  // Ensure directories exist
  console.log('Ensuring directories...');
  ensureDir(peoplePath);
  ensureDir(groupsPath);
  ensureDir(join(documentsPath, 'Projects'));
  ensureDir(join(documentsPath, 'Compliance'));
  ensureDir(join(documentsPath, 'Technical'));
  ensureDir(join(documentsPath, 'HR'));
  ensureDir(join(documentsPath, 'Meeting Notes'));
  ensureDir(join(documentsPath, 'Research'));
  ensureDir(join(documentsPath, 'Templates'));
  ensureDir(join(documentsPath, 'Design'));
  ensureDir(join(documentsPath, 'Operations'));
  ensureDir(join(documentsPath, 'Security'));
  ensureDir(tasksPath);
  console.log('');

  // Generate person notes
  console.log('Generating person notes...');
  for (const person of PERSONS) {
    const content = generatePersonNote(person);
    const filePath = join(peoplePath, `${person.name}.md`);
    writeFileSync(filePath, content);
    console.log(`  ✓ ${person.name}`);
  }
  console.log('');

  // Generate group notes
  console.log('Generating group notes...');
  for (const group of GROUPS) {
    const content = generateGroupNote(group);
    const filePath = join(groupsPath, `${group.name}.md`);
    writeFileSync(filePath, content);
    console.log(`  ✓ ${group.name}`);
  }
  console.log('');

  // Generate document notes
  console.log('Generating document notes...');
  for (const doc of DOCUMENTS) {
    const content = generateDocumentNote(doc);
    const folderPath = join(vaultPath, doc.folder);
    ensureDir(folderPath);
    const filePath = join(folderPath, `${doc.name}.md`);
    writeFileSync(filePath, content);
    console.log(`  ✓ ${doc.name}`);
  }
  console.log('');

  // Generate task notes
  console.log('Generating task notes...');
  for (const task of TASKS) {
    const content = generateTaskNote(task);
    const filePath = join(tasksPath, `${task.name}.md`);
    writeFileSync(filePath, content);
    console.log(`  ✓ ${task.name}`);
  }
  console.log('');

  console.log('Done! Generated:');
  console.log(`  - ${PERSONS.length} person notes`);
  console.log(`  - ${GROUPS.length} group notes`);
  console.log(`  - ${DOCUMENTS.length} document notes`);
  console.log(`  - ${TASKS.length} task notes`);
  console.log('');
  console.log('Reload Obsidian to see the changes.');
}

main();
