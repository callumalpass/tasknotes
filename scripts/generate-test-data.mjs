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
 *   --clean       Remove ALL generated test data before regenerating (people, groups,
 *                 tasks, AND documents). Documents are regenerated from scratch so any
 *                 modifications (e.g. from bulk-convert testing) are reset. Generated
 *                 subdirectories inside Document Library, Knowledge/ are wiped and
 *                 regenerated. Root-level .md files in that folder (user files) are
 *                 preserved but any task metadata injected by bulk-convert is stripped.
 *   --vault-path  Path to vault (default: parent of plugin folder)
 */

import { writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, readFileSync } from 'fs';
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
  // Projects folder — all with metadata for Document Library, Knowledge demos
  {
    name: 'Project Alpha Requirements',
    folder: 'Document Library, Knowledge/Projects',
    metadata: { type: 'document', status: 'active', owner: 'Carol Davis', review_date: getDateOffset(5), last_reviewed: getDateOffset(-25), review_cycle: 'monthly', version: '2.1', tags: ['document', 'project'] },
    content: `# Project Alpha Requirements\n\n## Overview\nA comprehensive system for task management.\n\n## Requirements\n- User authentication\n- Task CRUD operations\n- Notification system\n- Reporting dashboard\n\n## Timeline\n- Phase 1: Q1 2026\n- Phase 2: Q2 2026\n`,
  },
  {
    name: 'Sprint 42 Planning',
    folder: 'Document Library, Knowledge/Projects',
    metadata: { type: 'document', status: 'active', owner: 'Alice Chen', review_date: getDateOffset(2), last_reviewed: getDateOffset(-7), review_cycle: 'weekly', version: '1.3', tags: ['document', 'project', 'sprint'] },
    content: `# Sprint 42 Planning\n\n## Goals\n- Complete notification system\n- Fix bulk task creation bugs\n- Improve avatar display\n\n## Tasks\n1. Implement person avatars\n2. Add assignee dropdown\n3. Fix file lookup issues\n`,
  },
  {
    name: 'Project Beta Launch Plan',
    folder: 'Document Library, Knowledge/Projects',
    metadata: { type: 'document', status: 'active', owner: 'Carol Davis', review_date: getDateOffset(-2), last_reviewed: getDateOffset(-32), review_cycle: 'monthly', version: '1.0', tags: ['document', 'project'] },
    content: `# Project Beta Launch Plan\n\n## Pre-Launch Checklist\n- [ ] Complete feature freeze\n- [ ] Run load testing\n- [ ] Security review\n- [ ] Documentation update\n\n## Launch Day\n- [ ] Deploy to production\n- [ ] Monitor metrics\n- [ ] Support team standby\n`,
  },
  {
    name: 'Q1 2026 Roadmap',
    folder: 'Document Library, Knowledge/Projects',
    metadata: { type: 'document', status: 'active', owner: 'Carol Davis', review_date: getDateOffset(15), last_reviewed: getDateOffset(-10), review_cycle: 'quarterly', version: '3.0', tags: ['document', 'project', 'roadmap'] },
    content: `# Q1 2026 Roadmap\n\n## January\n- Feature A development\n- Team expansion\n\n## February\n- Feature B development\n- Performance optimization\n\n## March\n- Integration testing\n- Beta release\n`,
  },
  {
    name: 'Mobile App Initiative',
    folder: 'Document Library, Knowledge/Projects',
    metadata: { type: 'document', status: 'active', owner: 'Eva Martinez', review_date: getDateOffset(20), last_reviewed: getDateOffset(-5), review_cycle: 'monthly', version: '0.9', tags: ['document', 'project', 'mobile'] },
    content: `# Mobile App Initiative\n\n## Vision\nBring TaskNotes to mobile platforms.\n\n## Platforms\n- iOS (React Native)\n- Android (React Native)\n\n## Key Features\n- Offline sync\n- Push notifications\n- Quick capture\n`,
  },

  // Compliance folder
  {
    name: 'Security Audit Checklist',
    folder: 'Document Library, Knowledge/Compliance',
    metadata: { type: 'document', status: 'active', owner: 'Bob Wilson', review_date: getDateOffset(-5), last_reviewed: getDateOffset(-35), review_cycle: 'monthly', version: '4.2', tags: ['document', 'compliance', 'security'] },
    content: `# Security Audit Checklist\n\n## Network Security\n- [ ] Firewall configuration review\n- [ ] VPN access audit\n- [ ] Port scanning\n\n## Application Security\n- [ ] Code review\n- [ ] Dependency audit\n- [ ] Penetration testing\n\n## Data Security\n- [ ] Encryption at rest\n- [ ] Encryption in transit\n- [ ] Backup verification\n`,
  },
  {
    name: 'GDPR Compliance Review',
    folder: 'Document Library, Knowledge/Compliance',
    metadata: { type: 'document', status: 'active', owner: 'Bob Wilson', review_date: getDateOffset(8), last_reviewed: getDateOffset(-20), review_cycle: 'quarterly', version: '2.0', tags: ['document', 'compliance', 'privacy'] },
    content: `# GDPR Compliance Review\n\n## Data Inventory\n- [ ] Personal data mapping\n- [ ] Data flow documentation\n- [ ] Third-party processors list\n\n## Rights Management\n- [ ] Access request process\n- [ ] Deletion request process\n- [ ] Portability implementation\n\n## Documentation\n- [ ] Privacy policy update\n- [ ] Cookie policy\n- [ ] DPA templates\n`,
  },
  {
    name: 'SOC 2 Type II Preparation',
    folder: 'Document Library, Knowledge/Compliance',
    metadata: { type: 'document', status: 'active', owner: 'Bob Wilson', review_date: getDateOffset(1), last_reviewed: getDateOffset(-29), review_cycle: 'monthly', version: '1.5', tags: ['document', 'compliance'] },
    content: `# SOC 2 Type II Preparation\n\n## Trust Services Criteria\n- Security\n- Availability\n- Processing Integrity\n- Confidentiality\n- Privacy\n\n## Evidence Collection\n- [ ] Access control logs\n- [ ] Change management records\n- [ ] Incident response documentation\n`,
  },
  {
    name: 'ISO 27001 Gap Analysis',
    folder: 'Document Library, Knowledge/Compliance',
    metadata: { type: 'document', status: 'draft', owner: 'Bob Wilson', review_date: getDateOffset(30), last_reviewed: getDateOffset(-60), review_cycle: 'quarterly', version: '0.5', tags: ['document', 'compliance'] },
    content: `# ISO 27001 Gap Analysis\n\n## Current State Assessment\n- Information Security Policy: Partial\n- Risk Assessment: In Progress\n- Access Control: Implemented\n\n## Remediation Plan\n1. Complete risk assessment\n2. Develop incident response plan\n3. Implement asset management\n`,
  },
  {
    name: 'Vendor Security Assessment Template',
    folder: 'Document Library, Knowledge/Compliance',
    metadata: { type: 'document', status: 'active', owner: 'Bob Wilson', review_date: getDateOffset(45), last_reviewed: getDateOffset(-15), review_cycle: 'quarterly', version: '3.1', tags: ['document', 'compliance', 'vendor'] },
    content: `# Vendor Security Assessment\n\n## Vendor Information\n- Company: [Vendor Name]\n- Service: [Description]\n- Data Handled: [Types]\n\n## Security Questionnaire\n- [ ] SOC 2 report available?\n- [ ] Encryption at rest?\n- [ ] MFA required?\n- [ ] Incident response plan?\n`,
  },

  // Technical folder
  {
    name: 'API Documentation',
    folder: 'Document Library, Knowledge/Technical',
    metadata: { type: 'document', status: 'active', owner: 'Alice Chen', review_date: getDateOffset(3), last_reviewed: getDateOffset(-14), review_cycle: 'monthly', version: '5.0', tags: ['document', 'technical', 'api'] },
    content: `# API Documentation\n\n## Endpoints\n\n### GET /api/tasks\nReturns list of tasks.\n\n### POST /api/tasks\nCreates a new task.\n\n### PUT /api/tasks/:id\nUpdates an existing task.\n\n### DELETE /api/tasks/:id\nDeletes a task.\n`,
  },
  {
    name: 'Database Schema',
    folder: 'Document Library, Knowledge/Technical',
    metadata: { type: 'document', status: 'active', owner: 'David Kim', review_date: getDateOffset(10), last_reviewed: getDateOffset(-20), review_cycle: 'monthly', version: '3.2', tags: ['document', 'technical', 'database'] },
    content: `# Database Schema\n\n## Tables\n\n### users\n- id (uuid, primary key)\n- email (varchar, unique)\n- created_at (timestamp)\n\n### tasks\n- id (uuid, primary key)\n- title (varchar)\n- status (enum)\n- user_id (uuid, foreign key)\n- due_date (date)\n`,
  },
  {
    name: 'Architecture Overview',
    folder: 'Document Library, Knowledge/Technical',
    metadata: { type: 'document', status: 'active', owner: 'Cybersader', review_date: getDateOffset(25), last_reviewed: getDateOffset(-5), review_cycle: 'quarterly', version: '2.0', tags: ['document', 'technical', 'architecture'] },
    content: `# Architecture Overview\n\n## Components\n- Frontend: React + TypeScript\n- Backend: Node.js + Express\n- Database: PostgreSQL\n- Cache: Redis\n- Queue: RabbitMQ\n\n## Infrastructure\n- AWS ECS for containers\n- RDS for database\n- S3 for file storage\n- CloudFront for CDN\n`,
  },
  {
    name: 'Deployment Guide',
    folder: 'Document Library, Knowledge/Technical',
    metadata: { type: 'document', status: 'active', owner: 'David Kim', review_date: getDateOffset(-1), last_reviewed: getDateOffset(-31), review_cycle: 'monthly', version: '2.4', tags: ['document', 'technical', 'devops'] },
    content: `# Deployment Guide\n\n## Prerequisites\n- Docker installed\n- AWS CLI configured\n- Terraform >= 1.0\n\n## Steps\n1. Build Docker image\n2. Push to ECR\n3. Apply Terraform\n4. Run migrations\n5. Verify health checks\n`,
  },
  {
    name: 'Performance Tuning Guide',
    folder: 'Document Library, Knowledge/Technical',
    metadata: { type: 'document', status: 'active', owner: 'Alice Chen', review_date: getDateOffset(18), last_reviewed: getDateOffset(-12), review_cycle: 'quarterly', version: '1.1', tags: ['document', 'technical'] },
    content: `# Performance Tuning Guide\n\n## Database Optimization\n- Index frequently queried columns\n- Use connection pooling\n- Implement query caching\n\n## Application Optimization\n- Enable response compression\n- Implement pagination\n- Use lazy loading\n`,
  },
  {
    name: 'Error Handling Standards',
    folder: 'Document Library, Knowledge/Technical',
    metadata: { type: 'document', status: 'active', owner: 'Cybersader', review_date: getDateOffset(40), last_reviewed: getDateOffset(-3), review_cycle: 'quarterly', version: '1.0', tags: ['document', 'technical'] },
    content: `# Error Handling Standards\n\n## HTTP Status Codes\n- 200: Success\n- 400: Bad Request\n- 401: Unauthorized\n- 403: Forbidden\n- 404: Not Found\n- 500: Internal Server Error\n\n## Error Response Format\n\`\`\`json\n{\n  "error": {\n    "code": "VALIDATION_ERROR",\n    "message": "Invalid input",\n    "details": []\n  }\n}\n\`\`\`\n`,
  },

  // HR folder
  {
    name: 'Onboarding Guide',
    folder: 'Document Library, Knowledge/HR',
    metadata: { type: 'document', status: 'active', owner: 'Carol Davis', review_date: getDateOffset(12), last_reviewed: getDateOffset(-18), review_cycle: 'quarterly', version: '3.0', tags: ['document', 'hr'] },
    content: `# New Employee Onboarding\n\n## Day 1\n- [ ] Set up workstation\n- [ ] Configure email\n- [ ] Meet the team\n\n## Week 1\n- [ ] Complete security training\n- [ ] Read codebase documentation\n- [ ] Shadow a team member\n\n## Month 1\n- [ ] Complete first project\n- [ ] Present to team\n`,
  },
  {
    name: 'Remote Work Policy',
    folder: 'Document Library, Knowledge/HR',
    metadata: { type: 'document', status: 'active', owner: 'Carol Davis', review_date: getDateOffset(60), last_reviewed: getDateOffset(-30), review_cycle: 'quarterly', version: '2.1', tags: ['document', 'hr', 'policy'] },
    content: `# Remote Work Policy\n\n## Eligibility\nAll full-time employees after 90-day probation.\n\n## Requirements\n- Reliable internet (25+ Mbps)\n- Dedicated workspace\n- Available during core hours (10am-3pm)\n\n## Equipment\nCompany provides:\n- Laptop\n- Monitor\n- Keyboard/mouse\n`,
  },
  {
    name: 'Performance Review Template',
    folder: 'Document Library, Knowledge/HR',
    metadata: { type: 'document', status: 'active', owner: 'Carol Davis', review_date: getDateOffset(90), last_reviewed: getDateOffset(-60), review_cycle: 'quarterly', version: '1.2', tags: ['document', 'hr'] },
    content: `# Performance Review\n\n## Employee Information\n- Name:\n- Title:\n- Manager:\n- Review Period:\n\n## Self Assessment\n1. Key accomplishments\n2. Areas for improvement\n3. Goals for next period\n\n## Manager Assessment\n1. Performance rating\n2. Feedback\n3. Development plan\n`,
  },
  {
    name: 'Interview Question Bank',
    folder: 'Document Library, Knowledge/HR',
    metadata: { type: 'document', status: 'archived', owner: 'Carol Davis', review_date: getDateOffset(180), last_reviewed: getDateOffset(-90), review_cycle: 'yearly', version: '2.0', tags: ['document', 'hr'] },
    content: `# Interview Question Bank\n\n## Technical Questions\n1. Describe a complex problem you solved\n2. How do you approach debugging?\n3. Explain your testing philosophy\n\n## Behavioral Questions\n1. Tell me about a time you disagreed with a teammate\n2. How do you prioritize competing deadlines?\n3. Describe a project you're proud of\n`,
  },
  {
    name: 'Benefits Overview',
    folder: 'Document Library, Knowledge/HR',
    metadata: { type: 'document', status: 'active', owner: 'Carol Davis', review_date: getDateOffset(30), last_reviewed: getDateOffset(-60), review_cycle: 'yearly', version: '2026.1', tags: ['document', 'hr', 'benefits'] },
    content: `# Benefits Overview\n\n## Health Insurance\n- Medical (100% premium covered)\n- Dental (100% premium covered)\n- Vision (100% premium covered)\n\n## Time Off\n- Unlimited PTO\n- 10 company holidays\n- Sick leave as needed\n\n## Other Benefits\n- 401k with 4% match\n- $1000 learning budget\n- Home office stipend\n`,
  },

  // Meeting Notes folder (no metadata — not "documents" for review tracking)
  {
    name: 'Weekly Standup 2026-01-27',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Weekly Standup - January 27, 2026\n\n## Attendees\nAlice, Bob, Carol, David\n\n## Updates\n- Alice: Working on notification system\n- Bob: Completed security audit\n- Carol: Sprint planning done\n- David: DevOps pipeline updates\n\n## Blockers\n- Waiting on design review\n`,
  },
  {
    name: 'Weekly Standup 2026-02-03',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Weekly Standup - February 3, 2026\n\n## Attendees\nAlice, Bob, Carol, Eva\n\n## Updates\n- Alice: Avatar component complete\n- Bob: Vendor assessment ongoing\n- Carol: Roadmap finalized\n- Eva: UI mockups ready\n\n## Action Items\n- [ ] Schedule design review\n- [ ] Update documentation\n`,
  },
  {
    name: 'Architecture Review 2026-01-15',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Architecture Review - January 15, 2026\n\n## Topics Discussed\n1. Microservices migration\n2. Database sharding strategy\n3. Caching layer improvements\n\n## Decisions\n- Proceed with gradual migration\n- Use consistent hashing for shards\n- Implement Redis cluster\n`,
  },
  {
    name: 'Quarterly Planning Q1 2026',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Quarterly Planning - Q1 2026\n\n## OKRs\n1. Increase user retention by 15%\n2. Reduce P95 latency to <200ms\n3. Launch mobile app beta\n\n## Resource Allocation\n- Engineering: 60% features, 40% tech debt\n- Design: New features + design system\n- QA: Automation focus\n`,
  },
  {
    name: 'Incident Postmortem 2026-01-20',
    folder: 'Document Library, Knowledge/Meeting Notes',
    content: `# Incident Postmortem - January 20, 2026\n\n## Incident Summary\nProduction outage lasting 45 minutes.\n\n## Root Cause\nDatabase connection pool exhaustion.\n\n## Timeline\n- 14:00 - Alerts triggered\n- 14:15 - On-call paged\n- 14:30 - Root cause identified\n- 14:45 - Mitigation applied\n\n## Action Items\n- [ ] Increase connection pool size\n- [ ] Add connection pool monitoring\n- [ ] Document runbook\n`,
  },

  // Research folder
  {
    name: 'AI Integration Research',
    folder: 'Document Library, Knowledge/Research',
    metadata: { type: 'document', status: 'active', owner: 'Cybersader', review_date: getDateOffset(14), last_reviewed: getDateOffset(-10), review_cycle: 'monthly', version: '1.0', tags: ['document', 'research', 'ai'] },
    content: `# AI Integration Research\n\n## Use Cases\n1. Smart task prioritization\n2. Natural language task creation\n3. Automated task categorization\n\n## Technologies Evaluated\n- OpenAI GPT-4\n- Anthropic Claude\n- Local LLMs (Llama)\n\n## Recommendation\nStart with Claude API for task parsing.\n`,
  },
  {
    name: 'Competitor Analysis',
    folder: 'Document Library, Knowledge/Research',
    metadata: { type: 'document', status: 'active', owner: 'Eva Martinez', review_date: getDateOffset(22), last_reviewed: getDateOffset(-8), review_cycle: 'quarterly', version: '2.0', tags: ['document', 'research'] },
    content: `# Competitor Analysis\n\n## Todoist\n- Strengths: Clean UI, cross-platform\n- Weaknesses: Limited customization\n\n## Notion\n- Strengths: Flexible, collaborative\n- Weaknesses: Steep learning curve\n\n## Things 3\n- Strengths: Beautiful design\n- Weaknesses: Apple-only\n\n## Our Differentiator\nLocal-first, Obsidian integration.\n`,
  },
  {
    name: 'User Feedback Summary Q4 2025',
    folder: 'Document Library, Knowledge/Research',
    metadata: { type: 'document', status: 'active', owner: 'Eva Martinez', review_date: getDateOffset(-3), last_reviewed: getDateOffset(-33), review_cycle: 'monthly', version: '1.0', tags: ['document', 'research', 'feedback'] },
    content: `# User Feedback Summary - Q4 2025\n\n## Top Requests\n1. Mobile app (47 mentions)\n2. Better notifications (31 mentions)\n3. Team collaboration (28 mentions)\n4. Calendar sync (22 mentions)\n\n## Pain Points\n- Sync conflicts in shared vaults\n- Complex initial setup\n- Documentation gaps\n`,
  },
  {
    name: 'Technology Radar 2026',
    folder: 'Document Library, Knowledge/Research',
    metadata: { type: 'document', status: 'active', owner: 'Cybersader', review_date: getDateOffset(50), last_reviewed: getDateOffset(-15), review_cycle: 'quarterly', version: '2026.1', tags: ['document', 'research', 'tech'] },
    content: `# Technology Radar 2026\n\n## Adopt\n- TypeScript 5\n- Bun runtime\n- Playwright\n\n## Trial\n- Solid.js\n- Drizzle ORM\n- tRPC\n\n## Assess\n- WebAssembly\n- Effect-TS\n- Tauri\n\n## Hold\n- Webpack (use esbuild)\n- Jest (use Vitest)\n`,
  },

  // Templates folder (no metadata — these are templates, not tracked documents)
  {
    name: 'RFC Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# RFC: [Title]\n\n## Summary\nBrief description of the proposal.\n\n## Motivation\nWhy are we doing this?\n\n## Detailed Design\nTechnical details of the solution.\n\n## Alternatives Considered\nOther approaches we evaluated.\n\n## Rollout Plan\nHow we'll deploy this.\n\n## Open Questions\nUnresolved issues.\n`,
  },
  {
    name: 'Bug Report Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# Bug Report\n\n## Description\nWhat happened?\n\n## Steps to Reproduce\n1. Go to...\n2. Click on...\n3. See error\n\n## Expected Behavior\nWhat should have happened?\n\n## Actual Behavior\nWhat actually happened?\n\n## Environment\n- OS:\n- Browser:\n- Version:\n\n## Screenshots\n(if applicable)\n`,
  },
  {
    name: 'Feature Request Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# Feature Request\n\n## Summary\nWhat feature would you like?\n\n## Use Case\nWhat problem does this solve?\n\n## Proposed Solution\nHow would this work?\n\n## Alternatives\nOther ways to solve this.\n\n## Priority\nHow important is this?\n`,
  },
  {
    name: 'Decision Record Template',
    folder: 'Document Library, Knowledge/Templates',
    content: `# ADR-XXX: [Title]\n\n## Status\nProposed | Accepted | Deprecated | Superseded\n\n## Context\nWhat is the issue that we're seeing?\n\n## Decision\nWhat is the change that we're proposing?\n\n## Consequences\nWhat becomes easier or harder?\n`,
  },

  // Design folder
  {
    name: 'Design System Overview',
    folder: 'Document Library, Knowledge/Design',
    metadata: { type: 'document', status: 'active', owner: 'Eva Martinez', review_date: getDateOffset(35), last_reviewed: getDateOffset(-10), review_cycle: 'quarterly', version: '3.0', tags: ['document', 'design'] },
    content: `# Design System Overview\n\n## Colors\n- Primary: #6366f1\n- Secondary: #8b5cf6\n- Success: #22c55e\n- Warning: #f59e0b\n- Error: #ef4444\n\n## Typography\n- Headings: Inter\n- Body: Inter\n- Code: JetBrains Mono\n\n## Spacing\n- xs: 4px\n- sm: 8px\n- md: 16px\n- lg: 24px\n- xl: 32px\n`,
  },
  {
    name: 'Component Library',
    folder: 'Document Library, Knowledge/Design',
    metadata: { type: 'document', status: 'active', owner: 'Eva Martinez', review_date: getDateOffset(7), last_reviewed: getDateOffset(-21), review_cycle: 'monthly', version: '2.5', tags: ['document', 'design', 'components'] },
    content: `# Component Library\n\n## Buttons\n- Primary: Solid, accent color\n- Secondary: Outline, neutral\n- Ghost: Transparent, hover effect\n- Destructive: Red, for dangerous actions\n\n## Forms\n- Text Input\n- Textarea\n- Select\n- Checkbox\n- Radio\n- Toggle\n\n## Feedback\n- Toast notifications\n- Modal dialogs\n- Tooltips\n- Progress bars\n`,
  },
  {
    name: 'Accessibility Guidelines',
    folder: 'Document Library, Knowledge/Design',
    metadata: { type: 'document', status: 'active', owner: 'Eva Martinez', review_date: getDateOffset(60), last_reviewed: getDateOffset(-30), review_cycle: 'quarterly', version: '1.0', tags: ['document', 'design', 'a11y'] },
    content: `# Accessibility Guidelines\n\n## WCAG 2.1 AA Compliance\n\n### Perceivable\n- Color contrast ratio: 4.5:1 minimum\n- Text alternatives for images\n- Captions for videos\n\n### Operable\n- Keyboard navigation\n- Focus indicators\n- No motion that causes seizures\n\n### Understandable\n- Clear language\n- Predictable navigation\n- Input assistance\n\n### Robust\n- Valid HTML\n- ARIA labels\n- Screen reader testing\n`,
  },

  // Operations folder
  {
    name: 'Runbook - Database Failover',
    folder: 'Document Library, Knowledge/Operations',
    metadata: { type: 'document', status: 'active', owner: 'David Kim', review_date: getDateOffset(0), last_reviewed: getDateOffset(-30), review_cycle: 'monthly', version: '2.0', tags: ['document', 'operations', 'runbook'] },
    content: `# Runbook: Database Failover\n\n## When to Use\n- Primary database unresponsive\n- Planned maintenance\n\n## Prerequisites\n- VPN access\n- Database admin credentials\n- PagerDuty access\n\n## Steps\n1. Verify primary is down\n2. Check replication lag\n3. Promote replica\n4. Update connection strings\n5. Verify application health\n\n## Rollback\n1. Point back to original primary\n2. Resync data\n`,
  },
  {
    name: 'Runbook - Scaling',
    folder: 'Document Library, Knowledge/Operations',
    metadata: { type: 'document', status: 'active', owner: 'David Kim', review_date: getDateOffset(14), last_reviewed: getDateOffset(-16), review_cycle: 'monthly', version: '1.3', tags: ['document', 'operations', 'runbook'] },
    content: `# Runbook: Application Scaling\n\n## When to Use\n- High traffic events\n- CPU > 80% sustained\n- Memory > 85%\n\n## Auto-Scaling Rules\n- Min instances: 2\n- Max instances: 10\n- Scale up: CPU > 70% for 3 minutes\n- Scale down: CPU < 30% for 10 minutes\n\n## Manual Scaling\n\`\`\`bash\naws ecs update-service --desired-count N\n\`\`\`\n\n## Monitoring\n- CloudWatch dashboard\n- PagerDuty alerts\n`,
  },
  {
    name: 'On-Call Handbook',
    folder: 'Document Library, Knowledge/Operations',
    metadata: { type: 'document', status: 'active', owner: 'David Kim', review_date: getDateOffset(45), last_reviewed: getDateOffset(-15), review_cycle: 'quarterly', version: '1.5', tags: ['document', 'operations'] },
    content: `# On-Call Handbook\n\n## Responsibilities\n- Acknowledge alerts within 5 minutes\n- Assess severity\n- Engage others if needed\n- Document in incident channel\n\n## Escalation Path\n1. Primary on-call\n2. Secondary on-call\n3. Engineering manager\n4. CTO\n\n## Useful Links\n- [Runbooks](./Runbooks)\n- [Monitoring Dashboard](#)\n- [Status Page](#)\n`,
  },

  // Security folder
  {
    name: 'Security Incident Response Plan',
    folder: 'Document Library, Knowledge/Security',
    metadata: { type: 'document', status: 'active', owner: 'Bob Wilson', review_date: getDateOffset(10), last_reviewed: getDateOffset(-20), review_cycle: 'monthly', version: '3.1', tags: ['document', 'security'] },
    content: `# Security Incident Response Plan\n\n## Severity Levels\n- P1: Data breach, production down\n- P2: Security vulnerability exploited\n- P3: Suspicious activity detected\n- P4: Potential vulnerability found\n\n## Response Steps\n1. Contain the incident\n2. Preserve evidence\n3. Notify stakeholders\n4. Remediate\n5. Post-incident review\n\n## Contacts\n- Security Team: security@example.com\n- Legal: legal@example.com\n`,
  },
  {
    name: 'Secret Management Guide',
    folder: 'Document Library, Knowledge/Security',
    metadata: { type: 'document', status: 'active', owner: 'Bob Wilson', review_date: getDateOffset(25), last_reviewed: getDateOffset(-5), review_cycle: 'quarterly', version: '2.0', tags: ['document', 'security'] },
    content: `# Secret Management Guide\n\n## Approved Solutions\n- AWS Secrets Manager (production)\n- Doppler (development)\n- 1Password (personal)\n\n## Never Do\n- Commit secrets to git\n- Share via Slack/email\n- Store in plain text files\n\n## Rotation Policy\n- API keys: 90 days\n- Database passwords: 180 days\n- SSH keys: Annually\n`,
  },
  {
    name: 'Penetration Test Report 2025',
    folder: 'Document Library, Knowledge/Security',
    metadata: { type: 'document', status: 'archived', owner: 'Bob Wilson', review_date: getDateOffset(180), last_reviewed: getDateOffset(-60), review_cycle: 'yearly', version: '1.0', tags: ['document', 'security', 'pentest'] },
    content: `# Penetration Test Report - December 2025\n\n## Executive Summary\nAnnual penetration test completed by SecureCorp.\n\n## Findings Summary\n- Critical: 0\n- High: 1\n- Medium: 3\n- Low: 5\n\n## High Findings\n### H1: Session Fixation\n- Status: Remediated\n- Fix: Regenerate session on login\n\n## Remediation Status\nAll high and medium findings addressed.\n`,
  },
];

// Sample tasks with various states for testing views and all 18 demo bases
const TASKS = [
  // ============================================================
  // OVERDUE TASKS
  // ============================================================
  {
    name: 'Review security findings',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(-3),
    assignee: 'Bob Wilson',
    creator: 'Carol Davis',
    projects: ['Security Audit Checklist'],
    timeEstimate: 60,
    timeEntries: [
      { startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() - 5400000).toISOString() },
    ],
    contexts: ['security', 'audit'],
    reminders: [
      { id: 'rem_sec_1', type: 'relative', relatedTo: 'due', offset: 1, unit: 'days', direction: 'before', description: '1 day before due' },
    ],
  },
  {
    name: 'Submit compliance report',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(-1),
    assignee: 'Bob Wilson',
    creator: 'Carol Davis',
    projects: ['SOC 2 Type II Preparation'],
    timeEstimate: 120,
    timeEntries: [
      { startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 82800000).toISOString() },
    ],
    contexts: ['compliance'],
    blockedBy: ['Review security findings'],
  },
  {
    name: 'Finalize vendor assessment',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(-2),
    assignee: 'Bob Wilson',
    creator: 'Bob Wilson',
    projects: ['Vendor Security Assessment Template'],
    contexts: ['compliance', 'vendor'],
    timeEstimate: 90,
  },

  // ============================================================
  // DUE TODAY
  // ============================================================
  {
    name: 'Update API documentation',
    status: 'in-progress',
    priority: 'medium',
    scheduled: getTodayDate(),
    due: getDateOffset(2),
    assignee: 'Alice Chen',
    creator: 'Alice Chen',
    projects: ['API Documentation'],
    timeEstimate: 90,
    timeEntries: [
      { startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString() },
      { startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() - 5400000).toISOString() },
    ],
    contexts: ['documentation', 'api'],
    blocking: ['Write integration tests for API'],
  },
  {
    name: 'Deploy hotfix to production',
    status: 'pending',
    priority: 'high',
    due: getTodayDate(),
    scheduled: getTodayDate(),
    assignee: 'David Kim',
    creator: 'Cybersader',
    contexts: ['urgent', 'production'],
    reminders: [
      { id: 'rem_deploy_1', type: 'relative', relatedTo: 'due', offset: 1, unit: 'hours', direction: 'before', description: '1 hour before due' },
      { id: 'rem_deploy_2', type: 'relative', relatedTo: 'due', offset: 30, unit: 'minutes', direction: 'before', description: '30 min before due' },
    ],
    blockedBy: ['Run staging environment tests'],
  },
  {
    name: 'Review pull requests',
    status: 'pending',
    priority: 'medium',
    due: getTodayDate(),
    assignee: 'Core Reviewers',
    projects: ['Sprint 42 Planning'],
    contexts: ['code-review'],
    timeEstimate: 60,
  },

  // ============================================================
  // DUE TOMORROW
  // ============================================================
  {
    name: 'Complete sprint planning',
    status: 'pending',
    priority: 'high',
    due: getTomorrowDate(),
    scheduled: getTodayDate(),
    assignee: 'Carol Davis',
    creator: 'Carol Davis',
    projects: ['Sprint 42 Planning'],
    contexts: ['meeting', 'planning'],
    timeEstimate: 120,
    reminders: [
      { id: 'rem_sprint_1', type: 'relative', relatedTo: 'due', offset: 2, unit: 'hours', direction: 'before', description: '2 hours before meeting' },
    ],
    subtasks: ['Prepare demo for stakeholders', 'Write sprint retrospective notes'],
  },
  {
    name: 'Finalize design mockups',
    status: 'in-progress',
    priority: 'medium',
    due: getTomorrowDate(),
    scheduled: getTodayDate(),
    assignee: 'Eva Martinez',
    creator: 'Carol Davis',
    projects: ['Mobile App Initiative'],
    contexts: ['design', 'mobile'],
    timeEstimate: 180,
    timeEntries: [
      { startTime: new Date(Date.now() - 10800000).toISOString(), endTime: new Date(Date.now() - 7200000).toISOString() },
      { startTime: new Date(Date.now() - 3600000).toISOString() },
    ],
    blocking: ['Implement mobile navigation component'],
  },
  {
    name: 'Design review meeting',
    status: 'pending',
    priority: 'medium',
    due: getTomorrowDate(),
    assignee: 'Product Team',
    contexts: ['meeting', 'design'],
    reminders: [
      { id: 'rem_design_1', type: 'relative', relatedTo: 'due', offset: 1, unit: 'hours', direction: 'before', description: '1 hour before meeting' },
    ],
  },

  // ============================================================
  // DUE THIS WEEK
  // ============================================================
  {
    name: 'Fix notification bugs',
    status: 'in-progress',
    priority: 'medium',
    due: getDateOffset(3),
    scheduled: getTodayDate(),
    assignee: 'Cybersader',
    creator: 'Cybersader',
    contexts: ['bug', 'notifications'],
    timeEstimate: 45,
    timeEntries: [
      { startTime: new Date(Date.now() - 5400000).toISOString(), endTime: new Date(Date.now() - 3600000).toISOString() },
    ],
    blocking: ['Write unit tests for notification service'],
  },
  {
    name: 'Write unit tests for avatar component',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(4),
    assignee: 'Alice Chen',
    creator: 'Alice Chen',
    contexts: ['testing'],
    timeEstimate: 120,
    blockedBy: ['Design avatar component'],
  },
  {
    name: 'Prepare demo for stakeholders',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(5),
    assignee: 'Carol Davis',
    projects: ['Project Alpha Requirements'],
    contexts: ['presentation'],
    parent: 'Complete sprint planning',
    reminders: [
      { id: 'rem_demo_1', type: 'relative', relatedTo: 'due', offset: 1, unit: 'days', direction: 'before', description: '1 day before demo' },
      { id: 'rem_demo_2', type: 'relative', relatedTo: 'due', offset: 3, unit: 'hours', direction: 'before', description: '3 hours before demo' },
    ],
    timeEstimate: 60,
  },
  {
    name: 'Run staging environment tests',
    status: 'in-progress',
    priority: 'high',
    due: getDateOffset(2),
    assignee: 'Frank Johnson',
    creator: 'David Kim',
    contexts: ['testing', 'staging'],
    timeEstimate: 90,
    timeEntries: [
      { startTime: new Date(Date.now() - 1800000).toISOString() },
    ],
    blocking: ['Deploy hotfix to production'],
  },
  {
    name: 'Write integration tests for API',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(4),
    assignee: 'Alice Chen',
    creator: 'Alice Chen',
    projects: ['API Documentation'],
    contexts: ['testing', 'api'],
    timeEstimate: 150,
    blockedBy: ['Update API documentation'],
  },
  {
    name: 'Write sprint retrospective notes',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(5),
    assignee: 'Carol Davis',
    parent: 'Complete sprint planning',
    contexts: ['documentation', 'sprint'],
  },

  // ============================================================
  // DUE NEXT WEEK — with recurrence and dependencies
  // ============================================================
  {
    name: 'Weekly standup',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(7),
    scheduled: getDateOffset(7),
    assignee: 'Engineering Team',
    contexts: ['meeting'],
    recurrence: 'FREQ=WEEKLY;BYDAY=MO',
    reminders: [
      { id: 'rem_standup_1', type: 'relative', relatedTo: 'due', offset: 15, unit: 'minutes', direction: 'before', description: '15 min before standup' },
    ],
  },
  {
    name: 'Complete database migration',
    status: 'pending',
    priority: 'medium',
    due: getNextWeekDate(),
    assignee: 'David Kim',
    creator: 'Cybersader',
    projects: ['Architecture Overview'],
    timeEstimate: 240,
    timeEntries: [
      { startTime: new Date(Date.now() - 172800000).toISOString(), endTime: new Date(Date.now() - 169200000).toISOString() },
    ],
    blocking: ['Update runbooks', 'Verify database backup integrity'],
    contexts: ['database', 'migration'],
  },
  {
    name: 'Update runbooks',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(10),
    assignee: 'David Kim',
    projects: ['Runbook - Database Failover'],
    contexts: ['documentation'],
    blockedBy: ['Complete database migration'],
  },
  {
    name: 'Conduct user interviews',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(12),
    scheduled: getDateOffset(10),
    assignee: 'Eva Martinez',
    creator: 'Carol Davis',
    projects: ['User Feedback Summary Q4 2025'],
    contexts: ['research', 'ux'],
    timeEstimate: 120,
    reminders: [
      { id: 'rem_interview_1', type: 'relative', relatedTo: 'due', offset: 2, unit: 'days', direction: 'before', description: '2 days before interviews' },
    ],
  },
  {
    name: 'Write unit tests for notification service',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(8),
    assignee: 'Cybersader',
    contexts: ['testing', 'notifications'],
    timeEstimate: 120,
    blockedBy: ['Fix notification bugs'],
  },
  {
    name: 'Implement mobile navigation component',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(9),
    assignee: 'Alice Chen',
    creator: 'Eva Martinez',
    projects: ['Mobile App Initiative'],
    contexts: ['mobile', 'feature'],
    timeEstimate: 240,
    blockedBy: ['Finalize design mockups'],
    blocking: ['Mobile app smoke tests'],
  },
  {
    name: 'Verify database backup integrity',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(8),
    assignee: 'David Kim',
    contexts: ['database', 'operations'],
    timeEstimate: 45,
    blockedBy: ['Complete database migration'],
  },
  {
    name: 'Team retrospective',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(7),
    assignee: 'All Staff',
    contexts: ['meeting'],
    recurrence: 'FREQ=WEEKLY;BYDAY=FR',
  },

  // ============================================================
  // DUE LATER — with recurrence
  // ============================================================
  {
    name: 'Monthly security review',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(28),
    assignee: 'Bob Wilson',
    creator: 'Bob Wilson',
    projects: ['Security Incident Response Plan'],
    recurrence: 'FREQ=MONTHLY;BYMONTHDAY=1',
    contexts: ['security', 'compliance'],
    timeEstimate: 180,
    reminders: [
      { id: 'rem_secrev_1', type: 'relative', relatedTo: 'due', offset: 3, unit: 'days', direction: 'before', description: '3 days before review' },
    ],
  },
  {
    name: 'Plan Q2 roadmap',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(30),
    assignee: 'Carol Davis',
    projects: ['Q1 2026 Roadmap'],
    contexts: ['planning', 'roadmap'],
  },
  {
    name: 'Implement AI task parsing',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(45),
    assignee: 'Cybersader',
    projects: ['AI Integration Research'],
    contexts: ['ai', 'feature'],
    timeEstimate: 480,
  },
  {
    name: 'Security awareness session',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(14),
    assignee: 'Security Team',
    creator: 'Bob Wilson',
    projects: ['Security Incident Response Plan'],
    recurrence: 'FREQ=MONTHLY;BYMONTHDAY=15',
    reminders: [
      { id: 'rem_security_1', type: 'relative', relatedTo: 'due', offset: 3, unit: 'days', direction: 'before', description: '3 days before session' },
      { id: 'rem_security_2', type: 'relative', relatedTo: 'due', offset: 1, unit: 'hours', direction: 'before', description: '1 hour before session' },
    ],
    contexts: ['security', 'training'],
  },
  {
    name: 'Quarterly compliance audit',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(60),
    assignee: 'Bob Wilson',
    creator: 'Carol Davis',
    projects: ['GDPR Compliance Review'],
    recurrence: 'FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=1',
    contexts: ['compliance', 'audit'],
    timeEstimate: 360,
    reminders: [
      { id: 'rem_audit_1', type: 'relative', relatedTo: 'due', offset: 7, unit: 'days', direction: 'before', description: '1 week before audit' },
    ],
  },
  {
    name: 'Daily standup notes',
    status: 'pending',
    priority: 'low',
    due: getDateOffset(1),
    scheduled: getDateOffset(1),
    assignee: 'Cybersader',
    recurrence: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR',
    contexts: ['meeting', 'daily'],
  },
  {
    name: 'Biweekly 1-on-1 with manager',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(14),
    assignee: 'Alice Chen',
    recurrence: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TH',
    contexts: ['meeting', 'one-on-one'],
    reminders: [
      { id: 'rem_1on1_1', type: 'relative', relatedTo: 'due', offset: 1, unit: 'hours', direction: 'before', description: '1 hour before meeting' },
    ],
  },
  {
    name: 'Mobile app smoke tests',
    status: 'pending',
    priority: 'medium',
    due: getDateOffset(15),
    assignee: 'Frank Johnson',
    creator: 'Alice Chen',
    projects: ['Mobile App Initiative'],
    contexts: ['testing', 'mobile'],
    timeEstimate: 120,
    blockedBy: ['Implement mobile navigation component'],
  },

  // ============================================================
  // COMPLETED TASKS (for Completed Tasks Demo)
  // ============================================================
  {
    name: 'Design avatar component',
    status: 'done',
    priority: 'low',
    completedDate: getYesterdayDate(),
    assignee: 'Eva Martinez',
    creator: 'Carol Davis',
    contexts: ['design'],
    projects: ['Component Library'],
    timeEstimate: 120,
    timeEntries: [
      { startTime: new Date(Date.now() - 259200000).toISOString(), endTime: new Date(Date.now() - 252000000).toISOString() },
      { startTime: new Date(Date.now() - 172800000).toISOString(), endTime: new Date(Date.now() - 169200000).toISOString() },
    ],
  },
  {
    name: 'Set up CI pipeline',
    status: 'done',
    priority: 'high',
    completedDate: getDateOffset(-5),
    assignee: 'David Kim',
    creator: 'Cybersader',
    projects: ['Deployment Guide'],
    contexts: ['devops'],
    timeEstimate: 300,
    timeEntries: [
      { startTime: new Date(Date.now() - 604800000).toISOString(), endTime: new Date(Date.now() - 590400000).toISOString() },
      { startTime: new Date(Date.now() - 518400000).toISOString(), endTime: new Date(Date.now() - 504000000).toISOString() },
    ],
  },
  {
    name: 'Complete security training',
    status: 'done',
    priority: 'medium',
    completedDate: getDateOffset(-7),
    assignee: 'Engineering Team',
    projects: ['Onboarding Guide'],
    contexts: ['training'],
  },
  {
    name: 'Implement user authentication',
    status: 'done',
    priority: 'high',
    completedDate: getDateOffset(-3),
    assignee: 'Cybersader',
    creator: 'Carol Davis',
    projects: ['Project Alpha Requirements'],
    contexts: ['feature', 'auth'],
    timeEstimate: 480,
    timeEntries: [
      { startTime: new Date(Date.now() - 432000000).toISOString(), endTime: new Date(Date.now() - 417600000).toISOString() },
      { startTime: new Date(Date.now() - 345600000).toISOString(), endTime: new Date(Date.now() - 331200000).toISOString() },
      { startTime: new Date(Date.now() - 259200000).toISOString(), endTime: new Date(Date.now() - 252000000).toISOString() },
    ],
  },
  {
    name: 'Create onboarding documentation',
    status: 'done',
    priority: 'medium',
    completedDate: getDateOffset(-10),
    assignee: 'Carol Davis',
    creator: 'Carol Davis',
    projects: ['Onboarding Guide'],
    contexts: ['documentation', 'hr'],
    timeEstimate: 180,
    timeEntries: [
      { startTime: new Date(Date.now() - 864000000).toISOString(), endTime: new Date(Date.now() - 856800000).toISOString() },
    ],
  },
  {
    name: 'Fix login page CSS',
    status: 'done',
    priority: 'low',
    completedDate: getDateOffset(-2),
    assignee: 'Eva Martinez',
    contexts: ['bug', 'css'],
  },
  {
    name: 'Set up monitoring dashboard',
    status: 'done',
    priority: 'medium',
    completedDate: getDateOffset(-14),
    assignee: 'David Kim',
    creator: 'David Kim',
    projects: ['Runbook - Scaling'],
    contexts: ['operations', 'monitoring'],
    timeEstimate: 240,
    timeEntries: [
      { startTime: new Date(Date.now() - 1296000000).toISOString(), endTime: new Date(Date.now() - 1281600000).toISOString() },
    ],
  },
  {
    name: 'Write GDPR data mapping document',
    status: 'done',
    priority: 'high',
    completedDate: getDateOffset(-4),
    assignee: 'Bob Wilson',
    creator: 'Carol Davis',
    projects: ['GDPR Compliance Review'],
    contexts: ['compliance', 'privacy'],
    timeEstimate: 300,
    timeEntries: [
      { startTime: new Date(Date.now() - 518400000).toISOString(), endTime: new Date(Date.now() - 504000000).toISOString() },
      { startTime: new Date(Date.now() - 432000000).toISOString(), endTime: new Date(Date.now() - 421200000).toISOString() },
    ],
  },
  {
    name: 'Migrate legacy API endpoints',
    status: 'done',
    priority: 'medium',
    completedDate: getDateOffset(-21),
    assignee: 'Alice Chen',
    creator: 'Cybersader',
    projects: ['API Documentation'],
    contexts: ['api', 'migration'],
    timeEstimate: 360,
    timeEntries: [
      { startTime: new Date(Date.now() - 2073600000).toISOString(), endTime: new Date(Date.now() - 2059200000).toISOString() },
      { startTime: new Date(Date.now() - 1987200000).toISOString(), endTime: new Date(Date.now() - 1972800000).toISOString() },
    ],
  },
  {
    name: 'Conduct penetration test follow-up',
    status: 'done',
    priority: 'high',
    completedDate: getDateOffset(-30),
    assignee: 'Bob Wilson',
    projects: ['Penetration Test Report 2025'],
    contexts: ['security', 'pentest'],
    timeEstimate: 240,
  },

  // ============================================================
  // NO DUE DATE (backlog)
  // ============================================================
  {
    name: 'Research GraphQL adoption',
    status: 'pending',
    priority: 'low',
    assignee: 'Alice Chen',
    projects: ['Technology Radar 2026'],
    contexts: ['research', 'graphql'],
  },
  {
    name: 'Document coding standards',
    status: 'pending',
    priority: 'low',
    assignee: 'Engineering Team',
    contexts: ['documentation', 'standards'],
  },
  {
    name: 'Evaluate new monitoring tools',
    status: 'pending',
    priority: 'medium',
    assignee: 'David Kim',
    creator: 'David Kim',
    contexts: ['operations', 'research'],
    timeEstimate: 180,
  },
  {
    name: 'Prototype dark mode theme',
    status: 'pending',
    priority: 'low',
    assignee: 'Eva Martinez',
    creator: 'Eva Martinez',
    projects: ['Design System Overview'],
    contexts: ['design', 'feature'],
    timeEstimate: 240,
  },
  {
    name: 'Refactor task service layer',
    status: 'in-progress',
    priority: 'medium',
    assignee: 'Cybersader',
    creator: 'Cybersader',
    contexts: ['refactor', 'architecture'],
    timeEstimate: 300,
    timeEntries: [
      { startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 79200000).toISOString() },
    ],
  },

  // ============================================================
  // PARENT TASKS WITH SUBTASKS (for Project Dependencies Demo)
  // ============================================================
  {
    name: 'Launch Project Beta',
    status: 'in-progress',
    priority: 'high',
    due: getDateOffset(20),
    assignee: 'Carol Davis',
    creator: 'Carol Davis',
    projects: ['Project Beta Launch Plan'],
    contexts: ['project', 'launch'],
    subtasks: ['Complete feature freeze', 'Run load testing', 'Security review for launch'],
    timeEstimate: 60,
  },
  {
    name: 'Complete feature freeze',
    status: 'in-progress',
    priority: 'high',
    due: getDateOffset(12),
    assignee: 'Alice Chen',
    creator: 'Carol Davis',
    projects: ['Project Beta Launch Plan'],
    parent: 'Launch Project Beta',
    blocking: ['Run load testing'],
    contexts: ['development'],
    timeEstimate: 120,
  },
  {
    name: 'Run load testing',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(16),
    assignee: 'Frank Johnson',
    creator: 'Carol Davis',
    projects: ['Project Beta Launch Plan'],
    parent: 'Launch Project Beta',
    blockedBy: ['Complete feature freeze'],
    blocking: ['Security review for launch'],
    contexts: ['testing', 'performance'],
    timeEstimate: 180,
  },
  {
    name: 'Security review for launch',
    status: 'pending',
    priority: 'high',
    due: getDateOffset(18),
    assignee: 'Bob Wilson',
    creator: 'Carol Davis',
    projects: ['Project Beta Launch Plan'],
    parent: 'Launch Project Beta',
    blockedBy: ['Run load testing'],
    contexts: ['security', 'review'],
    timeEstimate: 120,
    reminders: [
      { id: 'rem_seclaunch_1', type: 'relative', relatedTo: 'due', offset: 2, unit: 'days', direction: 'before', description: '2 days before review' },
    ],
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

// Fields that bulk-convert or task creation can inject into a non-task note
const TASK_INJECTED_FIELDS = ['isTask', 'priority', 'dateCreated', 'dateModified', 'projects',
  'due', 'scheduled', 'assignee', 'assignees', 'tnType', 'tnId', 'completedDate',
  'recurrence', 'reminders', 'timeEstimate', 'timeEntries', 'blockedBy', 'blocking',
  'subtasks', 'parent', 'creator', 'contexts'];

function stripTaskFieldsFromFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return false;

  const lines = fmMatch[1].split('\n');
  const cleanedLines = [];
  let skipping = false;

  for (const line of lines) {
    const isTaskField = TASK_INJECTED_FIELDS.some(f => line.match(new RegExp(`^${f}:`)));
    if (isTaskField) { skipping = true; continue; }
    if (skipping) {
      if (line.match(/^\s+/) || line.match(/^\s*-\s/)) continue;
      skipping = false;
    }
    cleanedLines.push(line);
  }

  const cleaned = content.replace(/^---\n[\s\S]*?\n---/, `---\n${cleanedLines.join('\n')}\n---`);
  if (cleaned !== content) {
    writeFileSync(filePath, cleaned, 'utf-8');
    return true;
  }
  return false;
}

function stripTaskFieldsFromDir(dirPath) {
  if (!existsSync(dirPath)) return;
  const files = readdirSync(dirPath).filter(f => f.endsWith('.md'));
  let stripped = 0;
  for (const file of files) {
    if (stripTaskFieldsFromFile(join(dirPath, file))) stripped++;
  }
  if (stripped > 0) {
    console.log(`  Stripped task metadata from ${stripped} file(s) in ${dirPath}`);
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
  // If the document has metadata, generate proper frontmatter
  if (doc.metadata) {
    const lines = [];
    const m = doc.metadata;
    if (m.type) lines.push(`type: ${m.type}`);
    if (m.status) lines.push(`status: ${m.status}`);
    if (m.owner) lines.push(`owner: "[[${m.owner}]]"`);
    if (m.review_date) lines.push(`review_date: ${m.review_date}`);
    if (m.last_reviewed) lines.push(`last_reviewed: ${m.last_reviewed}`);
    if (m.review_cycle) lines.push(`review_cycle: "${m.review_cycle}"`);
    if (m.version) lines.push(`version: "${m.version}"`);
    if (m.tags) {
      lines.push(`tags:`);
      for (const t of m.tags) lines.push(`  - ${t}`);
    }
    return `---\n${lines.join('\n')}\n---\n\n${doc.content}`;
  }
  return doc.content;
}

function generateTaskNote(task) {
  const lines = [];

  // Task identification (required for views and TaskManager)
  lines.push(`isTask: true`);
  lines.push(`title: "${task.name}"`);
  lines.push(`status: ${task.status}`);
  lines.push(`priority: ${task.priority}`);

  // Dates
  if (task.due) lines.push(`due: ${task.due}`);
  if (task.scheduled) lines.push(`scheduled: ${task.scheduled}`);
  if (task.completedDate) lines.push(`completedDate: ${task.completedDate}`);
  lines.push(`dateCreated: ${getTodayDate()}`);

  // Assignee
  if (task.assignee) lines.push(`assignee: "[[${task.assignee}]]"`);

  // Projects (array of wikilinks)
  if (task.projects) {
    lines.push(`projects:`);
    for (const p of task.projects) {
      lines.push(`  - "[[${p}]]"`);
    }
  }

  // Contexts (array of strings)
  if (task.contexts) {
    lines.push(`contexts:`);
    for (const c of task.contexts) {
      lines.push(`  - ${c}`);
    }
  }

  // Tags (always include 'task' for file.hasTag("task") in .base filters)
  lines.push(`tags:`);
  lines.push(`  - task`);

  // Time estimate
  if (task.timeEstimate) lines.push(`timeEstimate: ${task.timeEstimate}`);

  // Recurrence
  if (task.recurrence) lines.push(`recurrence: "${task.recurrence}"`);

  // Reminders (array of objects)
  if (task.reminders) {
    lines.push(`reminders:`);
    for (const r of task.reminders) {
      lines.push(`  - id: "${r.id}"`);
      lines.push(`    type: "${r.type}"`);
      if (r.relatedTo) lines.push(`    relatedTo: "${r.relatedTo}"`);
      if (r.offset !== undefined) lines.push(`    offset: ${r.offset}`);
      if (r.unit) lines.push(`    unit: "${r.unit}"`);
      if (r.direction) lines.push(`    direction: "${r.direction}"`);
      if (r.description) lines.push(`    description: "${r.description}"`);
    }
  }

  // Time entries (array of objects)
  if (task.timeEntries) {
    lines.push(`timeEntries:`);
    for (const te of task.timeEntries) {
      lines.push(`  - startTime: "${te.startTime}"`);
      if (te.endTime) lines.push(`    endTime: "${te.endTime}"`);
    }
  }

  // Dependencies (blockedBy / blocking - arrays of wikilinks)
  if (task.blockedBy) {
    lines.push(`blockedBy:`);
    for (const b of task.blockedBy) {
      lines.push(`  - "[[${b}]]"`);
    }
  }
  if (task.blocking) {
    lines.push(`blocking:`);
    for (const b of task.blocking) {
      lines.push(`  - "[[${b}]]"`);
    }
  }

  // Parent/subtask relationships
  if (task.parent) lines.push(`parent: "[[${task.parent}]]"`);
  if (task.subtasks) {
    lines.push(`subtasks:`);
    for (const s of task.subtasks) {
      lines.push(`  - "[[${s}]]"`);
    }
  }

  // Creator (shared vault attribution)
  if (task.creator) lines.push(`creator: "[[${task.creator}]]"`);

  return `---
${lines.join('\n')}
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

  // Generated document subdirectories (safe to clean — user files live at root level)
  const docSubdirs = ['Projects', 'Compliance', 'Technical', 'HR', 'Meeting Notes',
    'Research', 'Templates', 'Design', 'Operations', 'Security'];

  if (clean) {
    console.log('Cleaning existing test data...');
    cleanDir(peoplePath);
    cleanDir(groupsPath);
    cleanDir(tasksPath);
    for (const sub of docSubdirs) {
      cleanDir(join(documentsPath, sub));
    }
    // Strip task metadata from root-level user docs (injected by bulk-convert testing)
    stripTaskFieldsFromDir(documentsPath);
    console.log('');
  }

  // Ensure directories exist
  console.log('Ensuring directories...');
  ensureDir(peoplePath);
  ensureDir(groupsPath);
  for (const sub of docSubdirs) {
    ensureDir(join(documentsPath, sub));
  }
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
