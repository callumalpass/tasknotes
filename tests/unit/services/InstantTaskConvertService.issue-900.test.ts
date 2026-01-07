/**
 * InstantTaskConvertService Issue #900 Tests
 *
 * Feature Request: Add the ability to keep the [ ] when using the instant task conversion
 *
 * When a task in daily notes is converted to a task note by the plugin, the content
 * in the daily note changes from:
 *
 *   `- [ ] Foo`  ->  `- [[Foo]]`
 *
 * The user wants an option (setting) to have the result instead be:
 *
 *   `- [ ] Foo`  ->  `- [ ] [[Foo]]`
 *
 * The rationale is that the task is something intended to be done during that day
 * (if possible) or within the next days, and having the checkbox enables the
 * Rollover Daily Todos plugin to still work as expected.
 *
 * @see https://github.com/owner/tasknotes/issues/900
 */

import { InstantTaskConvertService } from '../../../src/services/InstantTaskConvertService';
import { PluginFactory } from '../../helpers/mock-factories';
import { TFile } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-01T12:00:00Z'),
  getCurrentDateString: jest.fn(() => '2025-01-01'),
  parseDate: jest.fn((dateStr) => dateStr),
  formatDateForStorage: jest.fn((dateStr) => dateStr),
  combineDateAndTime: jest.fn((date, time) => `${date}T${time}:00`)
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn((context) => `${context.title.toLowerCase().replace(/\s+/g, '-')}.md`),
  generateUniqueFilename: jest.fn((base) => base)
}));

jest.mock('../../../src/utils/helpers', () => ({
  ensureFolderExists: jest.fn().mockResolvedValue(undefined),
  sanitizeFileName: jest.fn((name) => name.replace(/[<>:"|?*]/g, '')),
  calculateDefaultDate: jest.fn(() => undefined)
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
  processTemplate: jest.fn(() => ({
    frontmatter: {},
    body: 'Template content'
  })),
  mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template }))
}));

describe('InstantTaskConvertService - Issue #900: Preserve Checkbox on Conversion', () => {
  let service: InstantTaskConvertService;
  let mockPlugin: any;
  let mockEditor: any;

  beforeEach(() => {
    // Mock plugin with settings
    mockPlugin = PluginFactory.createMockPlugin({
      settings: {
        taskTag: 'task',
        taskFolder: 'tasks',
        enableNaturalLanguageInput: false,
        useDefaultsOnInstantConvert: false,
        // This is the new setting that would be added for issue #900
        preserveCheckboxOnConvert: false,
        taskCreationDefaults: {
          defaultContexts: '',
          defaultTags: '',
          defaultPriority: 'none',
          defaultTaskStatus: 'none',
          defaultTimeEstimate: 0,
          defaultRecurrence: 'none',
          defaultReminders: []
        }
      }
    });

    // Mock editor
    mockEditor = {
      getLine: jest.fn(),
      setLine: jest.fn(),
      lineCount: jest.fn().mockReturnValue(10),
      getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
      getSelection: jest.fn().mockReturnValue(''),
      replaceRange: jest.fn(),
      getRange: jest.fn()
    };

    // Mock file manager
    mockPlugin.app.fileManager.generateMarkdownLink = jest.fn((file: TFile) => `[[${file.basename}]]`);

    // Mock workspace.getActiveFile
    mockPlugin.app.workspace.getActiveFile = jest.fn().mockReturnValue({ path: 'daily/2025-01-01.md' });

    // Create service instance
    service = new InstantTaskConvertService(mockPlugin);
  });

  describe('Current Behavior (checkbox is removed)', () => {
    it('should convert checkbox task to link without checkbox by default', async () => {
      // This test documents the current behavior
      // `- [ ] Foo` becomes `- [[Foo]]`
      const originalLine = '- [ ] Foo';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/foo.md', basename: 'Foo' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      // Call replaceOriginalTaskLines
      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'Foo'
      );

      expect(result.success).toBe(true);
      // Current behavior: checkbox is removed, only link remains
      // Service uses replaceRange, not setLine
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '- [[Foo]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });
  });

  describe('Requested Behavior (checkbox is preserved)', () => {
    it.skip('reproduces issue #900: should preserve checkbox when preserveCheckboxOnConvert is enabled', async () => {
      // Enable the new setting
      mockPlugin.settings.preserveCheckboxOnConvert = true;

      const originalLine = '- [ ] Foo';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/foo.md', basename: 'Foo' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      // Call replaceOriginalTaskLines
      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'Foo'
      );

      expect(result.success).toBe(true);
      // With preserveCheckboxOnConvert enabled, the checkbox should be retained
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '- [ ] [[Foo]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });

    it.skip('reproduces issue #900: should work with asterisk checkbox format', async () => {
      mockPlugin.settings.preserveCheckboxOnConvert = true;

      const originalLine = '* [ ] My Task';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/my-task.md', basename: 'My Task' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'My Task'
      );

      expect(result.success).toBe(true);
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '* [ ] [[My Task]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });

    it.skip('reproduces issue #900: should work with numbered list checkbox format', async () => {
      mockPlugin.settings.preserveCheckboxOnConvert = true;

      const originalLine = '1. [ ] Numbered Task';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/numbered-task.md', basename: 'Numbered Task' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'Numbered Task'
      );

      expect(result.success).toBe(true);
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '1. [ ] [[Numbered Task]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });

    it.skip('reproduces issue #900: should preserve indentation with checkbox', async () => {
      mockPlugin.settings.preserveCheckboxOnConvert = true;

      const originalLine = '    - [ ] Indented Task';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/indented-task.md', basename: 'Indented Task' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'Indented Task'
      );

      expect(result.success).toBe(true);
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '    - [ ] [[Indented Task]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });

    it.skip('reproduces issue #900: should not add checkbox when preserveCheckboxOnConvert is disabled (default)', async () => {
      // Ensure setting is disabled (default)
      mockPlugin.settings.preserveCheckboxOnConvert = false;

      const originalLine = '- [ ] Foo';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/foo.md', basename: 'Foo' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'Foo'
      );

      expect(result.success).toBe(true);
      // Without the setting, checkbox should be removed (current behavior)
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '- [[Foo]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });
  });

  describe('Edge Cases for Checkbox Preservation', () => {
    it.skip('reproduces issue #900: should work with completed checkbox [ x ]', async () => {
      mockPlugin.settings.preserveCheckboxOnConvert = true;

      // Some users might convert already-completed tasks
      const originalLine = '- [x] Completed Task';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/completed-task.md', basename: 'Completed Task' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'Completed Task'
      );

      expect(result.success).toBe(true);
      // Should preserve the [x] completed state
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '- [x] [[Completed Task]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });

    it.skip('reproduces issue #900: should work with alternative checkbox markers [/], [-]', async () => {
      mockPlugin.settings.preserveCheckboxOnConvert = true;

      // Some users use alternative markers like [/] for in-progress or [-] for cancelled
      const originalLine = '- [/] In Progress Task';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/in-progress-task.md', basename: 'In Progress Task' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'In Progress Task'
      );

      expect(result.success).toBe(true);
      // Should preserve the [/] marker
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '- [/] [[In Progress Task]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });

    it.skip('reproduces issue #900: should not affect non-checkbox lines', async () => {
      mockPlugin.settings.preserveCheckboxOnConvert = true;

      // Plain bullet point without checkbox
      const originalLine = '- Plain bullet item';
      mockEditor.getLine.mockImplementation((lineNum: number) => {
        if (lineNum === 0) return originalLine;
        return '';
      });

      const mockFile = { path: 'tasks/plain-bullet.md', basename: 'Plain bullet item' } as TFile;
      mockPlugin.app.vault.create.mockResolvedValue(mockFile);

      const selectionInfo = {
        taskLine: originalLine,
        details: '',
        startLine: 0,
        endLine: 0,
        originalContent: [originalLine]
      };

      const result = await service['replaceOriginalTaskLines'](
        mockEditor,
        selectionInfo,
        mockFile,
        'Plain bullet item'
      );

      expect(result.success).toBe(true);
      // No checkbox to preserve, just create the link with bullet
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '- [[Plain bullet item]]',
        { line: 0, ch: 0 },
        { line: 0, ch: originalLine.length }
      );
    });
  });
});
