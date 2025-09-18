import { normalizeTag, normalizeContext } from '../../src/ui/renderers/tagRenderer';

describe('normalizeTag', () => {
    it('adds # prefix when missing and preserves slash in hierarchical tags', () => {
        expect(normalizeTag('project/frontend')).toBe('#project/frontend');
    });

    it('preserves existing # prefix and slash', () => {
        expect(normalizeTag('#project/frontend')).toBe('#project/frontend');
    });

    it('removes invalid characters but keeps slash', () => {
        expect(normalizeTag('  pr$oj!@/front*end  ')).toBe('#proj/frontend');
    });

    it('returns null for empty or invalid results', () => {
        expect(normalizeTag('')).toBeNull();
        expect(normalizeTag('   ')).toBeNull();
        expect(normalizeTag('#')).toBeNull();
    });
});

describe('normalizeContext', () => {
    it('adds @ prefix when missing and preserves slash in hierarchical contexts', () => {
        expect(normalizeContext('home/computer')).toBe('@home/computer');
    });

    it('preserves existing @ prefix and slash', () => {
        expect(normalizeContext('@office/phone')).toBe('@office/phone');
    });

    it('removes invalid characters but keeps slash', () => {
        expect(normalizeContext('  h$me!#/comp*uter  ')).toBe('@hme/computer');
    });

    it('returns null for empty or invalid results', () => {
        expect(normalizeContext('')).toBeNull();
        expect(normalizeContext('   ')).toBeNull();
        expect(normalizeContext('@')).toBeNull();
    });
});
