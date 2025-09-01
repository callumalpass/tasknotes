import TaskNotesPlugin from '../main';
import { requireApiVersion } from 'obsidian';
import { buildTasknotesTaskListViewFactory } from './view-factory';

/**
 * Register TaskNotes Task List view with Bases plugin
 */
export async function registerBasesTaskList(plugin: TaskNotesPlugin): Promise<void> {
  if (!plugin.settings.enableBasesPOC) return;
  if (!requireApiVersion('1.9.12')) return;

  const attemptRegistration = async (): Promise<boolean> => {
    try {
      const bases: any = ((plugin.app as any).internalPlugins as any).getEnabledPluginById?.('bases');
      if (!bases?.registrations) return false;

      if (!bases.registrations.tasknotesTaskList) {
        const factory = buildTasknotesTaskListViewFactory(plugin);
        bases.registrations.tasknotesTaskList = {
          name: 'TaskNotes',
          icon: 'tasknotes-simple',
          factory,
          options: () => ({ description: 'TaskNotes view' })
        };
        console.log('[TaskNotes][Bases] Registered TaskNotes');
      }

      // Refresh existing Bases views
      plugin.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view?.getViewType?.() === 'bases') {
          const view = leaf.view as any;
          if (typeof view.refresh === 'function') view.refresh();
        }
      });

      return true;
    } catch (e) {
      // Silently handle registration failures
      return false;
    }
  };

  // Try immediate registration
  if (await attemptRegistration()) return;

  // If that fails, try a few more times with short delays
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await attemptRegistration()) return;
  }
}