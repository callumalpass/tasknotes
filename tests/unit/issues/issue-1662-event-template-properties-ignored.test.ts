/**
 * Reproduction test for issue #1662.
 *
 * Reported behavior:
 * - When creating a note from a calendar event, the template file's frontmatter
 *   properties are replaced by vanilla defaults instead of being preserved.
 *   Specifically, Templater syntax (<% tp.xxx %>) in template frontmatter is
 *   lost because processTemplate() cannot parse it.
 *
 * Root cause:
 * - processTemplate() in templateProcessor.ts tries to parse frontmatter YAML
 *   after replacing {{variables}}. Templater syntax (<% %>) produces invalid
 *   YAML that parseYaml() cannot handle, returning {} and losing all template
 *   properties.
 */

import { processTemplate } from '../../../src/utils/templateProcessor';

describe('Issue #1662: Event creation ignores template file properties', () => {
	it.skip('reproduces issue #1662 - template with Templater syntax should preserve properties', () => {
		const templateContent = `---
tags:
  - "#ics_event"
  - "#meeting"
EventID: "{{icsEventId}}"
Calendar: "{{icsEventSubscription}}"
created: <% tp.file.creation_date("YYYY-MM-DD") %>
source: "{{icsEventUrl}}"
description: "{{icsEventDescription}}"
Links:
Area:
People:
Goals:
---

# Actions

# Discussion`;

		const templateData = {
			title: 'Test Event',
			priority: '',
			status: '',
			contexts: [],
			tags: [],
			timeEstimate: 0,
			dueDate: '',
			scheduledDate: '',
			details: '',
			parentNote: '',
			icsEventTitle: 'Test Event',
			icsEventStart: '2026-03-22T10:00:00',
			icsEventEnd: '2026-03-22T11:00:00',
			icsEventLocation: 'Office',
			icsEventDescription: 'Team sync',
			icsEventUrl: 'https://example.com',
			icsEventSubscription: 'Work',
			icsEventId: 'evt-123',
		};

		const result = processTemplate(templateContent, templateData as any);

		// Template properties should be preserved
		expect(result.frontmatter.tags).toContain('#ics_event');
		expect(result.frontmatter.tags).toContain('#meeting');
		expect(result.frontmatter.EventID).toBe('evt-123');
		expect(result.frontmatter.Calendar).toBe('Work');
		// Templater syntax should be preserved as-is for Templater to process later
		expect(result.frontmatter.created).toContain('tp.file.creation_date');
	});
});
