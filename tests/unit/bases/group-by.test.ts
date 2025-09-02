import { getBasesGroupByConfig } from '../../../src/bases/group-by';

describe('getBasesGroupByConfig', () => {
  const makeBases = (groupBy: any, props: Record<string, { getDisplayName?: () => string }>) => ({
    controller: {
      getViewConfig: () => ({ groupBy })
    },
    query: {
      getViewConfig: (k: string) => (k === 'groupBy' ? groupBy : undefined),
      properties: props
    }
  });

  it('returns null when no groupBy', () => {
    const cfg = getBasesGroupByConfig(makeBases(undefined, {}), new Map());
    expect(cfg).toBeNull();
  });

  it('normalizes by id and reads scalar values', () => {
    const props = { 'note.in': { getDisplayName: () => 'Project' } } as const;
    const bases = makeBases('note.in', props as any);
    const map = new Map<string, any>();
    map.set('a.md', { 'note.in': 'Foo' });

    const cfg = getBasesGroupByConfig(bases as any, map)!;
    expect(cfg.normalizedId).toBe('note.in');
    expect(cfg.displayName).toBe('Project');
    expect(cfg.getGroupValues('a.md')).toEqual(['Foo']);
  });

  it('normalizes by last segment and reads array values', () => {
    const props = { 'note.tags': { getDisplayName: () => 'Type' } } as const;
    const bases = makeBases('tags', props as any);
    const map = new Map<string, any>();
    map.set('a.md', { 'note.tags': ['a', 'b'] });

    const cfg = getBasesGroupByConfig(bases as any, map)!;
    expect(cfg.normalizedId).toBe('note.tags');
    expect(cfg.getGroupValues('a.md')).toEqual(['a', 'b']);
  });

  it('falls back to last segment when id key missing', () => {
    const props = { 'note.in': { getDisplayName: () => 'Project' } } as const;
    const bases = makeBases('note.in', props as any);
    const map = new Map<string, any>();
    map.set('a.md', { in: 'Foo' });

    const cfg = getBasesGroupByConfig(bases as any, map)!;
    expect(cfg.getGroupValues('a.md')).toEqual(['Foo']);
  });
});

