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

    it('matches any comma-separated expected value', () => {
      const multiValueFilter = { key: 'tags', value: 'project, area', enabled: true };
      expect(matchesProjectProperty({ tags: ['area'] }, multiValueFilter)).toBe(true);
      expect(matchesProjectProperty({ tags: ['project'] }, multiValueFilter)).toBe(true);
      expect(matchesProjectProperty({ tags: ['archive'] }, multiValueFilter)).toBe(false);
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

  describe('matchesProjectProperty - expression syntax', () => {
    it('supports containsAny(...) as an allow-list', () => {
      const filter = { key: 'status', value: 'containsAny("active", "planned")', enabled: true };
      expect(matchesProjectProperty({ status: 'active' }, filter)).toBe(true);
      expect(matchesProjectProperty({ status: 'Planned' }, filter)).toBe(true);
      expect(matchesProjectProperty({ status: 'completed' }, filter)).toBe(false);
    });

    it('negates with !containsAny(...) to exclude values', () => {
      const filter = {
        key: 'status',
        value: '!containsAny("completed", "archived", "cancelled", "done")',
        enabled: true,
      };
      expect(matchesProjectProperty({ status: 'active' }, filter)).toBe(true);
      expect(matchesProjectProperty({ status: 'Completed' }, filter)).toBe(false);
      expect(matchesProjectProperty({ status: 'archived' }, filter)).toBe(false);
    });

    it('hides notes with a missing or empty property even under a negation filter', () => {
      const filter = {
        key: 'status',
        value: '!containsAny("completed", "archived")',
        enabled: true,
      };
      expect(matchesProjectProperty({}, filter)).toBe(false);
      expect(matchesProjectProperty({ status: '' }, filter)).toBe(false);
      expect(matchesProjectProperty({ status: '   ' }, filter)).toBe(false);
      expect(matchesProjectProperty({ status: null }, filter)).toBe(false);
      expect(matchesProjectProperty({ status: [] }, filter)).toBe(false);
      expect(matchesProjectProperty(undefined, filter)).toBe(false);
      // ...but a note that has a non-excluded status is still shown.
      expect(matchesProjectProperty({ status: 'active' }, filter)).toBe(true);
    });

    it('negation applies to list-valued properties', () => {
      const filter = { key: 'tags', value: '!containsAny("archived")', enabled: true };
      expect(matchesProjectProperty({ tags: ['active', 'work'] }, filter)).toBe(true);
      expect(matchesProjectProperty({ tags: ['work', 'archived'] }, filter)).toBe(false);
    });

    it('accepts the "not " prefix as a negation', () => {
      const filter = { key: 'status', value: 'not containsAny("done")', enabled: true };
      expect(matchesProjectProperty({ status: 'done' }, filter)).toBe(false);
      expect(matchesProjectProperty({ status: 'todo' }, filter)).toBe(true);
    });

    it('supports a bare negated comma-separated list', () => {
      const filter = { key: 'status', value: '!completed, archived', enabled: true };
      expect(matchesProjectProperty({ status: 'completed' }, filter)).toBe(false);
      expect(matchesProjectProperty({ status: 'active' }, filter)).toBe(true);
    });

    it('is case-insensitive for the function name and strips quotes', () => {
      const filter = { key: 'status', value: "CONTAINSANY('active')", enabled: true };
      expect(matchesProjectProperty({ status: 'active' }, filter)).toBe(true);
      expect(matchesProjectProperty({ status: 'active-extra' }, filter)).toBe(false);
    });

    it('treats a bare "!" as a pure existence check', () => {
      const filter = { key: 'status', value: '!', enabled: true };
      expect(matchesProjectProperty({ status: 'completed' }, filter)).toBe(true);
      expect(matchesProjectProperty({}, filter)).toBe(false);
    });
  });
});
