import TaskNotesPlugin from '../main';
import { buildTasknotesBaseViewFactory } from './base-view-factory';

export function buildTasknotesTaskListViewFactory(plugin: TaskNotesPlugin) {
  return buildTasknotesBaseViewFactory(plugin, {
    emptyStateMessage: 'TaskNotes are identified by files with task-related frontmatter properties.',
    errorPrefix: ''
  });
}