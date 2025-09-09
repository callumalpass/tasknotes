/**
 * Bases View Factory for TaskNotes Integration
 * 
 * This module provides a factory function that creates TaskNotes views within the Bases plugin.
 * It handles formula computation, data transformation, and rendering of TaskNotes items in Bases views.
 * 
 * Key features:
 * - Formula computation with access to TaskNote properties
 * - Proper handling of missing/empty formula values
 * - Integration with Bases' view lifecycle management
 */
import TaskNotesPlugin from '../main';
import { BasesDataItem, identifyTaskNotesFromBasesData, renderTaskNotesInBasesView } from './helpers';
import { TaskInfo } from '../types';
import { updateTaskCard } from '../ui/TaskCard';

export interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void };
  viewContainerEl?: HTMLElement;
  controller?: { results?: Map<any, any>; runQuery?: () => Promise<any>; [key: string]: any };
}

export interface ViewConfig {
  errorPrefix: string;
}

/**
 * Simple task change detection
 */
function hasTaskChanged(oldTask: TaskInfo, newTask: TaskInfo): boolean {
  return (
    oldTask.title !== newTask.title ||
    oldTask.status !== newTask.status ||
    oldTask.priority !== newTask.priority ||
    oldTask.due !== newTask.due ||
    oldTask.scheduled !== newTask.scheduled ||
    oldTask.dateModified !== newTask.dateModified ||
    JSON.stringify(oldTask.projects) !== JSON.stringify(newTask.projects) ||
    JSON.stringify(oldTask.contexts) !== JSON.stringify(newTask.contexts) ||
    JSON.stringify(oldTask.tags) !== JSON.stringify(newTask.tags)
  );
}

/**
 * Simplified DOM reconciliation with targeted updates
 */
async function reconcileTaskList(
  container: HTMLElement,
  newTasks: TaskInfo[],
  plugin: TaskNotesPlugin,
  basesContainer: any,
  lastRenderedTasks: Map<string, TaskInfo>,
  progressiveState: any
): Promise<void> {
  // Handle empty state
  if (newTasks.length === 0) {
    container.innerHTML = '';
    const emptyEl = document.createElement('div');
    emptyEl.className = 'tn-bases-empty';
    emptyEl.style.cssText = 'padding: 20px; text-align: center; color: #666;';
    emptyEl.textContent = 'No TaskNotes tasks found for this Base.';
    container.appendChild(emptyEl);
    lastRenderedTasks.clear();
    return;
  }

  // Remove empty state if present
  const emptyEl = container.querySelector('.tn-bases-empty');
  if (emptyEl) {
    emptyEl.remove();
  }

  // Apply sorting 
  const dataItems = Array.from((basesContainer as any)?.results?.values() || [])
    .map((value: any) => ({
      key: value?.file?.path || value?.path,
      data: value,
      file: value?.file,
      path: value?.file?.path || value?.path,
      properties: value?.properties || value?.frontmatter,
      basesData: value
    }));

  const pathToProps = new Map<string, Record<string, any>>(
    dataItems.filter(i => !!i.path).map(i => [i.path || '', (i as any).properties || (i as any).frontmatter || {}])
  );

  const { getBasesSortComparator } = await import('./sorting');
  const sortComparator = getBasesSortComparator(basesContainer, pathToProps);
  if (sortComparator) {
    newTasks.sort(sortComparator);
  }

  // Check if this is the first render
  if (lastRenderedTasks.size === 0) {
    // First render - use async batch rendering
    await renderTaskNotesInBasesView(container, newTasks, plugin, basesContainer);
    return;
  }

  // Use targeted DOM reconciliation for updates
  await reconcileTaskCards(container, newTasks, plugin, basesContainer, lastRenderedTasks);
}

/**
 * Perform targeted DOM updates without full re-render
 */
async function reconcileTaskCards(
  container: HTMLElement,
  newTasks: TaskInfo[],
  plugin: TaskNotesPlugin,
  basesContainer: any,
  lastRenderedTasks: Map<string, TaskInfo>
): Promise<void> {
  const { createTaskCard } = await import('../ui/TaskCard');
  
  // Find the task list container
  let taskListContainer = container.querySelector('.tn-bases-tasknotes-list') as HTMLElement;
  if (!taskListContainer) {
    // If no task list exists, create one and render all tasks
    await renderTaskNotesInBasesView(container, newTasks, plugin, basesContainer);
    return;
  }

  // Get current task elements
  const currentTaskElements = new Map<string, HTMLElement>();
  const taskCards = taskListContainer.querySelectorAll('.task-card[data-task-path]');
  taskCards.forEach(card => {
    const path = (card as HTMLElement).dataset.taskPath;
    if (path) {
      currentTaskElements.set(path, card as HTMLElement);
    }
  });

  // Build maps for efficient lookups
  const newTasksMap = new Map<string, TaskInfo>();
  newTasks.forEach(task => newTasksMap.set(task.path, task));

  // 1. Remove tasks that no longer exist
  for (const [path, element] of currentTaskElements) {
    if (!newTasksMap.has(path)) {
      element.remove();
    }
  }

  // 2. Update existing tasks that have changed
  for (const [path, newTask] of newTasksMap) {
    const existingElement = currentTaskElements.get(path);
    const lastRenderedTask = lastRenderedTasks.get(path);
    
    if (existingElement && lastRenderedTask) {
      // Check if task has actually changed
      if (hasTaskChanged(lastRenderedTask, newTask)) {
        try {
          updateTaskCard(existingElement, newTask, plugin);
        } catch (error) {
          console.warn('[TaskNotes][Reconcile] Error updating task card:', error);
          // Fallback: recreate the card
          try {
            const newCard = createTaskCard(newTask, plugin);
            existingElement.replaceWith(newCard);
          } catch (createError) {
            console.error('[TaskNotes][Reconcile] Error creating replacement card:', createError);
          }
        }
      }
    }
  }

  // 3. Add new tasks using async batch rendering
  const existingTaskPaths = new Set(currentTaskElements.keys());
  const tasksToAdd = newTasks.filter(task => !existingTaskPaths.has(task.path));
  
  if (tasksToAdd.length > 0) {
    await addNewTasksAsync(taskListContainer, tasksToAdd, plugin, basesContainer);
  }

  // 4. Handle reordering if needed (simple approach: if order changed significantly, re-render)
  const currentOrder = Array.from(currentTaskElements.keys());
  const newOrder = newTasks.map(t => t.path);
  const orderChanged = currentOrder.length === newOrder.length && 
    currentOrder.some((path, index) => path !== newOrder[index]);

  if (orderChanged && tasksToAdd.length === 0) {
    // Only reorder if no new tasks were added (to avoid double rendering)
    reorderTaskCards(taskListContainer, newTasks, currentTaskElements);
  }
}

/**
 * Add new tasks using async batch rendering
 */
async function addNewTasksAsync(
  container: HTMLElement,
  tasksToAdd: TaskInfo[],
  plugin: TaskNotesPlugin,
  basesContainer: any
): Promise<void> {
  const { createTaskCard } = await import('../ui/TaskCard');
  const { getBasesVisibleProperties } = await import('./helpers');

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
        
        // Apply field mappings (same logic as in helpers.ts)
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

  // Render new tasks in batches
  const batchSize = 25;
  for (let i = 0; i < tasksToAdd.length; i += batchSize) {
    const batch = tasksToAdd.slice(i, i + batchSize);
    const fragment = document.createDocumentFragment();
    
    for (const taskInfo of batch) {
      try {
        const taskCard = createTaskCard(taskInfo, plugin, visibleProperties, cardOptions);
        fragment.appendChild(taskCard);
      } catch (error) {
        console.warn('[TaskNotes][AddNew] Error creating task card:', error);
      }
    }
    
    // Add the entire batch at once
    container.appendChild(fragment);
    
    // Yield control using requestAnimationFrame for smooth rendering
    if (i + batchSize < tasksToAdd.length) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }
}

/**
 * Reorder existing task cards to match new order
 */
function reorderTaskCards(
  container: HTMLElement,
  newTasks: TaskInfo[],
  currentTaskElements: Map<string, HTMLElement>
): void {
  const fragment = document.createDocumentFragment();
  
  // Add elements in the new order
  for (const task of newTasks) {
    const element = currentTaskElements.get(task.path);
    if (element) {
      fragment.appendChild(element);
    }
  }
  
  // Replace container contents with reordered elements
  container.appendChild(fragment);
}




export function buildTasknotesBaseViewFactory(plugin: TaskNotesPlugin, config: ViewConfig) {
  return function tasknotesBaseViewFactory(basesContainer: BasesContainerLike) {
    let currentRoot: HTMLElement | null = null;
    let lastRenderedTasks: Map<string, TaskInfo> = new Map(); // Track rendered tasks by path

    const viewContainerEl = (basesContainer as any)?.viewContainerEl as HTMLElement | undefined;
    if (!viewContainerEl) {
      console.error('[TaskNotes][BasesPOC] No viewContainerEl found');
      return { destroy: () => {} } as any;
    }

    viewContainerEl.innerHTML = '';

    // Root container for TaskNotes view
    const root = document.createElement('div');
    root.className = 'tn-bases-integration tasknotes-plugin tasknotes-container';
    viewContainerEl.appendChild(root);
    currentRoot = root;


    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'tn-bases-items-container';
    itemsContainer.style.cssText = 'margin-top: 12px;';
    root.appendChild(itemsContainer);

    // Helper to extract items from Bases results
    const extractDataItems = (): BasesDataItem[] => {
      const dataItems: BasesDataItem[] = [];
      const results = (basesContainer as any)?.results as Map<any, any> | undefined;
      
      if (results && results instanceof Map) {
        for (const [key, value] of results.entries()) {
          const item = {
            key,
            data: value,
            file: (value as any)?.file,
            path: (value as any)?.file?.path || (value as any)?.path,
            properties: (value as any)?.properties || (value as any)?.frontmatter,
            basesData: value
          };
          
          dataItems.push(item);
        }
      }
      
      return dataItems;
    };

    const render = async () => {
      if (!currentRoot) return;
      const startTime = performance.now();
      
      try {
        // Show loading indicator for large datasets
        const dataItems = extractDataItems();
        const isLargeDataset = dataItems.length > 100;
        
        let loadingIndicator: HTMLElement | null = null;
        if (isLargeDataset) {
          loadingIndicator = itemsContainer.createEl('div', {
            cls: 'tn-bases-loading',
            text: `Loading ${dataItems.length} tasks...`
          });
          loadingIndicator.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted);';
        }
        
        // Performance monitoring for large datasets
        if (dataItems.length > 500) {
          console.log(`[TaskNotes][Bases] Rendering ${dataItems.length} tasks - this may take a moment`);
        }
        
        // Compute Bases formulas for TaskNotes items with batch processing
        // This ensures formulas have access to TaskNote-specific properties
        const ctxFormulas = (basesContainer as any)?.ctx?.formulas;
        if (ctxFormulas && dataItems.length > 0) {
          const formulaBatchSize = 25;
          for (let i = 0; i < dataItems.length; i += formulaBatchSize) {
            const batch = dataItems.slice(i, i + formulaBatchSize);
            
            for (const item of batch) {
              const itemFormulaResults = item.basesData?.formulaResults;
              if (!itemFormulaResults?.cachedFormulaOutputs) continue;
              
              for (const formulaName of Object.keys(ctxFormulas)) {
                const formula = ctxFormulas[formulaName];
                if (formula && typeof formula.getValue === 'function') {
                  try {
                    const baseData = item.basesData;
                    const taskProperties = item.properties || {};
                    
                    let result;
                    
                    // Temporarily merge TaskNote properties into frontmatter for formula access
                    // This preserves Bases' internal object structure while providing item-specific data
                    if (baseData.frontmatter && Object.keys(taskProperties).length > 0) {
                      const originalFrontmatter = baseData.frontmatter;
                      baseData.frontmatter = { ...originalFrontmatter, ...taskProperties };
                      result = formula.getValue(baseData);
                      baseData.frontmatter = originalFrontmatter; // Restore original state
                    } else {
                      result = formula.getValue(baseData);
                    }
                    
                    // Store computed result for TaskCard rendering
                    if (result !== undefined) {
                      itemFormulaResults.cachedFormulaOutputs[formulaName] = result;
                    }
                  } catch (e) {
                    // Formulas may fail for various reasons (missing data, syntax errors, etc.)
                    // This is expected behavior and doesn't require action
                  }
                }
              }
            }
            
            // Yield control between batches to prevent UI freezing using requestAnimationFrame
            if (i + formulaBatchSize < dataItems.length) {
              await new Promise(resolve => requestAnimationFrame(resolve));
            }
          }
        }
        
        
        const taskNotes = await identifyTaskNotesFromBasesData(dataItems, plugin);
        

        // Remove loading indicator
        if (loadingIndicator) {
          loadingIndicator.remove();
        }
        
        // Use DOM reconciliation for efficient updates
        await reconcileTaskList(itemsContainer, taskNotes, plugin, basesContainer, lastRenderedTasks, null);
        
        // Update cache
        lastRenderedTasks.clear();
        taskNotes.forEach(task => lastRenderedTasks.set(task.path, task));
        
        // Performance logging for monitoring
        const elapsed = performance.now() - startTime;
        if (dataItems.length > 100 || elapsed > 1000) {
          console.log(`[TaskNotes][Bases] Rendered ${taskNotes.length} tasks in ${elapsed.toFixed(0)}ms`);
        }
        
      } catch (error: any) {
        console.error(`[TaskNotes][BasesPOC] Error rendering Bases ${config.errorPrefix}:`, error);
        const errorEl = document.createElement('div');
        errorEl.className = 'tn-bases-error';
        errorEl.style.cssText = 'padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;';
        errorEl.textContent = `Error loading ${config.errorPrefix} tasks: ${error.message || 'Unknown error'}`;
        itemsContainer.appendChild(errorEl);
      }
    };

    // Kick off initial async render
    void render();

    // Create view object with proper listener management
    let queryListener: (() => void) | null = null;
    
    const viewObject = {
      refresh: render,
      onResize: () => {
        // Handle resize - no-op for now
      },
      onDataUpdated: () => {
        void render();
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
        if (queryListener && (basesContainer as any)?.query?.off) {
          try {
            (basesContainer as any).query.off('change', queryListener);
          } catch (e) {
            // Query listener removal may fail if already disposed
          }
        }
        if (currentRoot) {
          currentRoot.remove();
          currentRoot = null;
        }
        queryListener = null;
      },
      load: () => {
        if ((basesContainer as any)?.query?.on && !queryListener) {
          queryListener = () => void render();
          try {
            (basesContainer as any).query.on('change', queryListener);
          } catch (e) {
            // Query listener registration may fail for various reasons
          }
        }
        
        // Trigger initial formula computation on load
        const controller = (basesContainer as any)?.controller;
        if (controller?.runQuery) {
          controller.runQuery().then(() => {
            void render(); // Re-render with computed formulas
          }).catch((e: any) => {
            console.warn('[TaskNotes][Bases] Initial formula computation failed:', e);
          });
        }
      },
      unload: () => {
        if (queryListener && (basesContainer as any)?.query?.off) {
          try {
            (basesContainer as any).query.off('change', queryListener);
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

    return viewObject;
  };
}