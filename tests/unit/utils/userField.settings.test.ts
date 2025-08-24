import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';
import { isUserFieldEnabled, isUserFieldConfigComplete } from '../../../src/utils/settingsUtils';
import type { TaskNotesSettings } from '../../../src/types/settings';

describe('User Field settings defaults and helpers (multi-field MVP)', () => {
  test('DEFAULT_SETTINGS.userFields should exist and be empty array', () => {
    expect(Array.isArray(DEFAULT_SETTINGS.userFields)).toBe(true);
    expect(DEFAULT_SETTINGS.userFields?.length).toBe(0);
  });

  test('isUserFieldConfigComplete legacy helper remains for compat', () => {
    expect(isUserFieldConfigComplete(undefined as any)).toBe(false);
    expect(isUserFieldConfigComplete({ enabled: false, displayName: '', key: '', type: 'text' } as any)).toBe(false);
    expect(isUserFieldConfigComplete({ enabled: true, displayName: 'Effort', key: '', type: 'number' } as any)).toBe(false);
    expect(isUserFieldConfigComplete({ enabled: true, displayName: '', key: 'effort', type: 'number' } as any)).toBe(false);
    expect(isUserFieldConfigComplete({ enabled: true, displayName: 'Effort', key: 'effort', type: 'number' } as any)).toBe(true);
  });

  test('isUserFieldEnabled now returns true when any userFields[] entry is complete', () => {
    const base: TaskNotesSettings = { ...DEFAULT_SETTINGS } as TaskNotesSettings;

    const s1: TaskNotesSettings = { ...base, userFields: [] } as any;
    expect(isUserFieldEnabled(s1)).toBe(false);

    const s2: TaskNotesSettings = { ...base, userFields: [{ id: 'effort', displayName: '', key: 'effort', type: 'number' }] } as any;
    expect(isUserFieldEnabled(s2)).toBe(false);

    const s3: TaskNotesSettings = { ...base, userFields: [{ id: 'effort', displayName: 'Effort', key: 'effort', type: 'number' }] } as any;
    expect(isUserFieldEnabled(s3)).toBe(true);
  });
});

