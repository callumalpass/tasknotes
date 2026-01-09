import { normalizeTag, normalizeContext, getContextColorClass } from '../../src/ui/renderers/tagRenderer';

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

describe('getContextColorClass', () => {
    it('returns a BEM modifier class in the expected format', () => {
        const result = getContextColorClass('@work');
        expect(result).toMatch(/^context-tag--color-\d+$/);
    });

    it('returns consistent color class for the same context name', () => {
        const first = getContextColorClass('@office');
        const second = getContextColorClass('@office');
        const third = getContextColorClass('@office');
        expect(first).toBe(second);
        expect(second).toBe(third);
    });

    it('handles context names with and without @ prefix consistently', () => {
        const withPrefix = getContextColorClass('@home');
        const withoutPrefix = getContextColorClass('home');
        expect(withPrefix).toBe(withoutPrefix);
    });

    it('is case-insensitive for consistent coloring', () => {
        const lower = getContextColorClass('@work');
        const upper = getContextColorClass('@WORK');
        const mixed = getContextColorClass('@Work');
        expect(lower).toBe(upper);
        expect(upper).toBe(mixed);
    });

    it('returns color index within valid range (0-19)', () => {
        const testContexts = [
            '@home', '@work', '@office', '@phone', '@computer',
            '@errands', '@waiting', '@someday', '@next', '@project',
            '@meeting', '@email', '@focus', '@routine', '@travel'
        ];

        for (const ctx of testContexts) {
            const result = getContextColorClass(ctx);
            const match = result.match(/^context-tag--color-(\d+)$/);
            expect(match).not.toBeNull();
            const index = parseInt(match![1], 10);
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(20);
        }
    });

    it('produces different colors for different context names', () => {
        // Note: Due to hash collisions, not all contexts will have different colors,
        // but most common ones should be distinguishable
        const contexts = ['@home', '@work', '@office', '@phone', '@computer'];
        const colors = contexts.map(getContextColorClass);
        const uniqueColors = new Set(colors);

        // At least 3 different colors for 5 different contexts
        expect(uniqueColors.size).toBeGreaterThanOrEqual(3);
    });

    it('handles hierarchical context names', () => {
        const result = getContextColorClass('@home/computer');
        expect(result).toMatch(/^context-tag--color-\d+$/);

        // Hierarchical should produce different color than parent
        const parentResult = getContextColorClass('@home');
        // They may or may not be different due to hashing, but both should be valid
        expect(parentResult).toMatch(/^context-tag--color-\d+$/);
    });

    it('handles empty and invalid inputs gracefully', () => {
        expect(getContextColorClass('')).toBe('context-tag--color-0');
        expect(getContextColorClass('@')).toBe('context-tag--color-0');
        expect(getContextColorClass(null as unknown as string)).toBe('context-tag--color-0');
        expect(getContextColorClass(undefined as unknown as string)).toBe('context-tag--color-0');
    });

    it('handles Unicode context names', () => {
        const result = getContextColorClass('@büro');
        expect(result).toMatch(/^context-tag--color-\d+$/);

        const japaneseResult = getContextColorClass('@仕事');
        expect(japaneseResult).toMatch(/^context-tag--color-\d+$/);
    });
});
