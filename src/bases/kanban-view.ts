import TaskNotesPlugin from '../main';
import { BasesDataItem, identifyTaskNotesFromBasesData } from './helpers';
import { TaskInfo } from '../types';

export interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { 
    on?: (event: string, cb: () => void) => void; 
    off?: (event: string, cb: () => void) => void;
  };
  viewContainerEl?: HTMLElement;
  controller?: any;
}

/**
 * Extract minimal groupBy configuration from Bases container
 */
function getBasesGroupByProperty(basesContainer: BasesContainerLike): string | null {
  try {
    const controller = (basesContainer as any)?.controller ?? basesContainer;
    const query = basesContainer?.query ?? controller?.query;
    const fullCfg = controller?.getViewConfig?.() ?? {};
    
    // Try to get groupBy from various locations in Bases config
    let groupBy = fullCfg?.groupBy 
      ?? (fullCfg as any)?.data?.groupBy
      ?? query?.getViewConfig?.('groupBy');
    
    if (typeof groupBy === 'string') return groupBy;
    return null;
  } catch (e) {
    console.debug('[TaskNotes][Bases] getBasesGroupByProperty failed:', e);
    return null;
  }
}

/**
 * Get group value for a task based on the groupBy property
 */
function getTaskGroupValue(task: TaskInfo, groupBy: string): string {
  switch (groupBy) {
    case 'status':
      return task.status || 'open';
    case 'priority':
      return task.priority || 'normal';
    case 'project':
    case 'projects':
      return task.projects?.[0] || 'No Project';
    case 'context':
    case 'contexts':
      return task.contexts?.[0] || 'uncategorized';
    default:
      return 'uncategorized';
  }
}

export function buildTasknotesKanbanViewFactory(plugin: TaskNotesPlugin) {
  return function tasknotesKanbanViewFactory(basesContainer: BasesContainerLike) {
    let currentRoot: HTMLElement | null = null;

    const viewContainerEl = (basesContainer as any)?.viewContainerEl as HTMLElement | undefined;
    if (!viewContainerEl) {
      console.error('[TaskNotes][Bases] No viewContainerEl found');
      return { destroy: () => {} } as any;
    }

    // Clear container
    viewContainerEl.innerHTML = '';

    // Root container
    const root = document.createElement('div');
    root.className = 'tn-bases-integration tasknotes-plugin kanban-view';
    viewContainerEl.appendChild(root);
    currentRoot = root;

    // Board container
    const board = document.createElement('div');
    board.className = 'kanban-view__board';
    root.appendChild(board);

    const extractDataItems = (): BasesDataItem[] => {
      const dataItems: BasesDataItem[] = [];
      const results = (basesContainer as any)?.results as Map<any, any> | undefined;
      if (results && results instanceof Map) {
        for (const [, value] of results.entries()) {
          dataItems.push({
            key: (value as any)?.file?.path || (value as any)?.path,
            data: value,
            file: (value as any)?.file,
            path: (value as any)?.file?.path || (value as any)?.path,
            properties: (value as any)?.properties || (value as any)?.frontmatter
          });
        }
      }
      return dataItems;
    };

    const render = async () => {
      if (!currentRoot) return;
      
      try {
        const dataItems = extractDataItems();
        const taskNotes = await identifyTaskNotesFromBasesData(dataItems);

        // Clear board
        board.innerHTML = '';

        if (taskNotes.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'tn-bases-empty';
          empty.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted);';
          empty.textContent = 'No TaskNotes tasks found for this Base.';
          board.appendChild(empty);
          return;
        }

        // Get groupBy property from Bases config
        const groupBy = getBasesGroupByProperty(basesContainer) || 'status';

        // Group tasks
        const groups = new Map<string, TaskInfo[]>();
        for (const task of taskNotes) {
          const groupValue = getTaskGroupValue(task, groupBy);
          if (!groups.has(groupValue)) {
            groups.set(groupValue, []);
          }
          groups.get(groupValue)!.push(task);
        }

        // Add empty columns for common values
        const allGroupValues = new Set(groups.keys());
        if (groupBy === 'status') {
          plugin.statusManager.getAllStatuses().forEach(status => {
            allGroupValues.add(status.value);
          });
        } else if (groupBy === 'priority') {
          plugin.priorityManager.getAllPriorities().forEach(priority => {
            allGroupValues.add(priority.value);
          });
        }

        // Create columns
        const columnIds = Array.from(allGroupValues).sort();
        
        for (const columnId of columnIds) {
          const tasks = groups.get(columnId) || [];
          const columnEl = createColumnElement(columnId, tasks, groupBy);
          board.appendChild(columnEl);
        }

      } catch (error) {
        console.error('[TaskNotes][Bases] Error rendering Kanban:', error);
      }
    };

    // Reuse existing kanban column creation logic
    const createColumnElement = (columnId: string, tasks: TaskInfo[], groupBy: string): HTMLElement => {
      const columnEl = document.createElement('div');
      columnEl.className = 'kanban-view__column';
      columnEl.dataset.columnId = columnId;

      // Column header
      const headerEl = columnEl.createDiv({ cls: 'kanban-view__column-header' });
      
      // Title
      const title = formatColumnTitle(columnId, groupBy);
      headerEl.createEl('div', { cls: 'kanban-view__column-title', text: title });
      
      // Count
      headerEl.createEl('div', { 
        text: `${tasks.length} tasks`, 
        cls: 'kanban-view__column-count' 
      });

      // Column body
      const bodyEl = columnEl.createDiv({ cls: 'kanban-view__column-body' });
      const tasksContainer = bodyEl.createDiv({ cls: 'kanban-view__tasks-container' });

      // Render tasks using existing TaskCard system
      tasks.forEach(task => {
        const visibleProperties = plugin.settings.defaultVisibleProperties;
        const { createTaskCard } = require('../ui/TaskCard');
        const taskCard = createTaskCard(task, plugin, visibleProperties, {
          showDueDate: true,
          showCheckbox: false,
          showTimeTracking: true
        });
        
        // Make draggable
        taskCard.draggable = true;
        taskCard.addEventListener('dragstart', (e: DragEvent) => {
          if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', task.path);
            e.dataTransfer.effectAllowed = 'move';
          }
        });
        
        tasksContainer.appendChild(taskCard);
      });

      // Add drop handlers
      addColumnDropHandlers(columnEl, async (taskPath: string, targetColumnId: string) => {
        try {
          const task = await plugin.cacheManager.getCachedTaskInfo(taskPath);
          if (task) {
            let propertyToUpdate: string;
            let valueToSet: any;
            
            switch (groupBy) {
              case 'status':
                propertyToUpdate = 'status';
                valueToSet = targetColumnId;
                break;
              case 'priority':
                propertyToUpdate = 'priority';
                valueToSet = targetColumnId;
                break;
              case 'context':
              case 'contexts':
                propertyToUpdate = 'contexts';
                valueToSet = targetColumnId === 'uncategorized' ? [] : [targetColumnId];
                break;
              case 'project':
              case 'projects':
                propertyToUpdate = 'projects';
                valueToSet = targetColumnId === 'No Project' ? [] : [targetColumnId];
                break;
              default:
                throw new Error(`Unsupported groupBy for drag-and-drop: ${groupBy}`);
            }
            
            await plugin.updateTaskProperty(task, propertyToUpdate as keyof TaskInfo, valueToSet, { silent: true });
            // Refresh the view
            await render();
          }
        } catch (e) {
          console.error('[TaskNotes][Bases] Move failed:', e);
        }
      });

      return columnEl;
    };

    // Reuse existing column title formatting
    const formatColumnTitle = (id: string, groupBy: string): string => {
      switch (groupBy) {
        case 'status':
          return plugin.statusManager.getStatusConfig(id)?.label || id;
        case 'priority':
          return plugin.priorityManager.getPriorityConfig(id)?.label || id;
        case 'context':
        case 'contexts':
          return id === 'uncategorized' ? 'Uncategorized' : `@${id}`;
        case 'project':
        case 'projects':
          return id === 'No Project' ? 'No Project' : id;
        default:
          return id;
      }
    };

    // Reuse existing drop handler logic
    const addColumnDropHandlers = (columnEl: HTMLElement, onDropTask: (taskPath: string, targetColumnId: string) => void | Promise<void>) => {
      columnEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        columnEl.classList.add('kanban-view__column--dragover');
      });
      
      columnEl.addEventListener('dragleave', (e) => {
        if (!columnEl.contains(e.relatedTarget as Node)) {
          columnEl.classList.remove('kanban-view__column--dragover');
        }
      });
      
      columnEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        columnEl.classList.remove('kanban-view__column--dragover');
        const data = e.dataTransfer?.getData('text/plain');
        const taskPath = data;
        const targetColumnId = columnEl.getAttribute('data-column-id') || '';
        if (taskPath && targetColumnId) {
          await onDropTask(taskPath, targetColumnId);
        }
      });
    };

    // Set up lifecycle
    const component = {
      onload: () => {
        void render();
      },
      onunload: () => {
        // Cleanup if needed
      },
      refresh: render
    };

    // Listen for Bases query changes
    const queryListener = () => void render();
    basesContainer?.query?.on?.('change', queryListener);

    // Add Bases lifecycle shims
    (component as any).load = component.onload;
    (component as any).unload = () => {
      basesContainer?.query?.off?.('change', queryListener);
      component.onunload();
    };

    // Initial render
    void render();

    return component as any;
  };
}