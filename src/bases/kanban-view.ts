import TaskNotesPlugin from '../main';
import { BasesDataItem, identifyTaskNotesFromBasesData } from './helpers';
import { TaskInfo } from '../types';
import { getBasesGroupByConfig, BasesGroupByConfig } from './group-by';
import { getGroupNameComparator } from './group-ordering';
import { getBasesSortComparator } from './sorting';
import { createTaskCard, updateTaskCard } from '../ui/TaskCard';
// Removed unused imports - using local BasesContainerLike interface for compatibility

// Use the same interface as base-view-factory for compatibility
interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { 
    on?: (event: string, cb: () => void) => void; 
    off?: (event: string, cb: () => void) => void;
    getViewConfig?: (key: string) => any;
  };
  viewContainerEl?: HTMLElement;
  controller?: {
    runQuery?: () => Promise<void>;
    getViewConfig?: () => any;
  };
}

export function buildTasknotesKanbanViewFactory(plugin: TaskNotesPlugin) {
  return function tasknotesKanbanViewFactory(basesContainer: BasesContainerLike) {
    let currentRoot: HTMLElement | null = null;

    // Validate the container has the required properties
    if (!basesContainer || !basesContainer.viewContainerEl) {
      console.error('[TaskNotes][Bases] Invalid Bases container provided');
      return { 
        destroy: () => {},
        load: () => {},
        unload: () => {},
        refresh: () => {},
        onDataUpdated: () => {},
        onResize: () => {},
        getEphemeralState: () => ({ scrollTop: 0 }),
        setEphemeralState: () => {}
      };
    }

    const viewContainerEl = basesContainer.viewContainerEl;
    if (!viewContainerEl) {
      console.error('[TaskNotes][Bases] No viewContainerEl found');
      return { 
        destroy: () => {},
        load: () => {},
        unload: () => {},
        refresh: () => {},
        onDataUpdated: () => {},
        onResize: () => {},
        getEphemeralState: () => ({ scrollTop: 0 }),
        setEphemeralState: () => {}
      };
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
      const results = basesContainer.results;
      if (results && results instanceof Map) {
        for (const [, value] of results.entries()) {
          dataItems.push({
            key: value?.file?.path || value?.path,
            data: value,
            file: value?.file,
            path: value?.file?.path || value?.path,
            properties: value?.properties || value?.frontmatter
          });
        }
      }
      return dataItems;
    };

    const render = async () => {
      if (!currentRoot) return;

      const createColumnElement = (columnId: string, tasks: TaskInfo[], groupByConfig: BasesGroupByConfig | null): HTMLElement => {
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-view__column';
        columnEl.dataset.columnId = columnId;
  
        const headerEl = columnEl.createDiv({ cls: 'kanban-view__column-header' });
        
        let title: string;
        if (groupByConfig) {
          const propertyId = groupByConfig.normalizedId.toLowerCase();
          if (propertyId === 'status' || propertyId === 'note.status') {
            const statusConfig = plugin.statusManager.getStatusConfig(columnId);
            title = statusConfig?.label || columnId;
          } else if (propertyId === 'priority' || propertyId === 'note.priority') {
            const priorityConfig = plugin.priorityManager.getPriorityConfig(columnId);
            title = priorityConfig?.label || columnId;
          } else if (propertyId === 'projects' || propertyId === 'project' || propertyId === 'note.projects' || propertyId === 'note.project') {
            title = columnId === 'none' ? 'No Project' : columnId;
          } else if (propertyId === 'contexts' || propertyId === 'context' || propertyId === 'note.contexts' || propertyId === 'note.context') {
            title = columnId === 'none' ? 'Uncategorized' : `@${columnId}`;
          } else if (propertyId.includes('tag')) {
            title = columnId === 'none' ? 'Untagged' : `#${columnId}`;
          } else {
            title = columnId === 'none' ? 'None' : columnId;
          }
        } else {
          const statusConfig = plugin.statusManager.getStatusConfig(columnId);
          title = statusConfig?.label || columnId;
        }
        headerEl.createEl('div', { cls: 'kanban-view__column-title', text: title });
        headerEl.createEl('div', { 
          text: `${tasks.length} tasks`, 
          cls: 'kanban-view__column-count' 
        });
  
        const bodyEl = columnEl.createDiv({ cls: 'kanban-view__column-body' });
        bodyEl.createDiv({ cls: 'kanban-view__tasks-container' });
  
        addColumnDropHandlers(columnEl, async (taskPath: string, targetColumnId: string) => {
          try {
            const task = await plugin.cacheManager.getCachedTaskInfo(taskPath);
            if (task && groupByConfig) {
              const originalPropertyId = groupByConfig.normalizedId;
              const propertyId = originalPropertyId.toLowerCase();
              let valueToSet: any = targetColumnId;
              if (targetColumnId === 'none' || targetColumnId === 'uncategorized') {
                valueToSet = null;
              }
  
              if (propertyId === 'status' || propertyId === 'note.status') {
                await plugin.updateTaskProperty(task, 'status', valueToSet, { silent: true });
              } else if (propertyId === 'priority' || propertyId === 'note.priority') {
                await plugin.updateTaskProperty(task, 'priority', valueToSet, { silent: true });
              } else if (propertyId === 'projects' || propertyId === 'project' || propertyId === 'note.projects' || propertyId === 'note.project') {
                const projectValue = valueToSet ? (Array.isArray(valueToSet) ? valueToSet : [valueToSet]) : [];
                await plugin.updateTaskProperty(task, 'projects', projectValue, { silent: true });
              } else if (propertyId === 'contexts' || propertyId === 'context' || propertyId === 'note.contexts' || propertyId === 'note.context') {
                const contextValue = valueToSet ? (Array.isArray(valueToSet) ? valueToSet : [valueToSet]) : [];
                await plugin.updateTaskProperty(task, 'contexts', contextValue, { silent: true });
              } else {
                try {
                  const file = plugin.app.vault.getAbstractFileByPath(task.path);
                  if (file && 'stat' in file) {
                    await plugin.app.fileManager.processFrontMatter(file as any, (frontmatter: any) => {
                      const propertyName = originalPropertyId.includes('.') 
                        ? originalPropertyId.split('.').pop()! 
                        : originalPropertyId;
                      frontmatter[propertyName] = valueToSet;
                    });
                  }
                } catch (frontmatterError) {
                  console.warn('[TaskNotes][Bases] Frontmatter update failed for custom property:', frontmatterError);
                }
              }
              await render();
            } else if (task && !groupByConfig) {
              await plugin.updateTaskProperty(task, 'status', targetColumnId, { silent: true });
              await render();
            }
          } catch (e) {
            console.error('[TaskNotes][Bases] Move failed:', e);
          }
        });
  
        return columnEl;
      };
      
      try {
        const dataItems = extractDataItems();
        const taskNotes = await identifyTaskNotesFromBasesData(dataItems, plugin);

        if (taskNotes.length === 0) {
          board.innerHTML = '';
          const empty = document.createElement('div');
          empty.className = 'tn-bases-empty';
          empty.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted);';
          empty.textContent = 'No TaskNotes tasks found for this Base.';
          board.appendChild(empty);
          return;
        }

        const pathToProps = new Map<string, Record<string, any>>(
          dataItems.filter(i => !!i.path).map(i => [i.path || '', i.properties || {}])
        );

        const groupByConfig = getBasesGroupByConfig(basesContainer, pathToProps);
        const groups = new Map<string, TaskInfo[]>();
        
        if (groupByConfig) {
          for (const task of taskNotes) {
            const groupValues = groupByConfig.getGroupValues(task.path);
            for (const groupValue of groupValues) {
              if (!groups.has(groupValue)) {
                groups.set(groupValue, []);
              }
              groups.get(groupValue)!.push(task);
            }
          }
        } else {
          for (const task of taskNotes) {
            const groupValue = task.status || 'open';
            if (!groups.has(groupValue)) {
              groups.set(groupValue, []);
            }
            groups.get(groupValue)!.push(task);
          }
          plugin.statusManager.getAllStatuses().forEach(status => {
            if (!groups.has(status.value)) {
              groups.set(status.value, []);
            }
          });
        }

        const sortComparator = getBasesSortComparator(basesContainer, pathToProps);
        const firstSortEntry = sortComparator ? { id: groupByConfig?.normalizedId || 'status', direction: 'ASC' as const } : null;
        const groupNameComparator = getGroupNameComparator(firstSortEntry);
        const columnIds = Array.from(groups.keys()).sort(groupNameComparator);

        plugin.domReconciler.updateList<string>(
            board,
            columnIds,
            (columnId) => columnId,
            (columnId) => {
                const tasks = groups.get(columnId) || [];
                const columnEl = createColumnElement(columnId, tasks, groupByConfig);
                const tasksContainer = columnEl.querySelector('.kanban-view__tasks-container') as HTMLElement;
                if (tasksContainer) {
                    const visibleProperties = plugin.settings.defaultVisibleProperties;
                    const cardOptions = { showDueDate: true, showCheckbox: false, showTimeTracking: true };
                    plugin.domReconciler.updateList<TaskInfo>(
                        tasksContainer,
                        tasks,
                        (task) => task.path,
                        (task) => {
                            const taskCard = createTaskCard(task, plugin, visibleProperties, cardOptions);
                            taskCard.draggable = true;
                            taskCard.addEventListener('dragstart', (e: DragEvent) => {
                                if (e.dataTransfer) {
                                    e.dataTransfer.setData('text/plain', task.path);
                                    e.dataTransfer.effectAllowed = 'move';
                                }
                            });
                            return taskCard;
                        },
                        (element, task) => {
                            updateTaskCard(element, task, plugin, visibleProperties, cardOptions);
                        }
                    );
                }
                return columnEl;
            },
            (columnEl, columnId) => {
                const tasks = groups.get(columnId) || [];
                const tasksContainer = columnEl.querySelector('.kanban-view__tasks-container') as HTMLElement;
                if (tasksContainer) {
                    const visibleProperties = plugin.settings.defaultVisibleProperties;
                    const cardOptions = { showDueDate: true, showCheckbox: false, showTimeTracking: true };
                    plugin.domReconciler.updateList<TaskInfo>(
                        tasksContainer,
                        tasks,
                        (task) => task.path,
                        (task) => {
                            const taskCard = createTaskCard(task, plugin, visibleProperties, cardOptions);
                            taskCard.draggable = true;
                            taskCard.addEventListener('dragstart', (e: DragEvent) => {
                                if (e.dataTransfer) {
                                    e.dataTransfer.setData('text/plain', task.path);
                                    e.dataTransfer.effectAllowed = 'move';
                                }
                            });
                            return taskCard;
                        },
                        (element, task) => {
                            updateTaskCard(element, task, plugin, visibleProperties, cardOptions);
                        }
                    );
                }
                const countEl = columnEl.querySelector('.kanban-view__column-count') as HTMLElement;
                if(countEl) {
                    countEl.textContent = `${tasks.length} tasks`;
                }
            }
        );

      } catch (error) {
        console.error('[TaskNotes][Bases] Error rendering Kanban:', error);
      }
    };

    // Column title formatting now handled in createColumnElement with groupBy config

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

    // Kick off initial async render
    void render();

    // Set up lifecycle following the working pattern from base-view-factory
    let queryListener: (() => void) | null = null;

    const component = {
      load: () => {
        // Set up query listener
        if (basesContainer.query?.on && !queryListener) {
          queryListener = () => void render();
          try {
            basesContainer.query.on('change', queryListener);
          } catch (e) {
            // Query listener registration may fail for various reasons
            console.debug('[TaskNotes][Bases] Query listener registration failed:', e);
          }
        }
        
        // Trigger initial formula computation on load (like base-view-factory)
        const controller = basesContainer.controller;
        if (controller?.runQuery) {
          controller.runQuery().then(() => {
            void render(); // Re-render with computed formulas
          }).catch((e: any) => {
            console.warn('[TaskNotes][Bases] Initial kanban formula computation failed:', e);
            // Still render even if formulas fail
            void render();
          });
        } else {
          // No formula computation needed, just render
          void render();
        }
      },
      unload: () => {
        // Cleanup query listener
        if (queryListener && basesContainer.query?.off) {
          try {
            basesContainer.query.off('change', queryListener);
          } catch (e) {
            // Query listener removal may fail if already disposed
            console.debug('[TaskNotes][Bases] Query listener cleanup failed:', e);
          }
        }
        queryListener = null;
      },
      refresh: render,
      onDataUpdated: () => {
        void render();
      },
      onResize: () => {
        // Handle resize - no-op for now
      },
      getEphemeralState: () => {
        return { scrollTop: currentRoot?.scrollTop || 0 };
      },
      setEphemeralState: (state: any) => {
        if (state?.scrollTop && currentRoot) {
          currentRoot.scrollTop = state.scrollTop;
        }
      },
      destroy: () => {
        if (queryListener && basesContainer.query?.off) {
          try {
            basesContainer.query.off('change', queryListener);
          } catch (e) {
            // Query listener removal may fail if already disposed
          }
        }
        if (currentRoot) {
          currentRoot.remove();
          currentRoot = null;
        }
        queryListener = null;
      }
    };

    return component;
  };
}

