import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { MockObsidian } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';

jest.mock('obsidian');

jest.mock('../../../src/services/NaturalLanguageParser', () => {
	const mockParserInstance = {
		parseInput: jest.fn(),
		getPreviewData: jest.fn(() => []),
	};

	return {
		NaturalLanguageParser: {
			fromPlugin: jest.fn(() => mockParserInstance),
		},
	};
});

const createMockApp = (mockApp: any): App => mockApp as unknown as App;

describe('Issue #1828: subtask project merging', () => {
	let mockApp: App;
	let mockPlugin: any;

	beforeEach(() => {
		MockObsidian.reset();
		mockApp = createMockApp(MockObsidian.createMockApp());
		(mockApp.metadataCache as any).getFirstLinkpathDest = jest.fn().mockReturnValue(null);

		mockPlugin = {
			app: mockApp,
			settings: {
				defaultTaskPriority: 'normal',
				defaultTaskStatus: 'open',
				taskTag: 'task',
				taskIdentificationMethod: 'property',
				taskCreationDefaults: {
					defaultDueDate: 'none',
					defaultScheduledDate: 'none',
					defaultContexts: '',
					defaultTags: '',
					defaultProjects: '',
					defaultTimeEstimate: 0,
					defaultRecurrence: 'none',
					defaultReminders: [],
				},
				userFields: [],
				enableNaturalLanguageInput: true,
				useFrontmatterMarkdownLinks: false,
			},
			i18n: {
				translate: jest.fn((key: string) => key),
			},
		};
	});

	it('preserves the pre-populated parent project when parsed projects are added', async () => {
		const modal = new TaskCreationModal(mockApp, mockPlugin, {
			prePopulatedValues: {
				projects: ['[[TaskNote A]]'],
			},
		});

		await (modal as any).initializeFormData();
		(modal as any).applyParsedData({
			title: 'Child task',
			projects: ['[[TaskNote B]]'],
		});

		const taskData = (modal as any).buildTaskData();

		expect(taskData.projects).toEqual(['[[TaskNote A]]', '[[TaskNote B]]']);
	});

	it('does not duplicate a project already present before parsing', async () => {
		const modal = new TaskCreationModal(mockApp, mockPlugin, {
			prePopulatedValues: {
				projects: ['[[TaskNote A]]'],
			},
		});

		await (modal as any).initializeFormData();
		(modal as any).applyParsedData({
			title: 'Child task',
			projects: ['[[TaskNote A]]', '[[TaskNote B]]'],
		});

		const taskData = (modal as any).buildTaskData();

		expect(taskData.projects).toEqual(['[[TaskNote A]]', '[[TaskNote B]]']);
	});
});
