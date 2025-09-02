import { getTaskNotesTasklistRows } from '../../../src/bases/tasklist-rows';

describe('getTaskNotesTasklistRows', () => {
  const makeBases = (cfg: any, props: Record<string, any> = {}) => ({
    controller: { getViewConfig: () => cfg },
    query: {
      getViewConfig: (k: string) => (k === 'order' ? cfg.order : undefined),
      properties: props
    }
  });

  const props = {
    'note.in': { getDisplayName: () => 'Project' },
    'note.assignee': { getDisplayName: () => 'Allocated To' },
    'note.tags': { getDisplayName: () => 'Type' },
    'due': { getDisplayName: () => 'Due' },
  };

  it('parses nested tasknotes.tasklist rows', () => {
    const cfg = {
      order: ['in','assignee','tags','due'],
      tasknotes: { tasklist: { 'row.3': ['note.in','note.assignee'], 'row.4': ['note.tags'] } }
    };
    const rows = getTaskNotesTasklistRows(makeBases(cfg, props), new Map());
    expect(rows.row3?.selected.map(s=>s.id)).toEqual(['note.in','note.assignee']);
    expect(rows.row4?.selected.map(s=>s.id)).toEqual(['note.tags']);
  });

  it('parses dotted key variant', () => {
    const cfg = {
      order: ['in','assignee','tags','due'],
      ['tasknotes.tasklist']: { 'row.3': ['note.in'], 'row.4': ['note.tags'] }
    } as any;
    const rows = getTaskNotesTasklistRows(makeBases(cfg, props), new Map());
    expect(rows.row3?.selected.map(s=>s.id)).toEqual(['note.in']);
    expect(rows.row4?.selected.map(s=>s.id)).toEqual(['note.tags']);
  });

  it('parses data container dotted keys', () => {
    const cfg = {
      order: ['in','assignee','tags','due'],
      data: {
        ['tasknotes.tasklist']: { 'row.3': ['note.in','note.assignee'], 'row.4': ['note.tags'] },
        ['tasknotes.debug']: true
      }
    } as any;
    const rows = getTaskNotesTasklistRows(makeBases(cfg, props), new Map());
    expect(rows.row3?.selected.map(s=>s.id)).toEqual(['note.in','note.assignee']);
    expect(rows.row4?.selected.map(s=>s.id)).toEqual(['note.tags']);
  });

  it('falls back to order when no custom rows provided', () => {
    const cfg = { order: ['in','assignee','due'] };
    const rows = getTaskNotesTasklistRows(makeBases(cfg, props), new Map());
    expect(rows.row3?.selected.map(s=>s.id)).toEqual(['note.in','note.assignee','due']);
    expect(rows.row4).toBeUndefined();
  });
});

