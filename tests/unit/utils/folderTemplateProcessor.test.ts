import { processFolderTemplate, TaskTemplateData, ICSTemplateData } from '../../../src/utils/folderTemplateProcessor';
import { TaskInfo } from '../../../src/types';

describe('processFolderTemplate', () => {
	const testDate = new Date('2025-10-05T14:30:00');

	describe('date variables', () => {
		it('should process {{year}} {{month}} {{day}} template', () => {
			const result = processFolderTemplate('Daily/{{year}}/{{month}}/{{day}}', {
				date: testDate,
			});
			expect(result).toBe('Daily/2025/10/05');
		});

		it('should process {{date}} template', () => {
			const result = processFolderTemplate('Notes/{{date}}', {
				date: testDate,
			});
			expect(result).toBe('Notes/2025-10-05');
		});

		it('should process month and day name templates', () => {
			const result = processFolderTemplate('{{monthName}}/{{dayName}}', {
				date: testDate,
			});
			expect(result).toBe('October/Sunday');
		});

		it('should process short month and day name templates', () => {
			const result = processFolderTemplate('{{monthNameShort}}/{{dayNameShort}}', {
				date: testDate,
			});
			expect(result).toBe('Oct/Sun');
		});

		it('should process week and quarter templates', () => {
			const result = processFolderTemplate('{{year}}/Q{{quarter}}/W{{week}}', {
				date: testDate,
			});
			expect(result).toBe('2025/Q4/W41');
		});
	});

	describe('task variables', () => {
		const taskData: TaskTemplateData = {
			title: 'Test Task',
			priority: 'high',
			status: 'active',
			contexts: ['@work', '@office'],
			projects: ['ProjectA', 'ProjectB'],
			due: '2025-10-10',
			scheduled: '2025-10-05',
		};

		it('should process {{context}} template with first context', () => {
			const result = processFolderTemplate('Tasks/{{context}}', {
				taskData,
			});
			expect(result).toBe('Tasks/@work');
		});

		it('should process {{contexts}} template with all contexts', () => {
			const result = processFolderTemplate('Tasks/{{contexts}}', {
				taskData,
			});
			expect(result).toBe('Tasks/@work/@office');
		});

		it('should process {{project}} template with first project', () => {
			const result = processFolderTemplate('Projects/{{project}}', {
				taskData,
			});
			expect(result).toBe('Projects/ProjectA');
		});

		it('should process {{projects}} template with all projects', () => {
			const result = processFolderTemplate('Projects/{{projects}}', {
				taskData,
			});
			expect(result).toBe('Projects/ProjectA/ProjectB');
		});

		it('should process {{priority}} and {{status}} templates', () => {
			const result = processFolderTemplate('{{priority}}/{{status}}', {
				taskData,
			});
			expect(result).toBe('high/active');
		});

		it('should process {{priorityShort}} and {{statusShort}} templates', () => {
			const result = processFolderTemplate('{{priorityShort}}/{{statusShort}}', {
				taskData,
			});
			expect(result).toBe('H/A');
		});

		it('should process {{title}} template with sanitization', () => {
			const taskWithSpecialChars: TaskTemplateData = {
				title: 'Test<>:"/\\|?*Task',
			};
			const result = processFolderTemplate('Tasks/{{title}}', {
				taskData: taskWithSpecialChars,
			});
			expect(result).toBe('Tasks/Test_________Task');
		});

		it('should process title variations', () => {
			const taskWithTitle: TaskTemplateData = {
				title: 'My Test Task',
			};

			expect(processFolderTemplate('{{titleLower}}', { taskData: taskWithTitle }))
				.toBe('my test task');
			expect(processFolderTemplate('{{titleUpper}}', { taskData: taskWithTitle }))
				.toBe('MY TEST TASK');
			expect(processFolderTemplate('{{titleSnake}}', { taskData: taskWithTitle }))
				.toBe('my_test_task');
			expect(processFolderTemplate('{{titleKebab}}', { taskData: taskWithTitle }))
				.toBe('my-test-task');
			expect(processFolderTemplate('{{titleCamel}}', { taskData: taskWithTitle }))
				.toBe('myTestTask');
			expect(processFolderTemplate('{{titlePascal}}', { taskData: taskWithTitle }))
				.toBe('MyTestTask');
		});

		it('should handle extractProjectBasename function', () => {
			const taskWithWikilinks: TaskTemplateData = {
				projects: ['[[Projects/MyProject]]', '[[OtherProject]]'],
			};

			const extractBasename = (project: string) => {
				const match = project.match(/^\[\[([^\]]+)\]\]$/);
				if (match) {
					const parts = match[1].split('/');
					return parts[parts.length - 1];
				}
				return project;
			};

			const result = processFolderTemplate('{{projects}}', {
				taskData: taskWithWikilinks,
				extractProjectBasename: extractBasename,
			});
			expect(result).toBe('MyProject/OtherProject');
		});

		it('should handle empty task arrays gracefully', () => {
			const emptyTaskData: TaskTemplateData = {
				contexts: [],
				projects: [],
			};

			const result = processFolderTemplate('{{context}}/{{project}}/{{contexts}}/{{projects}}', {
				taskData: emptyTaskData,
			});
			expect(result).toBe('///');
		});
	});

	describe('ICS event variables', () => {
		const icsData: ICSTemplateData = {
			title: 'Team Meeting',
			location: 'Conference Room A',
			description: 'Quarterly review',
		};

		it('should process {{icsEventTitle}} template', () => {
			const result = processFolderTemplate('Events/{{icsEventTitle}}', {
				icsData,
			});
			expect(result).toBe('Events/Team Meeting');
		});

		it('should process {{icsEventLocation}} template', () => {
			const result = processFolderTemplate('Events/{{icsEventLocation}}', {
				icsData,
			});
			expect(result).toBe('Events/Conference Room A');
		});

		it('should process ICS title variations', () => {
			expect(processFolderTemplate('{{icsEventTitleLower}}', { icsData }))
				.toBe('team meeting');
			expect(processFolderTemplate('{{icsEventTitleUpper}}', { icsData }))
				.toBe('TEAM MEETING');
			expect(processFolderTemplate('{{icsEventTitleSnake}}', { icsData }))
				.toBe('team_meeting');
			expect(processFolderTemplate('{{icsEventTitleKebab}}', { icsData }))
				.toBe('team-meeting');
			expect(processFolderTemplate('{{icsEventTitleCamel}}', { icsData }))
				.toBe('teamMeeting');
			expect(processFolderTemplate('{{icsEventTitlePascal}}', { icsData }))
				.toBe('TeamMeeting');
		});

		it('should sanitize ICS event title with special characters', () => {
			const icsWithSpecialChars: ICSTemplateData = {
				title: 'Test<>:"/\\|?*Event',
			};
			const result = processFolderTemplate('{{icsEventTitle}}', {
				icsData: icsWithSpecialChars,
			});
			expect(result).toBe('Test_________Event');
		});

		it('should handle empty ICS data gracefully', () => {
			const emptyICS: ICSTemplateData = {};

			const result = processFolderTemplate('{{icsEventTitle}}/{{icsEventLocation}}', {
				icsData: emptyICS,
			});
			expect(result).toBe('/');
		});
	});

	describe('combined templates', () => {
		it('should process date and ICS event variables together', () => {
			const icsData: ICSTemplateData = {
				title: 'Team Meeting',
			};

			const result = processFolderTemplate('Daily/{{year}}/{{month}}/{{date}} {{icsEventTitle}}', {
				date: testDate,
				icsData,
			});
			expect(result).toBe('Daily/2025/10/2025-10-05 Team Meeting');
		});

		it('should process date and task variables together', () => {
			const taskData: TaskTemplateData = {
				priority: 'high',
				status: 'active',
			};

			const result = processFolderTemplate('{{year}}/{{priority}}/{{status}}', {
				date: testDate,
				taskData,
			});
			expect(result).toBe('2025/high/active');
		});
	});

	describe('edge cases', () => {
		it('should return empty string for empty template', () => {
			const result = processFolderTemplate('', { date: testDate });
			expect(result).toBe('');
		});

		it('should handle template with no variables', () => {
			const result = processFolderTemplate('Static/Folder/Path', { date: testDate });
			expect(result).toBe('Static/Folder/Path');
		});

		it('should use default date when not provided', () => {
			const now = new Date();
			const result = processFolderTemplate('{{year}}');
			expect(result).toBe(now.getFullYear().toString());
		});

		it('should handle undefined task and ICS data', () => {
			const result = processFolderTemplate('{{year}}/{{title}}/{{icsEventTitle}}', {
				date: testDate,
			});
			// Date variables are replaced, but task/ICS variables are left as-is when data not provided
		expect(result).toBe('2025/{{title}}/{{icsEventTitle}}');
		});
	});

	describe('issue #816 specific use case', () => {
		it('should process user-reported template Daily/{{year}}/{{month}}/', () => {
			const icsData: ICSTemplateData = {
				title: 'Aangifte Omzetbelasting',
			};

			const result = processFolderTemplate('Daily/{{year}}/{{month}}/', {
				date: new Date('2025-10-02'),
				icsData,
			});
			expect(result).toBe('Daily/2025/10/');
		});

		it('should process custom filename template {{date}} {{title}} pattern', () => {
			const icsData: ICSTemplateData = {
				title: 'Aangifte Omzetbelasting',
			};

			// This is for folder path, filename is handled separately
			const result = processFolderTemplate('Daily/{{year}}/{{month}}/{{date}}-{{icsEventTitle}}', {
				date: new Date('2025-10-02'),
				icsData,
			});
			expect(result).toBe('Daily/2025/10/2025-10-02-Aangifte Omzetbelasting');
		});
	});

	describe('fullTaskInfo variable support', () => {
		const fullTaskInfo: Partial<TaskInfo> = {
			title: 'My Task',
			status: 'in-progress',
			priority: 'high',
			tags: ['work', 'urgent'],
			contexts: ['@office', '@computer'],
			projects: ['ProjectX'],
			archived: false,
			due: '2025-11-01',
			scheduled: '2025-10-28',
			timeEstimate: 120,
			path: '/tasks/my-task.md',
		} as TaskInfo;

		it('should access TaskInfo properties via {{variable}} syntax', () => {
			const result = processFolderTemplate('Tasks/{{priority}}/{{status}}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/high/in-progress');
		});

		it('should handle array properties like {{tags}} by joining with /', () => {
			const result = processFolderTemplate('Tasks/{{tags}}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/work/urgent');
		});

		it('should handle {{contexts}} array property', () => {
			const result = processFolderTemplate('Tasks/{{contexts}}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/@office/@computer');
		});

		it('should handle single value properties like {{timeEstimate}}', () => {
			const result = processFolderTemplate('Tasks/{{timeEstimate}}min', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/120min');
		});

		it('should handle boolean properties like {{archived}}', () => {
			const result = processFolderTemplate('Tasks/archived-{{archived}}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/archived-false');
		});

		it('should handle undefined properties by leaving them as-is when not in object', () => {
			const taskWithMissing: Partial<TaskInfo> = {
				title: 'Task',
				status: 'todo',
				priority: 'low',
				path: '/task.md',
				archived: false,
				// tags and contexts are intentionally not defined
			} as TaskInfo;

			const result = processFolderTemplate('Tasks/{{tags}}/{{contexts}}', {
				fullTaskInfo: taskWithMissing as TaskInfo,
			});
			// Variables not in the object remain as templates
			expect(result).toBe('Tasks/{{tags}}/{{contexts}}');
		});

		it('should handle empty arrays by replacing with empty string', () => {
			const taskWithEmpty: Partial<TaskInfo> = {
				title: 'Task',
				status: 'todo',
				priority: 'low',
				tags: [],
				contexts: [],
				path: '/task.md',
				archived: false,
			} as TaskInfo;

			const result = processFolderTemplate('Tasks/{{tags}}/{{contexts}}', {
				fullTaskInfo: taskWithEmpty as TaskInfo,
			});
			expect(result).toBe('Tasks//');
		});
	});

	describe('JavaScript expression evaluation with ${...}', () => {
		const fullTaskInfo: Partial<TaskInfo> = {
			title: 'My Task',
			status: 'in-progress',
			priority: 'high',
			tags: ['work', 'urgent', 'important'],
			contexts: ['@office'],
			projects: ['ProjectX'],
			archived: false,
			path: '/tasks/my-task.md',
		} as TaskInfo;

		it('should evaluate simple JavaScript expressions', () => {
			const result = processFolderTemplate('Tasks/${priority === "high" ? "urgent" : "normal"}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/urgent');
		});

		it('should use array methods in expressions', () => {
			const result = processFolderTemplate('Tasks/${tags.includes("urgent") ? "urgent" : "normal"}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/urgent');
		});

		it('should access array length in expressions', () => {
			const result = processFolderTemplate('Tasks/${tags.length > 2 ? "many-tags" : "few-tags"}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/many-tags');
		});

		it('should support complex logical expressions', () => {
			const result = processFolderTemplate('Tasks/${priority === "high" && tags.includes("urgent") ? "critical" : "normal"}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/critical');
		});

		it('should handle array indexing', () => {
			const result = processFolderTemplate('Tasks/${contexts.length > 0 ? contexts[0] : "inbox"}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/@office');
		});

		it('should handle tasks without certain properties gracefully', () => {
			const taskNoContexts: Partial<TaskInfo> = {
				title: 'Task',
				status: 'todo',
				priority: 'low',
				tags: [],
				contexts: [], // Explicitly set to empty array
				path: '/task.md',
				archived: false,
			} as TaskInfo;

			const result = processFolderTemplate('Tasks/${contexts && contexts.length > 0 ? contexts[0] : "inbox"}', {
				fullTaskInfo: taskNoContexts as TaskInfo,
			});
			expect(result).toBe('Tasks/inbox');
		});

		it('should support string manipulation in expressions', () => {
			const result = processFolderTemplate('Tasks/${priority.toUpperCase()}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/HIGH');
		});

		it('should handle errors gracefully and return empty string', () => {
			const result = processFolderTemplate('Tasks/${nonExistentVariable.method()}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/');
		});

		it('should return empty string for null/undefined results', () => {
			const result = processFolderTemplate('Tasks/${undefined}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/');
		});

		it('should join array results with /', () => {
			const result = processFolderTemplate('Tasks/${tags.filter(t => t.includes("u"))}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/urgent');
		});

		it('should handle date variables in expressions', () => {
			const result = processFolderTemplate('Tasks/${year}-${month}', {
				date: testDate,
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/2025-10');
		});
	});

	describe('combined {{variable}} and ${...} syntax', () => {
		const fullTaskInfo: Partial<TaskInfo> = {
			title: 'My Task',
			status: 'in-progress',
			priority: 'high',
			tags: ['work', 'urgent'],
			path: '/tasks/my-task.md',
			archived: false,
		} as TaskInfo;

		it('should process both syntaxes in the same template', () => {
			const result = processFolderTemplate('Tasks/{{priority}}/${tags.includes("urgent") ? "critical" : "normal"}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('Tasks/high/critical');
		});

		it('should process ${...} before {{...}}', () => {
			// This ensures JS expressions are evaluated first
			const result = processFolderTemplate('${priority}/{{status}}', {
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('high/in-progress');
		});

		it('should combine with date variables', () => {
			const result = processFolderTemplate('{{year}}/{{month}}/${tags.includes("work") ? "work" : "personal"}', {
				date: testDate,
				fullTaskInfo: fullTaskInfo as TaskInfo,
			});
			expect(result).toBe('2025/10/work');
		});
	});
});
