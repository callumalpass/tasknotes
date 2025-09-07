import TaskNotesPlugin from '../main';
import { BasesDataItem, identifyTaskNotesFromBasesData } from './helpers';
import { TaskInfo } from '../types';
import { getBasesGroupByConfig, BasesGroupByConfig } from './group-by';
import { getGroupNameComparator } from './group-ordering';
import { getBasesSortComparator } from './sorting';
import { createTaskCard } from '../ui/TaskCard';
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

        // Build path -> props map for dynamic property access
        const pathToProps = new Map<string, Record<string, any>>(
          dataItems.filter(i => !!i.path).map(i => [i.path || '', i.properties || {}])
        );

        // Get advanced groupBy configuration
        const groupByConfig = getBasesGroupByConfig(basesContainer, pathToProps);
        
        // Group tasks using the advanced system
        const groups = new Map<string, TaskInfo[]>();
        
        if (groupByConfig) {
          // Use dynamic groupBy from Bases configuration
          for (const task of taskNotes) {
            const groupValues = groupByConfig.getGroupValues(task.path);
            
            // Tasks can belong to multiple groups (e.g., multiple tags)
            for (const groupValue of groupValues) {
              if (!groups.has(groupValue)) {
                groups.set(groupValue, []);
              }
              groups.get(groupValue)!.push(task);
            }
          }
        } else {
          // Fallback to status grouping when no groupBy is configured
          for (const task of taskNotes) {
            const groupValue = task.status || 'open';
            if (!groups.has(groupValue)) {
              groups.set(groupValue, []);
            }
            groups.get(groupValue)!.push(task);
          }
          
          // Add empty status columns
          plugin.statusManager.getAllStatuses().forEach(status => {
            if (!groups.has(status.value)) {
              groups.set(status.value, []);
            }
          });
        }

        // Get sorting configuration for group names
        const sortComparator = getBasesSortComparator(basesContainer, pathToProps);
        const firstSortEntry = sortComparator ? { id: groupByConfig?.normalizedId || 'status', direction: 'ASC' as const } : null;
        const groupNameComparator = getGroupNameComparator(firstSortEntry);

        // Create columns with proper ordering
        const columnIds = Array.from(groups.keys()).sort(groupNameComparator);
        
        for (const columnId of columnIds) {
          const tasks = groups.get(columnId) || [];
          const columnEl = createColumnElement(columnId, tasks, groupByConfig);
          board.appendChild(columnEl);
        }

      } catch (error) {
        console.error('[TaskNotes][Bases] Error rendering Kanban:', error);
      }
    };

    // Reuse existing kanban column creation logic
    const createColumnElement = (columnId: string, tasks: TaskInfo[], groupByConfig: BasesGroupByConfig | null): HTMLElement => {
      const columnEl = document.createElement('div');
      columnEl.className = 'kanban-view__column';
      columnEl.dataset.columnId = columnId;

      // Column header
      const headerEl = columnEl.createDiv({ cls: 'kanban-view__column-header' });
      
      // Title - format based on property type and use TaskNotes display values
      let title: string;
      
      if (groupByConfig) {
        const propertyId = groupByConfig.normalizedId.toLowerCase();
        
        // Map Bases property IDs to TaskNotes native properties and use display values
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
          // Handle tags properties
          title = columnId === 'none' ? 'Untagged' : `#${columnId}`;
        } else {
          // For custom properties, show the value directly (not prefixed)
          title = columnId === 'none' ? 'None' : columnId;
        }
      } else {
        // Fallback for status grouping
        const statusConfig = plugin.statusManager.getStatusConfig(columnId);
        title = statusConfig?.label || columnId;
      }
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

      // Add drop handlers - enhanced for dynamic groupBy
      addColumnDropHandlers(columnEl, async (taskPath: string, targetColumnId: string) => {
        try {
          const task = await plugin.cacheManager.getCachedTaskInfo(taskPath);
          if (task && groupByConfig) {
            // Map Bases property IDs to TaskNotes native properties for updates
            const originalPropertyId = groupByConfig.normalizedId;
            const propertyId = originalPropertyId.toLowerCase();
            
            // Handle different property types
            let valueToSet: any;
            if (targetColumnId === 'none' || targetColumnId === 'uncategorized') {
              valueToSet = null; // Clear the property
            } else {
              // For most properties, set the single value
              // For array properties, determine if we should use array or single value
              valueToSet = targetColumnId;
            }
            
            // For native TaskNotes properties, use TaskNotes update methods directly
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
              // For custom properties, update frontmatter directly
              try {
                const file = plugin.app.vault.getAbstractFileByPath(task.path);
                if (file && 'stat' in file) { // Check if it's a TFile
                  await plugin.app.fileManager.processFrontMatter(file as any, (frontmatter: any) => {
                    // Extract the actual property name from Bases property ID
                    // e.g., "note.note.projects" -> "projects"
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
            
            // Refresh the view
            await render();
          } else if (task && !groupByConfig) {
            // Fallback to status update when no groupBy config
            await plugin.updateTaskProperty(task, 'status', targetColumnId, { silent: true });
            await render();
          }
        } catch (e) {
          console.error('[TaskNotes][Bases] Move failed:', e);
        }
      });

      return columnEl;
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

