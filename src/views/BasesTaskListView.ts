import { ItemView, WorkspaceLeaf } from 'obsidian';
import TaskNotesPlugin from '../main';
import { BASES_TASK_LIST_VIEW_TYPE } from '../types';

export class BasesTaskListView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TaskNotesPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return BASES_TASK_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'TaskNotes Task List';
  }

  getIcon(): string {
    return 'check-square';
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    const root = container.createDiv({ cls: 'tn-bases-task-list' });

    root.createEl('h4', { text: 'TaskNotes Task List' });
    const ul = root.createEl('ul', { cls: 'tn-bases-task-list-items' });
    ['Sample Task A', 'Sample Task B', 'Sample Task C'].forEach(t => {
      const li = ul.createEl('li');
      const cb = li.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
      cb.disabled = true;
      li.createSpan({ text: ' ' + t });
    });
  }

  async onClose() {
    // no-op
  }
}

