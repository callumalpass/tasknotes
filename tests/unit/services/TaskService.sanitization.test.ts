
import { TaskService } from '../../../src/services/TaskService';
import { PluginFactory } from '../../helpers/mock-factories';

describe('TaskService Sanitization', () => {
    let taskService: TaskService;
    let mockPlugin: any;

    beforeEach(() => {
        mockPlugin = PluginFactory.createMockPlugin({});
        taskService = new TaskService(mockPlugin);
    });

    const sanitize = (input: string) => (taskService as any).sanitizeTitleForFilename(input);

    it('should remove wikilink markings but keep the alias', () => {
        expect(sanitize('[[Note Path|Note Alias]]')).toBe('Note Alias');
    });

    it('should remove wikilink markings and keep the path if no alias', () => {
        expect(sanitize('[[Simple Note]]')).toBe('Simple Note');
    });

    it('should remove markdown link markings and keep the text', () => {
        expect(sanitize('[Google](https://google.com)')).toBe('Google');
    });

    it('should remove protocol prefixes', () => {
        expect(sanitize('https://obsidian.md')).toBe('obsidian.md');
        expect(sanitize('http://localhost:3000')).toBe('localhost3000'); // Note: : and / are also removed by existing logic
    });

    it('should handle multiple links and normal text', () => {
        expect(sanitize('Task with [[Link]] and [Markdown](url) and https://site.com')).toBe('Task with Link and Markdown and site.com');
    });

    it('should still perform normal sanitization', () => {
        expect(sanitize('Invalid: <File>?')).toBe('Invalid File');
    });

    it('should handle complex nested-looking strings', () => {
        expect(sanitize('[[Link|Alias]] in [Text](url)')).toBe('Alias in Text');
    });
});
