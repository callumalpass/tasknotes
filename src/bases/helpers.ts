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
interface BasesSelectedProperty { 
  id: string; 
  displayName: string; 
  visible: boolean; 
}

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function getBasesVisibleProperties(basesContainer: any): BasesSelectedProperty[] {
  try {
    const controller = (basesContainer?.controller ?? basesContainer) as any;
    const query = (basesContainer?.query ?? controller?.query) as any;

    if (!controller) return [];

    // Build index from available properties
    const propsMap: Record<string, any> | undefined = query?.properties;
    const idIndex = new Map<string, string>();
    if (propsMap && typeof propsMap === 'object') {
      for (const id of Object.keys(propsMap)) {
        idIndex.set(id, id);
        const last = id.includes('.') ? id.split('.').pop()! : id;
        idIndex.set(last, id);
        const dn = propsMap[id]?.getDisplayName?.();
        if (typeof dn === 'string' && dn.trim()) idIndex.set(dn.toLowerCase(), id);
      }
    }

    const normalizeToId = (token: string): string | undefined => {
      if (!token) return undefined;
      return idIndex.get(token) || idIndex.get(token.toLowerCase()) || token;
    };

    // Get visible properties from Bases order configuration
    const fullCfg = controller?.getViewConfig?.() ?? {};
    
    let order: string[] | undefined;
    try {
      order = (query?.getViewConfig?.('order') as string[] | undefined)
        ?? (fullCfg as any)?.order
        ?? (fullCfg as any)?.columns?.order;
    } catch (_) {
      order = (fullCfg as any)?.order ?? (fullCfg as any)?.columns?.order;
    }

    if (!order || !Array.isArray(order) || order.length === 0) return [];

    const orderedIds: string[] = order
      .map(normalizeToId)
      .filter((id): id is string => !!id);

    return orderedIds.map(id => ({
      id,
      displayName: propsMap?.[id]?.getDisplayName?.() ?? id,
      visible: true
    }));
  } catch (e) {
    console.debug('[TaskNotes][Bases] getBasesVisibleProperties failed:', e);
    return [];
  }
}

export function mapBasesPropertiesToCardOptions(visibleProperties: BasesSelectedProperty[]) {
  const propertyIds = new Set(visibleProperties.map(p => p.id));
  
  return {
    showCheckbox: false,
    showDueDate: propertyIds.has('due') || propertyIds.has('task.due'),
    showScheduledDate: propertyIds.has('scheduled') || propertyIds.has('task.scheduled'),
    showPriority: propertyIds.has('priority') || propertyIds.has('task.priority'),
    showStatus: propertyIds.has('status') || propertyIds.has('task.status'),
    showProjects: propertyIds.has('projects') || propertyIds.has('task.projects'),
    showContexts: propertyIds.has('contexts') || propertyIds.has('task.contexts'),
    showTags: propertyIds.has('tags') || propertyIds.has('task.tags'),
    showTimeEstimate: propertyIds.has('timeEstimate') || propertyIds.has('task.timeEstimate'),
    showTimeTracking: propertyIds.has('totalTrackedTime') || propertyIds.has('task.totalTrackedTime'),
    showRecurrence: propertyIds.has('recurrence') || propertyIds.has('task.recurrence'),
    showCompletedDate: propertyIds.has('completedDate') || propertyIds.has('task.completedDate'),
    showCreatedDate: propertyIds.has('file.ctime') || propertyIds.has('dateCreated'),
    showModifiedDate: propertyIds.has('file.mtime') || propertyIds.has('dateModified'),
    showArchiveButton: false,
    showRecurringControls: true,
    groupByDate: false
  };
}

export async function renderTaskNotesInBasesView(
  container: HTMLElement,
  taskNotes: TaskInfo[],
  plugin: TaskNotesPlugin,
  basesContainer?: any
): Promise<void> {
  const { createTaskCard } = await import('../ui/TaskCard');

  const taskListEl = document.createElement('div');
  taskListEl.className = 'tn-bases-tasknotes-list';
  taskListEl.style.cssText = 'display: flex; flex-direction: column; gap: 1px;';
  container.appendChild(taskListEl);

  // Get visible properties from Bases
  let visibleProperties: string[] | undefined;
  let cardOptions = {
    showCheckbox: false,
    showArchiveButton: false,
    showTimeTracking: false,
    showRecurringControls: true,
    groupByDate: false
  };

  if (basesContainer) {
    const basesVisibleProperties = getBasesVisibleProperties(basesContainer);
    console.log('[TaskNotes][Bases] Visible properties from Bases:', basesVisibleProperties);
    
    if (basesVisibleProperties.length > 0) {
      // Extract just the property IDs for TaskCard
      visibleProperties = basesVisibleProperties.map(p => p.id);
      
      // Map common property names to TaskNotes property names
      visibleProperties = visibleProperties.map(propId => {
        // Handle dotted properties like task.due -> due
        if (propId.startsWith('task.')) {
          return propId.substring(5);
        }
        // Handle note properties like note.projects -> projects
        if (propId.startsWith('note.')) {
          const stripped = propId.substring(5);
          // Map specific note properties to TaskNotes property names
          if (stripped === 'dateCreated') return 'dateCreated';
          if (stripped === 'dateModified') return 'dateModified';
          if (stripped === 'completedDate') return 'completedDate';
          return stripped; // projects, contexts, tags, and any other arbitrary properties
        }
        // Handle file properties
        if (propId === 'file.ctime') return 'dateCreated';
        if (propId === 'file.mtime') return 'dateModified';
        if (propId === 'file.name') return 'title'; // Map file name to title
        
        // Pass through arbitrary properties unchanged
        // These will be handled by the generic property renderer in TaskCard
        return propId;
      });
      
      console.log('[TaskNotes][Bases] Mapped visible properties:', visibleProperties);
    }
  }

  // Use plugin default properties if no Bases properties available
  if (!visibleProperties || visibleProperties.length === 0) {
    visibleProperties = plugin.settings.defaultVisibleProperties || [
      'due', 'scheduled', 'projects', 'contexts', 'tags'
    ];
    console.log('[TaskNotes][Bases] Using plugin default properties:', visibleProperties);
  }

  for (const taskInfo of taskNotes) {
    try {
      const taskCard = createTaskCard(taskInfo, plugin, visibleProperties, cardOptions);
      taskListEl.appendChild(taskCard);
    } catch (error) {
      console.warn('[TaskNotes][BasesPOC] Error creating task card:', error);
    }
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
  header.textContent = `Item ${index + 1}`;
  itemEl.appendChild(header);

  if ((item as any).path) {
    const pathEl = document.createElement('div');
    pathEl.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 6px; font-family: monospace;';
    pathEl.textContent = `Path: ${(item as any).path}`;
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
      li.textContent = `${key}: ${JSON.stringify(value)}`;
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