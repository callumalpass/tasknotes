/**
 * MinimalNativeCache boolean property identification tests
 */

import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { MockObsidian } from '../../__mocks__/obsidian';

describe('MinimalNativeCache - boolean property identification', () => {
  let app: any;

  beforeEach(() => {
    MockObsidian.reset();
    app = MockObsidian.createMockApp();
  });

  function createFrontmatterContent(frontmatter: Record<string, any>, body: string = '\n') {
    const yaml = require('yaml').stringify(frontmatter);
    return `---\n${yaml}---\n${body}`;
  }

  it('recognizes notes when frontmatter boolean true matches setting value "true"', async () => {
    // Arrange settings for property-based identification
    const settings: any = {
      taskIdentificationMethod: 'property',
      taskPropertyName: 'isTask',
      taskPropertyValue: 'true',
      taskTag: 'task',
      excludedFolders: '',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    // Create a markdown file with boolean property set to true (unquoted)
    const path = 'tasks/boolean-task.md';
    const content = createFrontmatterContent({ title: 'Boolean Task', isTask: true });
    MockObsidian.createTestFile(path, content);

    // Ensure metadata cache has the frontmatter (some tests bypass vault events)
    app.metadataCache.setCache(path, { frontmatter: { title: 'Boolean Task', isTask: true } });

    const cache = new MinimalNativeCache(app, settings);
    cache.initialize();

    // Act
    const paths = cache.getAllTaskPaths();

    // Assert
    expect(paths.has(path)).toBe(true);
  });

  it('does not recognize notes when frontmatter boolean false and setting value is "true"', async () => {
    const settings: any = {
      taskIdentificationMethod: 'property',
      taskPropertyName: 'isTask',
      taskPropertyValue: 'true',
      taskTag: 'task',
      excludedFolders: '',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    const path = 'tasks/not-a-task.md';
    const content = createFrontmatterContent({ title: 'Not a Task', isTask: false });
    MockObsidian.createTestFile(path, content);

    // Ensure metadata cache has the frontmatter
    app.metadataCache.setCache(path, { frontmatter: { title: 'Not a Task', isTask: false } });

    const cache = new MinimalNativeCache(app, settings);
    cache.initialize();

    const paths = cache.getAllTaskPaths();
    expect(paths.has(path)).toBe(false);
  });

  it('recognizes when property is an array containing boolean true', async () => {
    const settings: any = {
      taskIdentificationMethod: 'property',
      taskPropertyName: 'isTask',
      taskPropertyValue: 'true',
      taskTag: 'task',
      excludedFolders: '',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    const path = 'tasks/array-task.md';
    const content = createFrontmatterContent({ title: 'Array Task', isTask: [false, true] });
    MockObsidian.createTestFile(path, content);

    // Ensure metadata cache has the frontmatter
    app.metadataCache.setCache(path, { frontmatter: { title: 'Array Task', isTask: [false, true] } });

    const cache = new MinimalNativeCache(app, settings);
    cache.initialize();

    // Act
    const paths = cache.getAllTaskPaths();
    // Assert
    expect(paths.has(path)).toBe(true);
  });

  it('does not recognize when frontmatter boolean true and setting value is "false"', async () => {
    const settings: any = {
      taskIdentificationMethod: 'property',
      taskPropertyName: 'isTask',
      taskPropertyValue: 'false',
      taskTag: 'task',
      excludedFolders: '',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    const path = 'tasks/boolean-task-false-setting.md';
    const content = createFrontmatterContent({ title: 'Boolean Task', isTask: true });
    MockObsidian.createTestFile(path, content);

    app.metadataCache.setCache(path, { frontmatter: { title: 'Boolean Task', isTask: true } });

    const cache = new MinimalNativeCache(app, settings);
    cache.initialize();

    const paths = cache.getAllTaskPaths();
    expect(paths.has(path)).toBe(false);
  });

  it('recognizes notes when frontmatter boolean false matches setting value "false"', async () => {
    const settings: any = {
      taskIdentificationMethod: 'property',
      taskPropertyName: 'isTask',
      taskPropertyValue: 'false',
      taskTag: 'task',
      excludedFolders: '',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    const path = 'tasks/boolean-false-task.md';
    const content = createFrontmatterContent({ title: 'Boolean False Task', isTask: false });
    MockObsidian.createTestFile(path, content);

    app.metadataCache.setCache(path, { frontmatter: { title: 'Boolean False Task', isTask: false } });

    const cache = new MinimalNativeCache(app, settings);
    cache.initialize();

    const paths = cache.getAllTaskPaths();
    expect(paths.has(path)).toBe(true);
  });
});

