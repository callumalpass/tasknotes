import TaskNotesPlugin from '../main';
import { WorkspaceLeaf, requireApiVersion } from 'obsidian';
import { BASES_TASK_LIST_VIEW_TYPE } from '../types';
import { buildTasknotesTaskListViewFactory } from './view-factory';

/**
 * Discover Bases and register the TaskNotes Task List view when enabled.
 * - Attempts early, retries until Bases is ready (startup restore case)
 * - Refreshes existing Bases leaves after registration
 */
export async function registerBasesTaskList(plugin: TaskNotesPlugin): Promise<void> {
  if (!plugin.settings?.enableBasesPOC) return;
  if (!requireApiVersion('1.9.12')) return;

  // Optional: register a simple ItemView for manual inspection
  try {
    const existing = (plugin.app as any)?.viewRegistry?.getViewCreatorByType?.(BASES_TASK_LIST_VIEW_TYPE);
    if (!existing && !(plugin as any).basesTaskListViewRegistered) {
      // Provide a simple ItemView for manual inspection
      const { BasesTaskListView } = await import('../views/BasesTaskListView');
      plugin.registerView(
        BASES_TASK_LIST_VIEW_TYPE,
        (leaf: WorkspaceLeaf) => new BasesTaskListView(leaf, plugin)
      );
      (plugin as any).basesTaskListViewRegistered = true;
    }
  } catch (e) {
    console.warn('[TaskNotes][Bases] Could not register BasesTaskListView:', e);
  }

  const tryRegisterWithBases = async (): Promise<boolean> => {
    try {
      const { InternalPluginName } = await import('obsidian-typings/implementations');
      const bases: any = ((plugin.app as any).internalPlugins as any).getEnabledPluginById?.(InternalPluginName.Bases);
      if (!bases?.registrations) return false;

      // Register Task List under a specific key for future multi-view support
      const factory = buildTasknotesTaskListViewFactory(plugin);
      const registration = {
        name: 'TaskNotes Task List',
        icon: 'check-square',
        factory,
        options: () => ({ description: 'TaskNotes Task List view' })
      } as const;

      if (!bases.registrations.tasknotesTaskList) {
        bases.registrations.tasknotesTaskList = registration;
        console.log('[TaskNotes][Bases] Registered TaskNotes Task List (key: tasknotesTaskList)');
      }

      // Register Kanban view using same pattern
      try {
        const { buildTasknotesKanbanViewFactory } = await import('./kanban-view');
        const kanbanFactory = buildTasknotesKanbanViewFactory(plugin);
        const kanbanRegistration = {
          name: 'TaskNotes Kanban',
          icon: 'layout-grid',
          factory: kanbanFactory,
          options: () => ({ description: 'TaskNotes Kanban view' })
        } as const;
        if (!bases.registrations.tasknotesKanban) {
          bases.registrations.tasknotesKanban = kanbanRegistration;
          console.log('[TaskNotes][Bases] Registered TaskNotes Kanban (key: tasknotesKanban)');
        }
      } catch (e) {
        console.warn('[TaskNotes][Bases] Could not register TaskNotes Kanban:', e);

	      // Register Agenda view using same pattern
	      try {
	        const { buildTasknotesAgendaViewFactory } = await import('./agenda-view');
	        const agendaFactory = buildTasknotesAgendaViewFactory(plugin);
	        const agendaRegistration = {
	          name: 'TaskNotes Agenda',
	          icon: 'calendar',
	          factory: agendaFactory,
	          options: () => ({ description: 'TaskNotes Agenda view' })
	        } as const;
	        if (!bases.registrations.tasknotesAgenda) {
	          bases.registrations.tasknotesAgenda = agendaRegistration;
	          console.log('[TaskNotes][Bases] Registered TaskNotes Agenda (key: tasknotesAgenda)');
	        }
	      } catch (e) {
	        console.warn('[TaskNotes][Bases] Could not register TaskNotes Agenda:', e);
	      }

      }

	      // Register Agenda view using same pattern (outside Kanban try/catch)
	      try {
	        const { buildTasknotesAgendaViewFactory } = await import('./agenda-view');
	        const agendaFactory = buildTasknotesAgendaViewFactory(plugin);
	        const agendaRegistration = {
	          name: 'TaskNotes Agenda',
	          icon: 'calendar',
	          factory: agendaFactory,
	          options: () => ({ description: 'TaskNotes Agenda view' })
	        } as const;
	          if (!bases.registrations.tasknotesAgenda) {
	            bases.registrations.tasknotesAgenda = agendaRegistration;
	            console.log('[TaskNotes][Bases] Registered TaskNotes Agenda (key: tasknotesAgenda)');
	          }
	      } catch (e) {
	        console.warn('[TaskNotes][Bases] Could not register TaskNotes Agenda:', e);
	      }


      // Best-effort refresh of existing Bases leaves (handles restored tabs)
      try {
        plugin.app.workspace.iterateAllLeaves((leaf) => {
          if (leaf.view?.getViewType?.() === 'bases') {
            const view = leaf.view as any;
            if (typeof view.refresh === 'function') view.refresh();
            else if (typeof view.onResize === 'function') view.onResize();
          }
        });
      } catch (refreshError) {
        console.warn('[TaskNotes][Bases] Could not refresh Bases views:', refreshError);
      }

      return true;
    } catch (e) {
      console.warn('[TaskNotes][Bases] Discovery/registration failed:', e);
      return false;
    }
  };

  // Attempt immediately, then retry a few times to cover startup timing
  const immediate = await tryRegisterWithBases();
  if (immediate) return;

  // Retry with short backoff (total ~3s)
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await tryRegisterWithBases()) return;
  }

  // Also try once when layout is ready (in case Bases initializes after layout)
  plugin.app.workspace.onLayoutReady(async () => {
    await tryRegisterWithBases();
  });
}

