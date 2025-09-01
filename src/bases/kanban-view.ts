import TaskNotesPlugin from '../main';
import { buildTasknotesBaseViewFactory } from './base-view-factory';

export function buildTasknotesKanbanViewFactory(plugin: TaskNotesPlugin) {
  return buildTasknotesBaseViewFactory(plugin, {
    emptyStateMessage: 'No TaskNotes tasks found for this Base (Kanban View).',
    errorPrefix: 'Kanban'
  });
}