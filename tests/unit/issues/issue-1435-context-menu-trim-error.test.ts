/**
 * Issue #1435: [Bug]: TypeError: n.trim is not a function
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/1435
 *
 * Bug: When right-clicking on a task to open the context menu, a TypeError
 * occurs: "n.trim is not a function". This happens because non-string values
 * are being passed to Obsidian's Menu.setTitle() method, which internally
 * calls .trim() on the title.
 *
 * Root Cause: The TaskContextMenu code passes values directly to setTitle()
 * without ensuring they are strings. This includes:
 * - Status labels from plugin.settings.customStatuses
 * - Priority labels from plugin.priorityManager
 * - Dependency UIDs from task.blockedBy entries
 *
 * If any of these values are undefined, null, or non-string, the error occurs.
 *
 * Expected behavior: The context menu should handle invalid/missing labels
 * gracefully, either by providing fallback strings or by filtering out
 * invalid entries.
 */

describe('Issue #1435: Context menu TypeError n.trim is not a function', () => {
	describe('Status options with undefined/null labels', () => {
		it('should handle status config with undefined label gracefully', () => {
			// Simulate a corrupted status config where label is undefined
			const corruptedStatusConfig = {
				id: 'status-1',
				value: 'open',
				label: undefined, // BUG: label is undefined
				color: '#3788d8',
				isCompleted: false,
				order: 1,
			};

			// The label should be coerced to a string or replaced with a fallback
			const safeLabel = String(corruptedStatusConfig.label ?? corruptedStatusConfig.value ?? 'Unknown');
			expect(typeof safeLabel).toBe('string');
			expect(safeLabel).not.toBe('undefined');
		});

		it('should handle status config with null label gracefully', () => {
			const corruptedStatusConfig = {
				id: 'status-1',
				value: 'in-progress',
				label: null as unknown as string, // BUG: label is null
				color: '#ffa500',
				isCompleted: false,
				order: 2,
			};

			// The label should be coerced to a string or replaced with a fallback
			const safeLabel = String(corruptedStatusConfig.label ?? corruptedStatusConfig.value ?? 'Unknown');
			expect(typeof safeLabel).toBe('string');
			expect(safeLabel).toBe('in-progress');
		});

		it('should handle status config with numeric label', () => {
			const corruptedStatusConfig = {
				id: 'status-1',
				value: 'priority-1',
				label: 1 as unknown as string, // BUG: label is a number
				color: '#ff0000',
				isCompleted: false,
				order: 3,
			};

			// Numeric labels should be converted to strings
			const safeLabel = typeof corruptedStatusConfig.label === 'string'
				? corruptedStatusConfig.label
				: String(corruptedStatusConfig.label ?? corruptedStatusConfig.value ?? 'Unknown');
			expect(typeof safeLabel).toBe('string');
			expect(safeLabel).toBe('1');
		});
	});

	describe('Priority options with undefined/null labels', () => {
		it('should handle priority config with undefined label gracefully', () => {
			const corruptedPriorityConfig = {
				id: 'priority-1',
				value: 'high',
				label: undefined, // BUG: label is undefined
				color: '#ff6b6b',
				weight: 10,
			};

			const safeLabel = String(corruptedPriorityConfig.label ?? corruptedPriorityConfig.value ?? 'Unknown');
			expect(typeof safeLabel).toBe('string');
			expect(safeLabel).toBe('high');
		});

		it('should handle priority config with empty string label', () => {
			const corruptedPriorityConfig = {
				id: 'priority-1',
				value: 'medium',
				label: '', // BUG: label is empty string
				color: '#ffa500',
				weight: 5,
			};

			// Empty string should fallback to value
			const safeLabel = corruptedPriorityConfig.label || corruptedPriorityConfig.value || 'Unknown';
			expect(typeof safeLabel).toBe('string');
			expect(safeLabel).toBe('medium');
		});
	});

	describe('Dependency entries with invalid UIDs', () => {
		it('should handle blockedBy entry where entry is a string instead of TaskDependency object', () => {
			// Legacy data might have string entries instead of TaskDependency objects
			const legacyBlockedByEntry = '[[Some Task]]' as unknown as { uid: string };

			// Accessing .uid on a string returns undefined
			const rawUid = legacyBlockedByEntry.uid;
			expect(rawUid).toBeUndefined();

			// The code should use extractDependencyUid or similar to handle both cases
			const safeUid = typeof legacyBlockedByEntry === 'string'
				? legacyBlockedByEntry
				: (legacyBlockedByEntry.uid ?? 'Unknown');
			expect(typeof safeUid).toBe('string');
			expect(safeUid).toBe('[[Some Task]]');
		});

		it('should handle blockedBy entry with undefined uid', () => {
			const corruptedDependency = {
				uid: undefined as unknown as string,
				reltype: 'FINISHTOSTART',
			};

			// The uid should be coerced to a string or filtered out
			const safeUid = String(corruptedDependency.uid ?? 'Unknown');
			expect(typeof safeUid).toBe('string');
			// When uid is undefined, we might want to filter it out entirely
			expect(corruptedDependency.uid).toBeUndefined();
		});

		it('should handle blockedBy entry with numeric uid', () => {
			const corruptedDependency = {
				uid: 123 as unknown as string, // BUG: uid is a number
				reltype: 'FINISHTOSTART',
			};

			const safeUid = typeof corruptedDependency.uid === 'string'
				? corruptedDependency.uid
				: String(corruptedDependency.uid);
			expect(typeof safeUid).toBe('string');
			expect(safeUid).toBe('123');
		});
	});

	describe('Translation function fallbacks', () => {
		it('should return key as fallback when translation is missing', () => {
			// Simulate translation function behavior
			const translate = (key: string, params?: Record<string, unknown>): string => {
				const translations: Record<string, string> = {
					'contextMenus.task.status': 'Status',
					// Missing: 'contextMenus.task.priority'
				};
				let result = translations[key] ?? key;
				if (params) {
					Object.entries(params).forEach(([param, value]) => {
						result = result.replace(`{${param}}`, String(value));
					});
				}
				return result;
			};

			// Known key returns translation
			expect(translate('contextMenus.task.status')).toBe('Status');

			// Unknown key returns the key itself as fallback
			expect(translate('contextMenus.task.priority')).toBe('contextMenus.task.priority');
			expect(typeof translate('contextMenus.task.priority')).toBe('string');
		});

		it('should handle undefined/null parameters in translation interpolation', () => {
			const translate = (key: string, params?: Record<string, unknown>): string => {
				const translations: Record<string, string> = {
					'contextMenus.task.statusSelected': '✓ {label}',
				};
				let result = translations[key] ?? key;
				if (params) {
					Object.entries(params).forEach(([param, value]) => {
						result = result.replace(`{${param}}`, String(value ?? ''));
					});
				}
				return result;
			};

			// With undefined label parameter
			const result = translate('contextMenus.task.statusSelected', { label: undefined });
			expect(typeof result).toBe('string');
			// String(undefined) = "undefined", but we want empty string or the placeholder
			expect(result).toContain('✓');
		});
	});

	describe('setTitle input validation', () => {
		it('should demonstrate the bug: passing undefined to setTitle', () => {
			// This represents what Obsidian's setTitle does internally
			const simulateSetTitle = (title: unknown): void => {
				// This is the bug: if title is not a string, .trim() fails
				if (typeof title !== 'string') {
					throw new TypeError('n.trim is not a function');
				}
				title.trim(); // This would throw if title is not a string
			};

			// These should throw (demonstrating the bug)
			expect(() => simulateSetTitle(undefined)).toThrow('n.trim is not a function');
			expect(() => simulateSetTitle(null)).toThrow('n.trim is not a function');
			expect(() => simulateSetTitle(123)).toThrow('n.trim is not a function');
			expect(() => simulateSetTitle({})).toThrow('n.trim is not a function');

			// These should work
			expect(() => simulateSetTitle('')).not.toThrow();
			expect(() => simulateSetTitle('Status')).not.toThrow();
		});

		it('should demonstrate the fix: safe title coercion', () => {
			const safeSetTitle = (title: unknown): string => {
				// The fix: ensure title is always a string
				if (typeof title === 'string') {
					return title.trim();
				}
				if (title === null || title === undefined) {
					return '';
				}
				return String(title).trim();
			};

			// These should all work after the fix
			expect(safeSetTitle(undefined)).toBe('');
			expect(safeSetTitle(null)).toBe('');
			expect(safeSetTitle(123)).toBe('123');
			expect(safeSetTitle('')).toBe('');
			expect(safeSetTitle('  Status  ')).toBe('Status');
			expect(safeSetTitle({ toString: () => 'Custom' })).toBe('Custom');
		});
	});
});
