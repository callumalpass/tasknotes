import TaskNotesPlugin from '../main';
import { TaskInfo } from '../types';
import { setIcon } from 'obsidian';

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
  toTaskInfo?: (item: BasesDataItem, plugin?: TaskNotesPlugin) => TaskInfo | null,
  cancellation?: { cancelled: boolean }
): Promise<TaskInfo[]> {
  const taskInfoConverter = toTaskInfo || createTaskInfoFromBasesData;
  const taskNotes: TaskInfo[] = [];
  
  // Process in batches to avoid blocking the UI
  const batchSize = 50;
  for (let i = 0; i < dataItems.length; i += batchSize) {
    // Check for cancellation before processing each batch
    if (cancellation?.cancelled) {
      console.debug('[TaskNotes][Helpers] Task identification cancelled');
      return [];
    }
    
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
  basesContainer?: any,
  cancellation?: { cancelled: boolean } | null
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
  await renderAllTasksAsync(taskListEl, taskNotes, plugin, basesContainer, cancellation);

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
  basesContainer: any,
  cancellation?: { cancelled: boolean } | null
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

  // Render all tasks in very small batches for less blocking
  const batchSize = taskNotes.length > 1000 ? 5 : 10; // Smaller batches for large datasets
  const yieldDelay = taskNotes.length > 1000 ? 50 : 16; // Longer delays for large datasets
  
  for (let i = 0; i < taskNotes.length; i += batchSize) {
    // Check for cancellation before processing each batch
    if (cancellation?.cancelled) {
      console.debug('[TaskNotes][AsyncRender] Async rendering cancelled');
      return;
    }
    
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
    
    // Use longer delays to be less blocking, especially for large datasets
    if (i + batchSize < taskNotes.length) {
      await new Promise(resolve => setTimeout(resolve, yieldDelay));
    }
  }
}


/**
 * Render a raw Bases data item for debugging/inspection
 */
/**
 * Show performance warning dialog for large datasets
 */
export async function showPerformanceWarning(taskCount: number): Promise<boolean> {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'tn-performance-warning-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'tn-performance-warning-modal';
    modal.style.cssText = `
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 24px;
      max-width: 480px;
      margin: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    // Warning icon and title
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; margin-bottom: 16px;';
    
    // Create warning icon using Lucide
    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'margin-right: 12px; color: var(--text-warning); display: flex; align-items: center;';
    setIcon(iconEl, 'alert-triangle');
    header.appendChild(iconEl);
    
    // Create title text
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size: 18px; font-weight: 600; color: var(--text-normal);';
    titleEl.textContent = 'Performance Warning';
    header.appendChild(titleEl);
    modal.appendChild(header);

    // Warning message
    const message = document.createElement('div');
    message.style.cssText = 'margin-bottom: 20px; line-height: 1.5; color: var(--text-normal);';
    
    // Create intro paragraph
    const intro = document.createElement('p');
    intro.style.cssText = 'margin: 0 0 12px 0;';
    intro.textContent = 'This query returned ';
    
    const taskCountStrong = document.createElement('strong');
    taskCountStrong.textContent = taskCount.toLocaleString() + ' tasks';
    intro.appendChild(taskCountStrong);
    
    const introEnd = document.createTextNode(', which may cause performance issues:');
    intro.appendChild(introEnd);
    message.appendChild(intro);
    
    // Create issues list
    const issuesList = document.createElement('ul');
    issuesList.style.cssText = 'margin: 0 0 12px 20px; padding: 0;';
    
    const issues = ['Slow rendering and UI freezing', 'Decreased responsiveness'];
    issues.forEach(issue => {
      const li = document.createElement('li');
      li.textContent = issue;
      issuesList.appendChild(li);
    });
    message.appendChild(issuesList);
    
    // Create advice paragraph
    const advice = document.createElement('p');
    advice.style.cssText = 'margin: 0; font-weight: 500;';
    advice.textContent = 'Consider refining your filter query to show fewer results, or continue if you need to see all tasks.';
    message.appendChild(advice);
    
    modal.appendChild(message);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      padding: 8px 16px;
      border: 1px solid var(--background-modifier-border);
      background: var(--background-secondary);
      color: var(--text-normal);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;

    const continueButton = document.createElement('button');
    continueButton.textContent = `Load All ${taskCount.toLocaleString()} Tasks`;
    continueButton.style.cssText = `
      padding: 8px 16px;
      border: none;
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;

    // Button hover effects
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = 'var(--background-modifier-hover)';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = 'var(--background-secondary)';
    });

    continueButton.addEventListener('mouseenter', () => {
      continueButton.style.opacity = '0.9';
    });
    continueButton.addEventListener('mouseleave', () => {
      continueButton.style.opacity = '1';
    });

    // Event handlers
    const cleanup = () => {
      overlay.remove();
    };

    cancelButton.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    continueButton.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });

    // Close on Escape key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', handleKeydown);
        resolve(false);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(continueButton);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);
    
    // Add to document
    document.body.appendChild(overlay);

    // Focus the continue button by default
    setTimeout(() => continueButton.focus(), 100);
  });
}

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