/**
 * Custom Filename Generation Tests
 *
 * Tests for the custom filename feature for inline task conversion.
 * Validates all template examples from the documentation work correctly.
 */

import {
	generateTaskFilename,
	FilenameContext,
	sanitizeForFilename,
} from '../../../src/utils/filenameGenerator';
import { TaskNotesSettings } from '../../../src/types/settings';
import { TaskInfo } from '../../../src/types';

// Import format for date processing
import { format } from 'date-fns';

// Mock the folder template processor for advanced syntax
jest.mock('../../../src/utils/folderTemplateProcessor', () => ({
	processFolderTemplate: jest.fn((template: string, data: any) => {
		// Simple mock implementation for testing
		const { date, fullTaskInfo } = data;
		let result = template;

		// Build context for both {{}} and ${} syntax
		const context: Record<string, any> = {
			// Date variables
			year: date ? format(date, 'yyyy') : '',
			month: date ? format(date, 'MM') : '',
			day: date ? format(date, 'dd') : '',
			date: date ? format(date, 'yyyy-MM-dd') : '',
			...fullTaskInfo,
		};

		// Handle JavaScript expressions ${...}
		if (template.includes('${')) {
			result = result.replace(/\$\{([^}]+)\}/g, (match, expression) => {
				try {
					// Evaluate the expression
					const func = new Function(...Object.keys(context), `"use strict"; return (${expression})`);
					const value = func(...Object.values(context));

					if (value === null || value === undefined) {
						return '';
					}
					if (Array.isArray(value)) {
						return value.join('/');
					}
					return String(value);
				} catch (error) {
					console.error('Error evaluating expression:', expression, error);
					return '';
				}
			});
		}

		// Handle {{variable}} replacements
		result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
			const value = context[key];
			if (value === null || value === undefined) {
				return '';
			}
			if (Array.isArray(value)) {
				return value.join('/');
			}
			return String(value);
		});

		return result;
	}),
}));

describe('Custom Filename Generation', () => {
	const testDate = new Date('2025-11-28T14:30:25Z');

	const createSettings = (overrides: Partial<TaskNotesSettings> = {}): TaskNotesSettings => ({
		// Only include properties relevant to filename generation
		toggleCustomFileName: false,
		customFileName: '{{title}}',
		storeTitleInFilename: false,
		taskFilenameFormat: 'zettel',
		customFilenameTemplate: '{{title}}',
		...overrides,
	} as TaskNotesSettings);

	const createTaskInfo = (overrides: Partial<TaskInfo> = {}): TaskInfo => ({
		id: 'test-id',
		title: 'Test Task',
		status: 'open',
		priority: 'normal',
		tags: [],
		contexts: [],
		projects: [],
		archived: false,
		dateCreated: '2025-11-28T14:30:25Z',
		dateModified: '2025-11-28T14:30:25Z',
		path: '',
		...overrides,
	} as TaskInfo);

	describe('Basic Templates ({{variable}} syntax)', () => {
		describe('Priority prefix', () => {
			it('should generate filename with priority prefix', () => {
				const context: FilenameContext = {
					title: 'Important meeting',
					priority: 'high',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Important meeting',
						priority: 'high',
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: '{{priority}}-{{title}}',
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('high-Important meeting');
			});
		});

		describe('Date-based filename', () => {
			it('should generate filename with date prefix', () => {
				const context: FilenameContext = {
					title: 'Weekly review',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Weekly review',
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: '{{date}}-{{title}}',
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('2025-11-28-Weekly review');
			});
		});

		describe('Status indicator', () => {
			it('should generate filename with status (brackets removed by sanitization)', () => {
				const context: FilenameContext = {
					title: 'Draft proposal',
					priority: 'normal',
					status: 'in-progress',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Draft proposal',
						status: 'in-progress',
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: '[{{status}}] {{title}}',
				});

				const result = generateTaskFilename(context, settings);
				// Note: Square brackets are removed by sanitizeForFilename for filesystem safety
				expect(result).toBe('in-progress Draft proposal');
			});

			it('should generate filename with status using parentheses instead', () => {
				const context: FilenameContext = {
					title: 'Draft proposal',
					priority: 'normal',
					status: 'in-progress',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Draft proposal',
						status: 'in-progress',
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: '({{status}}) {{title}}',
				});

				const result = generateTaskFilename(context, settings);
				// Parentheses are allowed in filenames
				expect(result).toBe('(in-progress) Draft proposal');
			});
		});
	});

	describe('Advanced Templates (${...} syntax)', () => {
		describe('Extract project from tags', () => {
			it('should extract project name from tag', () => {
				const context: FilenameContext = {
					title: 'Do chores',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Do chores',
						tags: ['project/Personal', 'urgent'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'task'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('Personal-Do chores');
			});

			it('should use fallback when no project tag exists', () => {
				const context: FilenameContext = {
					title: 'Random task',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Random task',
						tags: ['urgent'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'task'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('task-Random task');
			});
		});

		describe('Priority-based prefix', () => {
			it('should use URGENT for high priority', () => {
				const context: FilenameContext = {
					title: 'Fix critical bug',
					priority: 'high',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Fix critical bug',
						priority: 'high',
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${priority === 'high' ? 'URGENT' : priority === 'medium' ? 'NORMAL' : 'LATER'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('URGENT-Fix critical bug');
			});

			it('should use LATER for low priority', () => {
				const context: FilenameContext = {
					title: 'Update docs',
					priority: 'low',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Update docs',
						priority: 'low',
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${priority === 'high' ? 'URGENT' : priority === 'medium' ? 'NORMAL' : 'LATER'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('LATER-Update docs');
			});
		});

		describe('Check if tag exists', () => {
			it('should use WORK when work tag exists', () => {
				const context: FilenameContext = {
					title: 'Review PR',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Review PR',
						tags: ['work', 'code-review'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.includes('work') ? 'WORK' : 'PERSONAL'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('WORK-Review PR');
			});

			it('should use PERSONAL when work tag does not exist', () => {
				const context: FilenameContext = {
					title: 'Buy groceries',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Buy groceries',
						tags: ['shopping'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.includes('work') ? 'WORK' : 'PERSONAL'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('PERSONAL-Buy groceries');
			});
		});

		describe('Get first context', () => {
			it('should use first context when contexts exist', () => {
				const context: FilenameContext = {
					title: 'Call client',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Call client',
						contexts: ['office', 'phone'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: '${contexts && contexts.length > 0 ? contexts[0] : "general"}-{{title}}',
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('office-Call client');
			});

			it('should use fallback when no contexts exist', () => {
				const context: FilenameContext = {
					title: 'General task',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'General task',
						contexts: [],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: '${contexts && contexts.length > 0 ? contexts[0] : "general"}-{{title}}',
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('general-General task');
			});
		});

		describe('Multiple conditions', () => {
			it('should use CRITICAL for high priority with urgent tag', () => {
				const context: FilenameContext = {
					title: 'Emergency fix',
					priority: 'high',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Emergency fix',
						priority: 'high',
						tags: ['urgent'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${priority === 'high' && tags.includes('urgent') ? 'CRITICAL' : 'NORMAL'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('CRITICAL-Emergency fix');
			});

			it('should use NORMAL when conditions not met', () => {
				const context: FilenameContext = {
					title: 'Regular task',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Regular task',
						priority: 'normal',
						tags: [],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${priority === 'high' && tags.includes('urgent') ? 'CRITICAL' : 'NORMAL'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('NORMAL-Regular task');
			});
		});

		describe('Filter and transform tags', () => {
			it('should filter tags starting with area- and join them', () => {
				const context: FilenameContext = {
					title: 'Planning',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Planning',
						tags: ['area-dev', 'area-ops', 'urgent'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.filter(t => t.startsWith('area-')).map(t => t.replace('area-', '')).join('-')}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('dev-ops-Planning');
			});
		});

		describe('Extract category from nested tags', () => {
			it('should extract meeting type from nested tag', () => {
				const context: FilenameContext = {
					title: 'Meeting notes',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Meeting notes',
						tags: ['meeting/weekly', 'team/engineering'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.find(t => t.startsWith('meeting/'))?.split('/')[1] || 'general'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('weekly-Meeting notes');
			});
		});
	});

	describe('Fallback behavior', () => {
		it('should NOT use custom filename when toggle is OFF', () => {
			const context: FilenameContext = {
				title: 'Test Task',
				priority: 'high',
				status: 'open',
				date: testDate,
				creationContext: 'inline-conversion',
				fullTaskInfo: createTaskInfo({
					title: 'Test Task',
					priority: 'high',
				}),
			};

			const settings = createSettings({
				toggleCustomFileName: false, // Toggle OFF
				customFileName: '{{priority}}-{{title}}',
				storeTitleInFilename: true,
			});

			const result = generateTaskFilename(context, settings);
			// Should use title format due to storeTitleInFilename
			expect(result).toBe('Test Task');
		});

		it('should NOT use custom filename when template is empty', () => {
			const context: FilenameContext = {
				title: 'Test Task',
				priority: 'high',
				status: 'open',
				date: testDate,
				creationContext: 'inline-conversion',
				fullTaskInfo: createTaskInfo({
					title: 'Test Task',
					priority: 'high',
				}),
			};

			const settings = createSettings({
				toggleCustomFileName: true, // Toggle ON
				customFileName: '', // Empty template
				storeTitleInFilename: true,
			});

			const result = generateTaskFilename(context, settings);
			// Should use title format due to storeTitleInFilename
			expect(result).toBe('Test Task');
		});

		it('should NOT use custom filename for non-inline tasks', () => {
			const context: FilenameContext = {
				title: 'Test Task',
				priority: 'high',
				status: 'open',
				date: testDate,
				creationContext: 'modal', // NOT inline-conversion
				fullTaskInfo: createTaskInfo({
					title: 'Test Task',
					priority: 'high',
				}),
			};

			const settings = createSettings({
				toggleCustomFileName: true,
				customFileName: '{{priority}}-{{title}}',
				storeTitleInFilename: true,
			});

			const result = generateTaskFilename(context, settings);
			// Should use title format, not custom filename
			expect(result).toBe('Test Task');
		});
	});

	describe('Filename sanitization', () => {
		it('should sanitize invalid filename characters', () => {
			const result = sanitizeForFilename('Test<>:"/\\|?*#Task');
			expect(result).not.toContain('<');
			expect(result).not.toContain('>');
			expect(result).not.toContain(':');
			expect(result).not.toContain('"');
			expect(result).not.toContain('\\');
			expect(result).not.toContain('|');
			expect(result).not.toContain('?');
			expect(result).not.toContain('*');
			expect(result).not.toContain('#');
		});

		it('should preserve spaces in filenames', () => {
			const result = sanitizeForFilename('Test Task Name');
			expect(result).toBe('Test Task Name');
		});

		it('should handle multiple consecutive spaces', () => {
			const result = sanitizeForFilename('Test    Task    Name');
			expect(result).toBe('Test Task Name');
		});

		it('should handle empty input', () => {
			const result = sanitizeForFilename('');
			expect(result).toBe('untitled');
		});

		it('should handle Windows reserved names', () => {
			const result = sanitizeForFilename('CON');
			expect(result).toBe('task-CON');
		});
	});

	describe('Documentation examples validation', () => {
		describe('Example 1: Project-Based Organization', () => {
			it('should match documentation example', () => {
				const context: FilenameContext = {
					title: 'Write documentation',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Write documentation',
						tags: ['project/Kinross'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'Inbox'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('Kinross-Write documentation');
			});
		});

		describe('Example 2: Priority Indicator', () => {
			it('should match documentation example', () => {
				const context: FilenameContext = {
					title: 'Fix bug',
					priority: 'high',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Fix bug',
						priority: 'high',
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${priority === 'high' ? '!!' : priority === 'medium' ? '!' : ''}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('!!-Fix bug');
			});
		});

		describe('Example 5: Team/Area Routing', () => {
			it('should match documentation example', () => {
				const context: FilenameContext = {
					title: 'Code review',
					priority: 'normal',
					status: 'open',
					date: testDate,
					creationContext: 'inline-conversion',
					fullTaskInfo: createTaskInfo({
						title: 'Code review',
						tags: ['team/frontend'],
					}),
				};

				const settings = createSettings({
					toggleCustomFileName: true,
					customFileName: "${tags.find(t => t.startsWith('team/'))?.split('/')[1]?.toUpperCase() || 'GENERAL'}-{{title}}",
				});

				const result = generateTaskFilename(context, settings);
				expect(result).toBe('FRONTEND-Code review');
			});
		});
	});
});
