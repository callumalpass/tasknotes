import { filterEmptyProjects } from '../../../src/utils/helpers';

describe('filterEmptyProjects', () => {
    it('should filter out empty strings', () => {
        const projects = ['Project A', '', 'Project B'];
        const result = filterEmptyProjects(projects);
        expect(result).toEqual(['Project A', 'Project B']);
    });

    it('should filter out quoted empty strings', () => {
        const projects = ['Project A', '""', 'Project B'];
        const result = filterEmptyProjects(projects);
        expect(result).toEqual(['Project A', 'Project B']);
    });

    it('should filter out whitespace-only strings', () => {
        const projects = ['Project A', '   ', 'Project B', '\t\n'];
        const result = filterEmptyProjects(projects);
        expect(result).toEqual(['Project A', 'Project B']);
    });

    it('should filter out null and undefined values', () => {
        const projects = ['Project A', null as any, 'Project B', undefined as any];
        const result = filterEmptyProjects(projects);
        expect(result).toEqual(['Project A', 'Project B']);
    });

    it('should handle mixed empty values', () => {
        const projects = ['Project A', '', '  ', '""', null as any, 'Project B', '   \t  '];
        const result = filterEmptyProjects(projects);
        expect(result).toEqual(['Project A', 'Project B']);
    });

    it('should return empty array for null or undefined input', () => {
        expect(filterEmptyProjects(null as any)).toEqual([]);
        expect(filterEmptyProjects(undefined as any)).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
        expect(filterEmptyProjects('not an array' as any)).toEqual([]);
    });

    it('should preserve valid projects including wikilinks', () => {
        const projects = ['[[Project Note]]', 'Plain Project', '', '  ', 'Another [[Link]]'];
        const result = filterEmptyProjects(projects);
        expect(result).toEqual(['[[Project Note]]', 'Plain Project', 'Another [[Link]]']);
    });

    it('should handle empty array input', () => {
        const result = filterEmptyProjects([]);
        expect(result).toEqual([]);
    });
});