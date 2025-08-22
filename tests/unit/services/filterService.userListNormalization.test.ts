import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { MockObsidian } from '../../__mocks__/obsidian';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

// Create a minimal plugin-like settings object with userFields
function createPluginWithUserFields(userFields: any[]) {
  return {
    settings: { ...DEFAULT_SETTINGS, userFields }
  } as any;
}

function makeFilterService(plugin: any) {
  const app = MockObsidian.createMockApp();
  const cache = new MinimalNativeCache(app as any, DEFAULT_SETTINGS);
  const status = new StatusManager([]);
  const priority = new PriorityManager([]);
  return new FilterService(cache, status, priority, plugin);
}

// Access private method via bracket notation for testing
function callNormalizeUserListValue(fs: any, raw: any): string[] {
  return (fs as any).normalizeUserListValue(raw);
}

describe('FilterService.normalizeUserListValue for list user fields', () => {
  test('wikilink with comma stays single token list with human and raw tokens', () => {
    const plugin = createPluginWithUserFields([]);
    const fs = makeFilterService(plugin);

    const tokens = callNormalizeUserListValue(fs, '[[Health, Fitness & Mindset]]');
    expect(tokens).toEqual([
      'Health, Fitness & Mindset',
      '[[Health, Fitness & Mindset]]'
    ]);
  });

  test('alias wikilink with comma yields alias and raw', () => {
    const plugin = createPluginWithUserFields([]);
    const fs = makeFilterService(plugin);

    const tokens = callNormalizeUserListValue(fs, '[[Wellbeing|Health, Fitness & Mindset]]');
    expect(tokens).toEqual([
      'Health, Fitness & Mindset',
      '[[Wellbeing|Health, Fitness & Mindset]]'
    ]);
  });

  test('mixed string splits at top-level commas only', () => {
    const plugin = createPluginWithUserFields([]);
    const fs = makeFilterService(plugin);

    const tokens = callNormalizeUserListValue(fs, '[[A,B]], [[C|X,Y]], Z');
    expect(tokens).toEqual([
      'A,B',
      '[[A,B]]',
      'X,Y',
      '[[C|X,Y]]',
      'Z'
    ]);
  });

  test('array input remains unaffected', () => {
    const plugin = createPluginWithUserFields([]);
    const fs = makeFilterService(plugin);

    const tokens = callNormalizeUserListValue(fs, ['[[Health, Fitness & Mindset]]', 'Notes']);
    expect(tokens).toEqual([
      'Health, Fitness & Mindset',
      '[[Health, Fitness & Mindset]]',
      'Notes'
    ]);
  });
});

