import { processTemplate, TemplateData } from '../../../src/utils/templateProcessor';

describe('templateProcessor', () => {
    describe('hashtags template variable', () => {
        it('should render tags as space-separated hashtags', () => {
            const templateContent = '- [ ] {{hashtags}} test task';
            const taskData: TemplateData = {
                title: 'Test Task',
                priority: '',
                status: '',
                contexts: [],
                tags: ['work', 'report', 'deliver'],
                timeEstimate: 0,
                dueDate: '',
                scheduledDate: '',
                details: '',
                parentNote: ''
            };

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('- [ ] #work #report #deliver test task');
        });

        it('should handle empty tags array', () => {
            const templateContent = '- [ ] {{hashtags}} test task';
            const taskData: TemplateData = {
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
            };

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('- [ ]  test task');
        });

        it('should handle single tag', () => {
            const templateContent = '- [ ] {{hashtags}} test task';
            const taskData: TemplateData = {
                title: 'Test Task',
                priority: '',
                status: '',
                contexts: [],
                tags: ['task'],
                timeEstimate: 0,
                dueDate: '',
                scheduledDate: '',
                details: '',
                parentNote: ''
            };

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('- [ ] #task test task');
        });

        it('should match behavior of existing tags variable for comparison', () => {
            const templateContent = 'Tags: {{tags}}, Hashtags: {{hashtags}}';
            const taskData: TemplateData = {
                title: 'Test Task',
                priority: '',
                status: '',
                contexts: [],
                tags: ['work', 'urgent', 'important'],
                timeEstimate: 0,
                dueDate: '',
                scheduledDate: '',
                details: '',
                parentNote: ''
            };

            const result = processTemplate(templateContent, taskData);

            expect(result.body).toBe('Tags: work, urgent, important, Hashtags: #work #urgent #important');
        });
    });
});