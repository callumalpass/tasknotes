import { App } from 'obsidian';
import { TaskModal } from '../../../src/modals/TaskModal';
import { MockObsidian } from '../../__mocks__/obsidian';

jest.mock('obsidian');

class TestTaskModal extends TaskModal {
	async initializeFormData(): Promise<void> {}
	async handleSave(): Promise<void> {}
	getModalTitle(): string {
		return 'Test task modal';
	}

	renderTitleInput(container: HTMLElement): HTMLInputElement {
		this.createTitleInput(container);
		return (this as any).titleInput;
	}

	focusTitle(): void {
		this.focusTitleInput();
	}
}

function createMockPlugin() {
	return {
		i18n: {
			translate: (key: string) => key,
		},
		settings: {
			enableModalSplitLayout: false,
			modalFieldsConfig: undefined,
		},
	} as any;
}

describe('Issue #1035: task modal title focus on mobile', () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = MockObsidian.createMockApp() as unknown as App;
		document.body.classList.add('is-mobile');
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.classList.remove('is-mobile');
		document.body.innerHTML = '';
	});

	it('restores the modal scroll position when a tapped title input receives focus', () => {
		const modal = new TestTaskModal(app, createMockPlugin());
		const scrollContainer = modal.contentEl.createDiv({ cls: 'modal-split-content' });
		const input = modal.renderTitleInput(scrollContainer);

		Object.defineProperty(scrollContainer, 'scrollHeight', { configurable: true, value: 1000 });
		Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: 300 });

		scrollContainer.scrollTop = 120;
		input.dispatchEvent(new Event('pointerdown', { bubbles: true }));

		scrollContainer.scrollTop = 900;
		input.dispatchEvent(new Event('focus'));
		jest.runOnlyPendingTimers();

		expect(scrollContainer.scrollTop).toBe(120);
	});

	it('uses preventScroll for programmatic title focus', () => {
		const modal = new TestTaskModal(app, createMockPlugin());
		const input = modal.renderTitleInput(modal.contentEl);
		const focus = jest.spyOn(input, 'focus').mockImplementation(() => {});
		jest.spyOn(input, 'select').mockImplementation(() => {});

		modal.focusTitle();
		jest.runOnlyPendingTimers();

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});
});
