/**
 * Bases View Factory for TaskNotes Integration
 * 
 * This module provides a factory function that creates TaskNotes views within the Bases plugin.
 * It handles formula computation, data transformation, and rendering of TaskNotes items in Bases views.
 */
import TaskNotesPlugin from '../main';
import { BasesDataItem, identifyTaskNotesFromBasesData, getBasesVisibleProperties } from './helpers';
import { TaskInfo } from '../types';
import { createTaskCard, updateTaskCard } from '../ui/TaskCard';

export interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void };
  viewContainerEl?: HTMLElement;
  controller?: { results?: Map<any, any>; runQuery?: () => Promise<any>; [key: string]: any };
}

export interface ViewConfig {
  errorPrefix: string;
}

export function buildTasknotesBaseViewFactory(plugin: TaskNotesPlugin, config: ViewConfig) {
  return function tasknotesBaseViewFactory(basesContainer: BasesContainerLike) {
    let currentRoot: HTMLElement | null = null;
    let currentRenderCancellation: { cancelled: boolean } | null = null;

    const viewContainerEl = (basesContainer as any)?.viewContainerEl as HTMLElement | undefined;
    if (!viewContainerEl) {
      console.error('[TaskNotes][Bases] No viewContainerEl found');
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
      
      if (currentRenderCancellation) {
        currentRenderCancellation.cancelled = true;
      }
      
      const renderCancellation = { cancelled: false };
      currentRenderCancellation = renderCancellation;
      
      const startTime = performance.now();
      
      try {
        const dataItems = extractDataItems();
        
        // --- Formula Computation (leaving as is) ---
        const ctxFormulas = (basesContainer as any)?.ctx?.formulas;
        if (ctxFormulas && dataItems.length > 0) {
            const formulaBatchSize = 25;
            for (let i = 0; i < dataItems.length; i += formulaBatchSize) {
                if (renderCancellation.cancelled) return;
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
                                if (baseData.frontmatter && Object.keys(taskProperties).length > 0) {
                                    const originalFrontmatter = baseData.frontmatter;
                                    baseData.frontmatter = { ...originalFrontmatter, ...taskProperties };
                                    result = formula.getValue(baseData);
                                    baseData.frontmatter = originalFrontmatter;
                                } else {
                                    result = formula.getValue(baseData);
                                }
                                if (result !== undefined) {
                                    itemFormulaResults.cachedFormulaOutputs[formulaName] = result;
                                }
                            } catch (e) { /* Formula errors are expected */ }
                        }
                    }
                }
                if (i + formulaBatchSize < dataItems.length) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
        }

        const taskNotes = await identifyTaskNotesFromBasesData(dataItems, plugin, undefined, renderCancellation);
        
        if (renderCancellation.cancelled) return;

        if (taskNotes.length === 0) {
            itemsContainer.innerHTML = '';
            const emptyEl = document.createElement('div');
            emptyEl.className = 'tn-bases-empty';
            emptyEl.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted);';
            emptyEl.textContent = 'No TaskNotes tasks found for this Base.';
            itemsContainer.appendChild(emptyEl);
            return;
        }

        // --- Start of new rendering logic ---

        // 1. Get card options and visible properties
        let visibleProperties: string[] | undefined;
        const cardOptions = {
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
                    const internalFieldName = plugin.fieldMapper?.fromUserField(propId);
                    if (internalFieldName) mappedId = internalFieldName;
                    else if (propId.startsWith('task.')) mappedId = propId.substring(5);
                    else if (propId.startsWith('note.')) {
                        const stripped = propId.substring(5);
                        const strippedInternalFieldName = plugin.fieldMapper?.fromUserField(stripped);
                        if (strippedInternalFieldName) mappedId = strippedInternalFieldName;
                        else if (stripped === 'dateCreated') mappedId = 'dateCreated';
                        else if (stripped === 'dateModified') mappedId = 'dateModified';
                        else if (stripped === 'completedDate') mappedId = 'completedDate';
                        else mappedId = stripped;
                    }
                    else if (propId === 'file.ctime') mappedId = 'dateCreated';
                    else if (propId === 'file.mtime') mappedId = 'dateModified';
                    else if (propId === 'file.name') mappedId = 'title';
                    else if (propId.startsWith('formula.')) mappedId = propId;
                    return mappedId;
                });
            }
        }

        if (!visibleProperties || visibleProperties.length === 0) {
            visibleProperties = plugin.settings.defaultVisibleProperties || ['due', 'scheduled', 'projects', 'contexts', 'tags'];
        }

        // 2. Apply sorting
        const pathToProps = new Map<string, Record<string, any>>(
            dataItems.filter(i => !!i.path).map(i => [i.path || '', (i as any).properties || (i as any).frontmatter || {}])
        );
        const { getBasesSortComparator } = await import('./sorting');
        const sortComparator = getBasesSortComparator(basesContainer, pathToProps);
        if (sortComparator) {
            taskNotes.sort(sortComparator);
        }

        // 3. Use the shared DOMReconciler
        plugin.domReconciler.updateList<TaskInfo>(
            itemsContainer,
            taskNotes,
            (task) => task.path, // getKey
            (task) => createTaskCard(task, plugin, visibleProperties, cardOptions), // renderItem
            (element, task) => updateTaskCard(element, task, plugin, visibleProperties, cardOptions) // updateItem
        );
        
        const elapsed = performance.now() - startTime;
        if (dataItems.length > 100 || elapsed > 1000) {
          console.log(`[TaskNotes][Bases] Rendered ${taskNotes.length} tasks in ${elapsed.toFixed(0)}ms`);
        }
        
      } catch (error: any) {
        console.error(`[TaskNotes][Bases] Error rendering Bases ${config.errorPrefix}:`, error);
        const errorEl = document.createElement('div');
        errorEl.className = 'tn-bases-error';
        errorEl.style.cssText = 'padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;';
        errorEl.textContent = `Error loading ${config.errorPrefix} tasks: ${error.message || 'Unknown error'}`;
        itemsContainer.appendChild(errorEl);
      }
    };

    void render();

    let queryListener: (() => void) | null = null;
    
    const viewObject = {
      refresh: render,
      onResize: () => {},
      onDataUpdated: () => { void render(); },
      getEphemeralState: () => ({ scrollTop: currentRoot?.scrollTop || 0 }),
      setEphemeralState: (state: any) => {
        if (state?.scrollTop && currentRoot) {
          currentRoot.scrollTop = state.scrollTop;
        }
      },
      destroy: () => {
        if (queryListener && (basesContainer as any)?.query?.off) {
          try { (basesContainer as any).query.off('change', queryListener); } catch (e) {}
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
          try { (basesContainer as any).query.on('change', queryListener); } catch (e) {}
        }
        const controller = (basesContainer as any)?.controller;
        if (controller?.runQuery) {
          controller.runQuery().then(() => { void render(); }).catch((e: any) => {
            console.warn('[TaskNotes][Bases] Initial formula computation failed:', e);
          });
        }
      },
      unload: () => {
        if (queryListener && (basesContainer as any)?.query?.off) {
          try { (basesContainer as any).query.off('change', queryListener); } catch (e) {}
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
