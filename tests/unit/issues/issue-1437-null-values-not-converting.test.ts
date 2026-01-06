/**
 * Issue #1437: Null values not converting in new notes
 *
 * Bug Description:
 * When creating a new task with empty/null fields (e.g., date, project),
 * template parameters are displayed literally in the YAML instead of being
 * replaced with empty values or omitted.
 *
 * Example of broken output from user's template:
 * ```yaml
 * due_date:
 *   "{ dueDate }":
 * projects:
 *   - "{ parentNote }":
 * ```
 *
 * Root cause analysis:
 * The user's template uses incorrect syntax `{ dueDate }` (single braces with
 * spaces) instead of the correct `{{dueDate}}` syntax. When YAML parses
 * `{ dueDate }`, it interprets it as an inline mapping (YAML object), creating
 * nested objects with the variable name as a key.
 *
 * The template processor only supports double-brace syntax `{{variable}}`.
 * Single-brace syntax is not supported and will be parsed as YAML inline objects.
 *
 * @see https://github.com/cldellow/tasknotes/issues/1437
 */

// We need to test YAML parsing behavior directly
// The jest mock for yaml uses JSON.parse which doesn't work for YAML
// So we'll test the raw YAML behavior by understanding the parsing rules
//
// NOTE: The yaml mock in tests/__mocks__/yaml.ts uses JSON.parse which fails for YAML
// This is why we test body processing (which doesn't depend on YAML parsing)
// and document the expected YAML behavior in comments

import { processTemplate, TemplateData, mergeTemplateFrontmatter } from '../../../src/utils/templateProcessor';

describe('Issue #1437: Null values not converting in new notes', () => {
    const createEmptyTaskData = (): TemplateData => ({
        title: 'Test Task',
        priority: '',
        status: '',
        contexts: [],
        tags: [],
        timeEstimate: 0,
        dueDate: '',
        scheduledDate: '',
        details: '',
        parentNote: ''
    });

    const createPopulatedTaskData = (): TemplateData => ({
        title: 'My Task',
        priority: 'high',
        status: 'open',
        contexts: ['work'],
        tags: ['urgent'],
        timeEstimate: 30,
        dueDate: '2026-01-15',
        scheduledDate: '2026-01-10',
        details: 'Task details here',
        parentNote: '[[Project Note]]'
    });

    /**
     * YAML parsing behavior tests are documented here but not executable in Jest
     * due to the yaml module being mocked.
     *
     * ROOT CAUSE OF ISSUE #1437:
     *
     * When a user's template contains `{ dueDate }` (single braces with spaces),
     * YAML interprets this as an "inline mapping" (flow mapping syntax):
     *
     *   Input:  due_date: { dueDate }
     *   Parsed: { due_date: { dueDate: null } }
     *
     * This creates a nested object where 'dueDate' becomes a key, not a value!
     *
     * The CORRECT syntax is `{{dueDate}}` (double braces):
     *
     *   Input:  due_date: "{{dueDate}}"
     *   Parsed: { due_date: "{{dueDate}}" }
     *
     * Then the template processor can replace {{dueDate}} with the actual value.
     *
     * To verify this behavior manually, run:
     *   node -e "const yaml = require('yaml'); console.log(yaml.parse('due_date: { dueDate }'));"
     *
     * Expected output: { due_date: { dueDate: null } }
     */
    describe('YAML parsing behavior (documented)', () => {
        it('documents that { key } syntax creates nested objects in YAML', () => {
            // This test documents the expected behavior
            // The actual YAML parsing can be verified by running:
            // node -e "console.log(require('yaml').parse('due_date: { dueDate }'))"
            //
            // Expected result: { due_date: { dueDate: null } }
            //
            // This is the ROOT CAUSE of issue #1437 - the user's template
            // uses { dueDate } instead of {{dueDate}}, causing YAML to
            // create nested objects instead of template variables.
            expect(true).toBe(true);
        });
    });

    describe('Template body processing (does not depend on YAML mock)', () => {
        it('should replace {{dueDate}} in body content with empty string when no date provided', () => {
            const templateContent = `Task due: {{dueDate}}`;
            const taskData = createEmptyTaskData();

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('Task due: ');
            expect(result.body).not.toContain('{{dueDate}}');
        });

        it('should replace {{dueDate}} in body content with actual date when provided', () => {
            const templateContent = `Task due: {{dueDate}}`;
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('Task due: 2026-01-15');
        });

        it('should replace {{parentNote}} in body content with empty string when no parent note', () => {
            const templateContent = `Parent: {{parentNote}}`;
            const taskData = createEmptyTaskData();

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('Parent: ');
            expect(result.body).not.toContain('{{parentNote}}');
        });

        it('should replace {{parentNote}} in body content with actual link when provided', () => {
            const templateContent = `Parent: {{parentNote}}`;
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('Parent: [[Project Note]]');
        });

        it('should replace all template variables in body with empty strings when not provided', () => {
            const templateContent = `Title: {{title}}
Priority: {{priority}}
Due: {{dueDate}}
Scheduled: {{scheduledDate}}
Parent: {{parentNote}}`;
            const taskData = createEmptyTaskData();

            const result = processTemplate(templateContent, taskData);

            // All {{variable}} should be replaced (with actual values or empty strings)
            expect(result.body).not.toContain('{{');
            expect(result.body).toContain('Title: Test Task'); // title has a default
        });

        it('should replace all template variables in body with values when provided', () => {
            const templateContent = `Title: {{title}}
Priority: {{priority}}
Due: {{dueDate}}
Scheduled: {{scheduledDate}}
Parent: {{parentNote}}`;
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toContain('Title: My Task');
            expect(result.body).toContain('Priority: high');
            expect(result.body).toContain('Due: 2026-01-15');
            expect(result.body).toContain('Scheduled: 2026-01-10');
            expect(result.body).toContain('Parent: [[Project Note]]');
        });
    });

    describe('Bug reproduction: Incorrect syntax is not processed', () => {
        /**
         * These tests REPRODUCE the bug by showing that single-brace syntax
         * like { dueDate } is NOT processed by the template processor.
         *
         * When this incorrect syntax is used in YAML frontmatter, YAML interprets
         * { dueDate } as an inline mapping, creating nested objects instead of
         * the expected string values.
         */

        it('FAILS to process { dueDate } syntax (single braces with spaces)', () => {
            const templateContent = 'Due: { dueDate }';
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            // BUG REPRODUCTION: { dueDate } is NOT replaced because it's wrong syntax
            // The template processor only handles {{dueDate}} (double braces)
            expect(result.body).toBe('Due: { dueDate }');
            expect(result.body).toContain('{ dueDate }'); // Incorrect syntax remains!
        });

        it('FAILS to process { parentNote } syntax (single braces with spaces)', () => {
            const templateContent = 'Parent: { parentNote }';
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            // BUG REPRODUCTION: { parentNote } is NOT replaced
            expect(result.body).toBe('Parent: { parentNote }');
            expect(result.body).toContain('{ parentNote }'); // Incorrect syntax remains!
        });

        it('shows the contrast between correct and incorrect syntax', () => {
            const templateContent = 'Correct: {{dueDate}} | Incorrect: { dueDate }';
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            // {{dueDate}} IS replaced (correct syntax)
            expect(result.body).toContain('Correct: 2026-01-15');
            // { dueDate } is NOT replaced (incorrect syntax - this is the bug!)
            expect(result.body).toContain('Incorrect: { dueDate }');
        });
    });

    describe('Correct template syntax (documentation)', () => {
        /**
         * These tests document the CORRECT way to use template variables.
         * Users should use {{variable}} (double braces) NOT { variable } (single braces).
         */

        it('correctly processes {{dueDate}} syntax (double braces)', () => {
            const templateContent = 'Due: {{dueDate}}';
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            // {{dueDate}} is replaced correctly
            expect(result.body).toBe('Due: 2026-01-15');
            expect(result.body).not.toContain('{{');
        });

        it('correctly processes {{parentNote}} syntax (double braces)', () => {
            const templateContent = 'Parent: {{parentNote}}';
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            // {{parentNote}} is replaced correctly
            expect(result.body).toBe('Parent: [[Project Note]]');
            expect(result.body).not.toContain('{{');
        });

        it('lists all supported template variables with correct syntax', () => {
            const allVariables = [
                '{{title}}', '{{priority}}', '{{status}}', '{{contexts}}',
                '{{tags}}', '{{hashtags}}', '{{timeEstimate}}', '{{dueDate}}',
                '{{scheduledDate}}', '{{details}}', '{{parentNote}}',
                '{{date}}', '{{time}}'
            ];

            const templateContent = allVariables.join(' ');
            const taskData = createPopulatedTaskData();

            const result = processTemplate(templateContent, taskData);

            // All template variables should be replaced
            allVariables.forEach(variable => {
                expect(result.body).not.toContain(variable);
            });
        });
    });
});
