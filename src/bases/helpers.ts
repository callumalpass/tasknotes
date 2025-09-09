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
  basesData?: any; // Raw Bases data for formula computation
}

/**
 * Create TaskInfo object from a single Bases data item
 */
function createTaskInfoFromProperties(props: Record<string, any>, basesItem: BasesDataItem): TaskInfo {
  const knownProperties = new Set([
    'title', 'status', 'priority', 'archived', 'due', 'scheduled', 'contexts',
    'projects', 'tags', 'timeEstimate', 'completedDate', 'recurrence',
    'dateCreated', 'dateModified', 'timeEntries', 'reminders', 'icsEventId'
  ]);

  const customProperties: Record<string, any> = {};
  Object.keys(props).forEach(key => {
    if (!knownProperties.has(key)) {
      customProperties[key] = props[key];
    }
  });

  return {
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
    icsEventId: props.icsEventId,
    customProperties: Object.keys(customProperties).length > 0 ? customProperties : undefined,
    basesData: basesItem.basesData
  };
}

export function createTaskInfoFromBasesData(basesItem: BasesDataItem, plugin?: TaskNotesPlugin): TaskInfo | null {
  if (!basesItem?.path) return null;

  const props = basesItem.properties || basesItem.frontmatter || {};

  if (plugin?.fieldMapper) {
    const mappedTaskInfo = plugin.fieldMapper.mapFromFrontmatter(props, basesItem.path, plugin.settings.storeTitleInFilename);
    return {
      ...createTaskInfoFromProperties(mappedTaskInfo, basesItem),
      customProperties: mappedTaskInfo.customProperties
    };
  } else {
    return createTaskInfoFromProperties(props, basesItem);
  }
}

/**
 * Identify TaskNotes from Bases data by converting all items to TaskInfo
 * Uses batch processing with async yielding to prevent UI freezing
 */
export async function identifyTaskNotesFromBasesData(
  dataItems: BasesDataItem[],
  plugin?: TaskNotesPlugin,
  toTaskInfo?: (item: BasesDataItem, plugin?: TaskNotesPlugin) => TaskInfo | null
): Promise<TaskInfo[]> {
  const taskInfoConverter = toTaskInfo || createTaskInfoFromBasesData;
  const taskNotes: TaskInfo[] = [];
  
  // Process in batches to avoid blocking the UI
  const batchSize = 50;
  for (let i = 0; i < dataItems.length; i += batchSize) {
    const batch = dataItems.slice(i, i + batchSize);
    
    for (const item of batch) {
      if (!item?.path) continue;
      try {
        const taskInfo = taskInfoConverter(item, plugin);
        if (taskInfo) taskNotes.push(taskInfo);
      } catch (error) {
        console.warn('[TaskNotes][BasesPOC] Error converting Bases item to TaskInfo:', error);
      }
    }
    
    // Yield control to prevent UI freezing using requestAnimationFrame for smoother performance
    if (i + batchSize < dataItems.length) {
      await new Promise(resolve => requestAnimationFrame(resolve));
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


export async function renderTaskNotesInBasesView(
  container: HTMLElement,
  taskNotes: TaskInfo[],
  plugin: TaskNotesPlugin,
  basesContainer?: any
): Promise<void> {

  const taskListEl = document.createElement('div');
  taskListEl.className = 'tn-bases-tasknotes-list';
  taskListEl.style.cssText = 'display: flex; flex-direction: column; gap: 1px;';
  container.appendChild(taskListEl);

  // Show loading indicator for large datasets
  let loadingIndicator: HTMLElement | null = null;
  if (taskNotes.length > 200) {
    loadingIndicator = container.createEl('div', {
      cls: 'tn-bases-loading',
      text: `Loading ${taskNotes.length} tasks...`
    });
    loadingIndicator.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted);';
  }

  // Render all tasks asynchronously with smooth batching
  await renderAllTasksAsync(taskListEl, taskNotes, plugin, basesContainer);

  // Remove loading indicator
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

/**
 * Render all tasks asynchronously with smooth batching - simpler approach
 */
async function renderAllTasksAsync(
  container: HTMLElement,
  taskNotes: TaskInfo[],
  plugin: TaskNotesPlugin,
  basesContainer: any
): Promise<void> {
  const { createTaskCard } = await import('../ui/TaskCard');

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
    
    if (basesVisibleProperties.length > 0) {
      visibleProperties = basesVisibleProperties.map(p => p.id).map(propId => {
        let mappedId = propId;
        
        // Apply field mappings (same logic as before)
        const internalFieldName = plugin.fieldMapper?.fromUserField(propId);
        if (internalFieldName) {
          mappedId = internalFieldName;
        }
        else if (propId.startsWith('task.')) {
          mappedId = propId.substring(5);
        }
        else if (propId.startsWith('note.')) {
          const stripped = propId.substring(5);
          const strippedInternalFieldName = plugin.fieldMapper?.fromUserField(stripped);
          if (strippedInternalFieldName) {
            mappedId = strippedInternalFieldName;
          }
          else if (stripped === 'dateCreated') mappedId = 'dateCreated';
          else if (stripped === 'dateModified') mappedId = 'dateModified';
          else if (stripped === 'completedDate') mappedId = 'completedDate';
          else mappedId = stripped;
        }
        else if (propId === 'file.ctime') mappedId = 'dateCreated';
        else if (propId === 'file.mtime') mappedId = 'dateModified';
        else if (propId === 'file.name') mappedId = 'title';
        else if (propId.startsWith('formula.')) {
          mappedId = propId;
        }
        
        return mappedId;
      });
    }
  }

  // Use plugin default properties if no Bases properties available
  if (!visibleProperties || visibleProperties.length === 0) {
    visibleProperties = plugin.settings.defaultVisibleProperties || [
      'due', 'scheduled', 'projects', 'contexts', 'tags'
    ];
  }

  // Render all tasks in smooth batches
  const batchSize = 25; // Good balance of speed vs smoothness
  for (let i = 0; i < taskNotes.length; i += batchSize) {
    const batch = taskNotes.slice(i, i + batchSize);
    const fragment = document.createDocumentFragment();
    
    for (const taskInfo of batch) {
      try {
        const taskCard = createTaskCard(taskInfo, plugin, visibleProperties, cardOptions);
        fragment.appendChild(taskCard);
      } catch (error) {
        console.warn('[TaskNotes][AsyncRender] Error creating task card:', error);
      }
    }
    
    // Add the entire batch at once
    container.appendChild(fragment);
    
    // Yield control using requestAnimationFrame for smooth rendering
    if (i + batchSize < taskNotes.length) {
      await new Promise(resolve => requestAnimationFrame(resolve));
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