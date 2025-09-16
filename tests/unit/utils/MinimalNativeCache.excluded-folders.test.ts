/**
 * MinimalNativeCache excluded folders handling tests
 */

import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { MockObsidian } from '../../__mocks__/obsidian';

describe('MinimalNativeCache - excluded folders handling', () => {
  let app: any;

  beforeEach(() => {
    MockObsidian.reset();
    app = MockObsidian.createMockApp();
  });

  it('should handle excluded folders with trailing comma', async () => {
    // Arrange settings with trailing comma in excludedFolders
    const settings: any = {
      taskIdentificationMethod: 'tag',
      taskTag: 'task',
      excludedFolders: 'archive,temp,', // Note the trailing comma
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    // Create the cache
    const cache = new MinimalNativeCache(app, settings, null as any);

    // Test isValidFile method
    expect(cache.isValidFile('regular/file.md')).toBe(true);
    expect(cache.isValidFile('archive/file.md')).toBe(false);
    expect(cache.isValidFile('temp/file.md')).toBe(false);
    expect(cache.isValidFile('other/file.md')).toBe(true);
  });

  it('should handle excluded folders without trailing comma', async () => {
    // Arrange settings without trailing comma
    const settings: any = {
      taskIdentificationMethod: 'tag',
      taskTag: 'task',
      excludedFolders: 'archive,temp',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    // Create the cache
    const cache = new MinimalNativeCache(app, settings, null as any);

    // Test isValidFile method
    expect(cache.isValidFile('regular/file.md')).toBe(true);
    expect(cache.isValidFile('archive/file.md')).toBe(false);
    expect(cache.isValidFile('temp/file.md')).toBe(false);
    expect(cache.isValidFile('other/file.md')).toBe(true);
  });

  it('should handle empty excluded folders', async () => {
    // Arrange settings with empty excludedFolders
    const settings: any = {
      taskIdentificationMethod: 'tag',
      taskTag: 'task',
      excludedFolders: '',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    // Create the cache
    const cache = new MinimalNativeCache(app, settings, null as any);

    // Test isValidFile method - all files should be valid when no exclusions
    expect(cache.isValidFile('regular/file.md')).toBe(true);
    expect(cache.isValidFile('archive/file.md')).toBe(true);
    expect(cache.isValidFile('temp/file.md')).toBe(true);
    expect(cache.isValidFile('other/file.md')).toBe(true);
  });

  it('should handle excluded folders with multiple trailing commas', async () => {
    // Arrange settings with multiple trailing commas
    const settings: any = {
      taskIdentificationMethod: 'tag',
      taskTag: 'task',
      excludedFolders: 'archive,temp,,',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    // Create the cache
    const cache = new MinimalNativeCache(app, settings, null as any);

    // Test isValidFile method
    expect(cache.isValidFile('regular/file.md')).toBe(true);
    expect(cache.isValidFile('archive/file.md')).toBe(false);
    expect(cache.isValidFile('temp/file.md')).toBe(false);
    expect(cache.isValidFile('other/file.md')).toBe(true);
  });

  it('should handle excluded folders with spaces and trailing comma', async () => {
    // Arrange settings with spaces and trailing comma
    const settings: any = {
      taskIdentificationMethod: 'tag',
      taskTag: 'task',
      excludedFolders: ' archive , temp , ',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    // Create the cache
    const cache = new MinimalNativeCache(app, settings, null as any);

    // Test isValidFile method
    expect(cache.isValidFile('regular/file.md')).toBe(true);
    expect(cache.isValidFile('archive/file.md')).toBe(false);
    expect(cache.isValidFile('temp/file.md')).toBe(false);
    expect(cache.isValidFile('other/file.md')).toBe(true);
  });

  it('should handle updateConfig with trailing comma', async () => {
    // Arrange settings
    const settings: any = {
      taskIdentificationMethod: 'tag',
      taskTag: 'task',
      excludedFolders: 'initial',
      disableNoteIndexing: false,
      storeTitleInFilename: false,
    };

    // Create the cache
    const cache = new MinimalNativeCache(app, settings, null as any);

    // Update settings with trailing comma
    cache.updateConfig(
      'task',
      'archive,temp,', // trailing comma
      null as any,
      false,
      false
    );

    // Test isValidFile method after update
    expect(cache.isValidFile('regular/file.md')).toBe(true);
    expect(cache.isValidFile('archive/file.md')).toBe(false);
    expect(cache.isValidFile('temp/file.md')).toBe(false);
    expect(cache.isValidFile('other/file.md')).toBe(true);
  });
});