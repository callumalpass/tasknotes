import { TaskEditModal } from '../../../src/modals/TaskEditModal';
import { showConfirmationModal } from '../../../src/modals/ConfirmationModal';
import { MockObsidian, Notice } from '../../__mocks__/obsidian';
import { makeContainer } from '../../helpers/dom-helpers';
import type { App } from 'obsidian';
import type { TaskInfo } from '../../../src/types';

jest.mock('obsidian');

jest.mock('../../../src/modals/ConfirmationModal', () => ({
	ConfirmationModal: jest.fn().mockImplementation(() => ({
		show: jest.fn().mockResolvedValue(false),
		open: jest.fn(),
		close: jest.fn(),
	})),
	showConfirmationModal: jest.fn(),
}));

const mockShowConfirmationModal = showConfirmationModal as jest.MockedFunction<
	typeof showConfirmationModal
>;

function createMockApp(mockApp: unknown): App {
	return mockApp as App;
}

function translate(key: string, params?: Record<string, string | number>): string {
	const translations: Record<string, string> = {
		'common.cancel': 'Cancel',
		'contextMenus.task.delete': 'Delete',
		'contextMenus.task.deleteTitle': 'Delete file',
		'contextMenus.task.deleteMessage': 'Are you sure you want to delete "{name}"?',
		'contextMenus.task.deleteConfirm': 'Delete',
		'modals.taskEdit.deleteConfirmation.title': 'Delete task',
		'modals.taskEdit.deleteConfirmation.message':
			'Are you sure you want to delete "{title}"? This moves the task note to Obsidian trash.',
		'modals.taskEdit.deleteConfirmation.confirm': 'Delete task',
		'modals.taskEdit.buttons.archive': 'Archive',
		'modals.taskEdit.buttons.unarchive': 'Unarchive',
		'modals.taskEdit.notices.deleteSuccess': 'Task "{title}" deleted successfully',
		'modals.taskEdit.notices.deleteFailure': 'Failed to delete task: {message}',
		'modals.task.buttons.openNote': 'Open note',
		'modals.task.buttons.save': 'Save',
	};
	const template = translations[key] || key;
	return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
		params?.[name] !== undefined ? String(params[name]) : `{${name}}`
	);
}

function createMockPlugin(app: App) {
	return {
		app,
		i18n: {
			translate: jest.fn(translate),
		},
		settings: {
			enableModalSplitLayout: false,
			taskTag: 'task',
			taskIdentificationMethod: 'tag',
			hideIdentifyingTagsMode: 'exact',
			defaultTaskStatus: 'open',
			userFields: [],
		},
		taskService: {
			deleteTask: jest.fn().mockResolvedValue(undefined),
			toggleArchive: jest.fn(),
			updateTask: jest.fn(),
		},
		statusManager: {
			isCompletedStatus: jest.fn(() => false),
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
			isTaskFile: jest.fn(() => true),
		},
		fieldMapper: {
			toUserField: jest.fn((key: string) => key),
		},
	};
}

function createTask(): TaskInfo {
	return {
		title: 'Delete me',
		status: 'open',
		priority: 'normal',
		path: 'TaskNotes/Tasks/delete-me.md',
		archived: false,
		tags: ['task'],
		contexts: [],
		projects: [],
	} as TaskInfo;
}

function flushPromises(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Issue #1009 - Edit Task modal delete action', () => {
	let app: App;
	let plugin: ReturnType<typeof createMockPlugin>;
	let task: TaskInfo;
	let modal: TaskEditModal;
	let container: HTMLElement;

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();
		app = createMockApp(MockObsidian.createMockApp());
		plugin = createMockPlugin(app);
		task = createTask();
		modal = new TaskEditModal(app, plugin as any, { task });
		jest.spyOn(modal, 'forceClose').mockImplementation(jest.fn());
		container = makeContainer();
		(modal as unknown as { createActionButtons(container: HTMLElement): void })
			.createActionButtons(container);
	});

	it('adds a delete button to the edit modal action bar', () => {
		const deleteButton = container.querySelector<HTMLButtonElement>(
			'.tn-task-modal__delete-button'
		);

		expect(deleteButton).not.toBeNull();
		expect(deleteButton?.textContent).toBe('Delete');
		expect(deleteButton?.classList.contains('mod-warning')).toBe(true);
	});

	it('confirms before deleting the task file from the modal', async () => {
		mockShowConfirmationModal.mockResolvedValue(true);

		container
			.querySelector<HTMLButtonElement>('.tn-task-modal__delete-button')!
			.click();
		await flushPromises();

		expect(mockShowConfirmationModal).toHaveBeenCalledWith(app, {
			title: 'Delete task',
			message:
				'Are you sure you want to delete "Delete me"? This moves the task note to Obsidian trash.',
			confirmText: 'Delete task',
			cancelText: 'Cancel',
			isDestructive: true,
		});
		expect(plugin.taskService.deleteTask).toHaveBeenCalledWith(task);
		expect(Notice).toHaveBeenCalledWith('Task "Delete me" deleted successfully');
		expect(modal.forceClose).toHaveBeenCalled();
	});

	it('does not delete when the confirmation is cancelled', async () => {
		mockShowConfirmationModal.mockResolvedValue(false);

		container
			.querySelector<HTMLButtonElement>('.tn-task-modal__delete-button')!
			.click();
		await flushPromises();

		expect(plugin.taskService.deleteTask).not.toHaveBeenCalled();
		expect(modal.forceClose).not.toHaveBeenCalled();
	});
});
