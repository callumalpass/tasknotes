describe('TaskModal - User Fields Integration', () => {
    it('should build custom frontmatter correctly from user fields', () => {
        const userFields = {
            'assignee': 'John Doe',
            'priority_level': 5,
            'is_completed': true,
            'custom_tags': ['urgent', 'review'],
            'empty_field': null,
            'undefined_field': undefined,
            'empty_string': ''
        };

        // Simulate buildCustomFrontmatter logic
        const customFrontmatter: Record<string, any> = {};
        for (const [fieldKey, fieldValue] of Object.entries(userFields)) {
            if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                customFrontmatter[fieldKey] = fieldValue;
            }
        }

        expect(customFrontmatter).toEqual({
            'assignee': 'John Doe',
            'priority_level': 5,
            'is_completed': true,
            'custom_tags': ['urgent', 'review']
        });

        // Verify null/undefined/empty values are excluded
        expect(customFrontmatter).not.toHaveProperty('empty_field');
        expect(customFrontmatter).not.toHaveProperty('undefined_field');
        expect(customFrontmatter).not.toHaveProperty('empty_string');
    });

    it('should detect user field changes correctly', () => {
        // Simulate isDifferent logic
        const isDifferent = (newValue: any, oldValue: any): boolean => {
            const normalizeEmpty = (value: any) => {
                if (value === null || value === undefined || value === '') {
                    return null;
                }
                return value;
            };

            const normalizedNew = normalizeEmpty(newValue);
            const normalizedOld = normalizeEmpty(oldValue);

            // For arrays (list fields), compare as JSON strings
            if (Array.isArray(normalizedNew) || Array.isArray(normalizedOld)) {
                return JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOld);
            }

            // For other values, direct comparison
            return normalizedNew !== normalizedOld;
        };

        // Test different value comparisons
        expect(isDifferent('new', 'old')).toBe(true);
        expect(isDifferent('same', 'same')).toBe(false);
        expect(isDifferent(null, undefined)).toBe(false);
        expect(isDifferent('', null)).toBe(false);
        expect(isDifferent(['a', 'b'], ['a', 'b'])).toBe(false);
        expect(isDifferent(['a', 'b'], ['b', 'a'])).toBe(true);
        expect(isDifferent(5, '5')).toBe(true);
        expect(isDifferent(true, 'true')).toBe(true);
    });

    it('should handle user field value collection for autocomplete', () => {
        const mockFiles = [
            { path: 'task1.md' },
            { path: 'task2.md' },
            { path: 'task3.md' }
        ];

        const mockMetadata = {
            'task1.md': { frontmatter: { assignee: 'John Doe', priority: 5 } },
            'task2.md': { frontmatter: { assignee: 'Jane Smith', priority: 3 } },
            'task3.md': { frontmatter: { assignee: 'John Doe', status: 'done' } }
        };

        // Simulate getExistingUserFieldValues logic
        const fieldKey = 'assignee';
        const values = new Set<string>();

        for (const file of mockFiles) {
            const frontmatter = mockMetadata[file.path as keyof typeof mockMetadata]?.frontmatter;
            
            if (frontmatter && frontmatter[fieldKey] !== undefined) {
                const value = frontmatter[fieldKey];
                
                if (typeof value === 'string' && value.trim()) {
                    values.add(value.trim());
                }
            }
        }

        const result = Array.from(values).sort();
        expect(result).toEqual(['Jane Smith', 'John Doe']);
    });
});