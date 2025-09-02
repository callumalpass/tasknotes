import TaskNotesPlugin from '../main';
import { TaskInfo } from '../types';

export interface BasesDataItem {
  key?: string;
  data?: any;
  file?: { path?: string } | any;
  path?: string;
  properties?: Record<string, any>;
  frontmatter?: Record<string, any>;
  name?: string;
}

/**
 * Create TaskInfo object from a single Bases data item
 */
export function createTaskInfoFromBasesData(basesItem: BasesDataItem): TaskInfo | null {
  if (!basesItem?.path) return null;

  const props = basesItem.properties || basesItem.frontmatter || {};

  const taskInfo: TaskInfo = {
    title: props.title || basesItem.name || basesItem.path!.split('/').pop()?.replace('.md', '') || 'Untitled',
    status: props.status || 'open',
    priority: props.priority || 'normal',
    path: basesItem.path!,
    archived: props.archived || false,
    due: props.due,
    scheduled: props.scheduled,
    contexts: Array.isArray(props.contexts) ? props.contexts : (props.contexts ? [props.contexts] : undefined),
    projects: Array.isArray(props.projects) ? props.projects : (props.projects ? [props.projects] : undefined),
    tags: Array.isArray(props.tags) ? props.tags : (props.tags ? [props.tags] : undefined),
    timeEstimate: props.timeEstimate,
    completedDate: props.completedDate,
    recurrence: props.recurrence,
    dateCreated: props.dateCreated,
    dateModified: props.dateModified,
    timeEntries: props.timeEntries,
    reminders: props.reminders,
    icsEventId: props.icsEventId
  };

  return taskInfo;
}

/**
 * Identify TaskNotes from Bases data by converting all items to TaskInfo
 */
export async function identifyTaskNotesFromBasesData(
  dataItems: BasesDataItem[],
  toTaskInfo: (item: BasesDataItem) => TaskInfo | null = createTaskInfoFromBasesData
): Promise<TaskInfo[]> {
  const taskNotes: TaskInfo[] = [];
  for (const item of dataItems) {
    if (!item?.path) continue;
    try {
      const taskInfo = toTaskInfo(item);
      if (taskInfo) taskNotes.push(taskInfo);
    } catch (error) {
      console.warn('[TaskNotes][BasesPOC] Error converting Bases item to TaskInfo:', error);
    }
  }
  return taskNotes;
}

/**
 * Render TaskNotes using TaskCard component into a container
 */
export async function renderTaskNotesInBasesView(
  container: HTMLElement,
  taskNotes: TaskInfo[],
  plugin: TaskNotesPlugin,
  extraOptions: Partial<import('../ui/TaskCard').TaskCardOptions> = {}
): Promise<void> {
  const { createTaskCard, DEFAULT_TASK_CARD_OPTIONS } = await import('../ui/TaskCard');

  const taskListEl = document.createElement('div');
  taskListEl.className = 'tn-bases-tasknotes-list';
  taskListEl.style.cssText = 'display: flex; flex-direction: column; gap: 1px;';
  container.appendChild(taskListEl);

  const cardOptions = {
    ...DEFAULT_TASK_CARD_OPTIONS,
    showCheckbox: false,
    showDueDate: true,
    showArchiveButton: false,
    showTimeTracking: false,
    ...extraOptions
  };

  for (const taskInfo of taskNotes) {
    const taskCard = createTaskCard(taskInfo, plugin, undefined, cardOptions);
    taskListEl.appendChild(taskCard);
  }
}

/**
 * Render a raw Bases data item for debugging/inspection
 */
export function renderBasesDataItem(container: HTMLElement, item: BasesDataItem, index: number): void {
  const itemEl = document.createElement('div');
  itemEl.className = 'tn-bases-data-item';
  itemEl.style.cssText = 'padding: 12px; margin: 8px 0; background: #fff; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';

  const header = document.createElement('div');
  header.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #333;';
  itemEl.appendChild(header);

  if ((item as any).path) {
    const pathEl = document.createElement('div');
    pathEl.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 6px; font-family: monospace;';
    itemEl.appendChild(pathEl);
  }

  const props = (item as any).properties;
  if (props && typeof props === 'object') {
    const propsEl = document.createElement('div');
    propsEl.style.cssText = 'font-size: 12px; margin-top: 8px;';

    const propsHeader = document.createElement('div');
    propsHeader.style.cssText = 'font-weight: bold; margin-bottom: 4px; color: #555;';
    propsHeader.textContent = 'Properties:';
    propsEl.appendChild(propsHeader);

    const propsList = document.createElement('ul');
    propsList.style.cssText = 'margin: 0; padding-left: 16px; list-style-type: disc;';

    Object.entries(props).forEach(([key, value]) => {
      const li = document.createElement('li');
      li.style.cssText = 'margin: 2px 0; color: #444;';
      propsList.appendChild(li);
    });

    propsEl.appendChild(propsList);
    itemEl.appendChild(propsEl);
  }

  const rawDataEl = document.createElement('details');
  rawDataEl.style.cssText = 'margin-top: 8px; font-size: 11px;';

  const summary = document.createElement('summary');
  summary.style.cssText = 'cursor: pointer; color: #666; font-weight: bold;';
  summary.textContent = 'Raw Data Structure';
  rawDataEl.appendChild(summary);

  const pre = document.createElement('pre');
  pre.style.cssText = 'margin: 8px 0 0 0; padding: 8px; background: #f8f8f8; border-radius: 4px; overflow-x: auto; font-size: 10px;';
  pre.textContent = JSON.stringify(item, null, 2);
  rawDataEl.appendChild(pre);

  itemEl.appendChild(rawDataEl);
  container.appendChild(itemEl);
}

