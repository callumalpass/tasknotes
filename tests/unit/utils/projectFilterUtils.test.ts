import { getProjectPropertyFilter, matchesProjectProperty } from '../../../src/utils/projectFilterUtils';

describe('projectFilterUtils', () => {
  describe('getProjectPropertyFilter', () => {
    it('returns disabled filter when key is missing', () => {
      const filter = getProjectPropertyFilter(undefined);
      expect(filter).toEqual({ key: '', value: '', enabled: false });
    });

    it('trims key and value', () => {
      const filter = getProjectPropertyFilter({ propertyKey: ' type ', propertyValue: ' project ' } as any);
      expect(filter).toEqual({ key: 'type', value: 'project', enabled: true });
    });
  });

  describe('matchesProjectProperty', () => {
    const baseFilter = { key: 'type', value: 'project', enabled: true };

    it('matches string values case-insensitively', () => {
      expect(matchesProjectProperty({ type: 'Project' }, baseFilter)).toBe(true);
      expect(matchesProjectProperty({ type: 'other' }, baseFilter)).toBe(false);
    });

    it('matches array values', () => {
      expect(matchesProjectProperty({ type: ['note', 'project'] }, baseFilter)).toBe(true);
    });

    it('matches boolean and numeric values using string comparison', () => {
      const booleanFilter = { key: 'pinned', value: 'true', enabled: true };
      expect(matchesProjectProperty({ pinned: true }, booleanFilter)).toBe(true);
      const numericFilter = { key: 'year', value: '2024', enabled: true };
      expect(matchesProjectProperty({ year: 2024 }, numericFilter)).toBe(true);
    });

    it('requires property to exist when expected value is empty', () => {
      const existenceFilter = { key: 'type', value: '', enabled: true };
      expect(matchesProjectProperty({ type: 'project' }, existenceFilter)).toBe(true);
      expect(matchesProjectProperty({}, existenceFilter)).toBe(false);
    });

    it('returns true for disabled filter regardless of frontmatter', () => {
      expect(matchesProjectProperty(undefined, { key: '', value: '', enabled: false })).toBe(true);
    });
  });
});
