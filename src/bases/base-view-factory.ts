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
      try {
        const dataItems = extractDataItems();
        
        // Compute Bases formulas for TaskNotes items
        // This ensures formulas have access to TaskNote-specific properties
        const ctxFormulas = (basesContainer as any)?.ctx?.formulas;
        if (ctxFormulas && dataItems.length > 0) {
          for (let i = 0; i < dataItems.length; i++) {
            const item = dataItems[i];
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
        }
        
        
        const taskNotes = await identifyTaskNotesFromBasesData(dataItems, plugin);
        

        // Render body
        itemsContainer.innerHTML = '';
        if (taskNotes.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'tn-bases-empty';
          emptyEl.style.cssText = 'padding: 20px; text-align: center; color: #666;';
          emptyEl.textContent = 'No TaskNotes tasks found for this Base.';
          itemsContainer.appendChild(emptyEl);
        } else {
          // Build a map from task path to its properties/frontmatter
          const pathToProps = new Map<string, Record<string, any>>(
            dataItems.filter(i => !!i.path).map(i => [i.path || '', (i as any).properties || (i as any).frontmatter || {}])
          );


          // Apply Bases sorting if configured
          const { getBasesSortComparator } = await import('./sorting');
          const sortComparator = getBasesSortComparator(basesContainer, pathToProps);
          if (sortComparator) {
            taskNotes.sort(sortComparator);
          }

          // Render tasks using existing helper
          await renderTaskNotesInBasesView(itemsContainer, taskNotes, plugin, basesContainer);
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