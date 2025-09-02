import { getTaskNotesTasklistRows } from '../../../src/bases/tasklist-rows';

describe('getTaskNotesTasklistRows - overrides', () => {
  const makeBases = (cfg: any, props: Record<string, any> = {}) => ({
    controller: { getViewConfig: () => cfg },
    query: {
      getViewConfig: (k: string) => (k === 'order' ? cfg.order : undefined),
      properties: props
    }
  });

  const props = {
    'note.in': { getDisplayName: () => 'In' },
    'note.assignee': { getDisplayName: () => 'Assignee' },
    'note.tags': { getDisplayName: () => 'Tags' },
    'due': { getDisplayName: () => 'Due' },
  } as const;

  it('parses per-field overrides in object tokens for row.3 and row.4', () => {
    const cfg = {
      data: {
        ['tasknotes.tasklist']: {
          'row.3': [
            { 'note.in': { overrideDisplayName: '👤', displayNameSuffix: '' } },
            { 'note.assignee': { overrideDisplayName: '↳', displayNameSuffix: '' } }
          ],
          'row.4': [
            { 'note.tags': { displayNameSuffix: '' } },
            { 'due': { overrideDisplayName: '📅', displayNameSuffix: '|' } }
          ]
        }
      }
    } as any;

    const rows = getTaskNotesTasklistRows(makeBases(cfg, props), new Map());
    expect(rows.row3).toBeTruthy();
    expect(rows.row4).toBeTruthy();

    const row3 = rows.row3!.selected;
    const row4 = rows.row4!.selected;

    // IDs preserved
    expect(row3.map(s => s.id)).toEqual(['note.in', 'note.assignee']);
    expect(row4.map(s => s.id)).toEqual(['note.tags', 'due']);

    // Base displayName preserved from Bases props
    expect(row3[0].displayName).toBe('In');
    expect(row3[1].displayName).toBe('Assignee');

    // Overrides applied for TaskNotes UI
    expect(row3[0].tnLabel).toBe('👤');
    expect(row3[0].tnSeparator).toBe('');
    expect(row3[1].tnLabel).toBe('↳');
    expect(row3[1].tnSeparator).toBe('');

    // Only suffix override for tags
    expect(row4[0].tnLabel).toBeUndefined();
    expect(row4[0].tnSeparator).toBe('');

    // Both overrides for due
    expect(row4[1].tnLabel).toBe('📅');
    expect(row4[1].tnSeparator).toBe('|');
  });

  it('treats empty overrideDisplayName as suppress label (tnLabel=null)', () => {
    const cfg = {
      data: {
        ['tasknotes.tasklist']: {
          'row.3': [ { 'note.in': { overrideDisplayName: '', displayNameSuffix: '' } } ]
        }
      }
    } as any;

    const rows = getTaskNotesTasklistRows(makeBases(cfg, props), new Map());
    const s = rows.row3!.selected[0];
    expect(s.id).toBe('note.in');
    expect(s.tnLabel).toBeNull();
    expect(s.tnSeparator).toBe('');
    // Bases displayName still intact for internal usage
    expect(s.displayName).toBe('In');
  });
});

