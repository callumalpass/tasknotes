import TaskNotesPlugin from '../main';
import { buildTasknotesBaseViewFactory } from './base-view-factory';

export function buildTasknotesAgendaViewFactory(plugin: TaskNotesPlugin) {
  return buildTasknotesBaseViewFactory(plugin, {
    emptyStateMessage: 'No TaskNotes tasks found for this Base (Agenda View).',
    errorPrefix: 'Agenda'
  });
}