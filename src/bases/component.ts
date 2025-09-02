import { Component } from 'obsidian';

export interface BasesComponentHooks {
  getContainer: () => HTMLElement | null;
  setContainer: (el: HTMLElement | null) => void;
  refresh: () => Promise<void> | void;
  attachQueryListener?: (handler: () => void) => void;
  detachQueryListener?: (handler: () => void) => void;
}

/**
 * Minimal Obsidian Component subclass for Bases lifecycle management.
 * The concrete rendering and event wiring are provided via hooks.
 */
export class TaskNotesBasesTaskListComponent extends Component {
  private destroyed = false;
  private readonly onQueryChanged = () => {
    if (this.destroyed) return;
    void Promise.resolve(this.hooks.refresh());
  };

  constructor(private hooks: BasesComponentHooks) {
    super();
  }

  getViewType() { return 'tasknotes-task-list'; }
  getDisplayText() { return 'TaskNotes Task List'; }
  getEphemeralState() { return { type: 'tasknotes', scrollTop: this.hooks.getContainer()?.scrollTop || 0 }; }
  setEphemeralState(state: any) {
    const c = this.hooks.getContainer();
    if (state?.scrollTop && c) c.scrollTop = state.scrollTop;
  }
  onResize() { /* no-op for now */ }

  // Called by Bases when the underlying data changes
  onDataUpdated(..._args: any[]): void {
    if (this.destroyed) return;
    void Promise.resolve(this.hooks.refresh());
  }

  onload(): void {
    this.destroyed = false;
    if (this.hooks.attachQueryListener) this.hooks.attachQueryListener(this.onQueryChanged);
  }

  onunload(): void {
    if (this.hooks.detachQueryListener) this.hooks.detachQueryListener(this.onQueryChanged);
    const c = this.hooks.getContainer();
    if (c) {
      c.remove();
      this.hooks.setContainer(null);
    }
    this.destroyed = true;
  }
}

