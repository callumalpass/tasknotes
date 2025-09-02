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
    let hasTriggeredUpdate = false; // Prevent infinite loops

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
        console.debug('[TaskNotes][Bases] Extracting data items - Map size:', results.size);
        for (const [key, value] of results.entries()) {
          // Log what we're extracting for formula investigation
          const item = {
            key,
            data: value,
            file: (value as any)?.file,
            path: (value as any)?.file?.path || (value as any)?.path,
            properties: (value as any)?.properties || (value as any)?.frontmatter,
            basesData: value
          };
          
          // Debug first item's structure for formula investigation
          if (dataItems.length === 0) {
            console.debug('[TaskNotes][Bases] First item structure:', {
              hasKey: !!item.key,
              hasPath: !!item.path,
              hasProperties: !!item.properties,
              hasBasesData: !!item.basesData,
              baseDataKeys: item.basesData ? Object.keys(item.basesData).slice(0, 10) : [],
              valueType: typeof value,
              formulaResultsExists: !!(value as any)?.formulaResults
            });
          }
          
          dataItems.push(item);
        }
      }
      
      return dataItems;
    };

    const render = async () => {
      if (!currentRoot) return;
      try {
        // Trigger formula computation before extracting data
        const controller = (basesContainer as any)?.controller;
        // CRITICAL INVESTIGATION: Maybe controller is elsewhere in the structure
        const potentialController = (basesContainer as any)?.query?.controller || 
                                    (basesContainer as any)?.app?.controller ||
                                    (basesContainer as any)?.plugin?.controller ||
                                    (basesContainer as any)?.ctx?.controller;
        
        console.debug('[TaskNotes][Bases] Controller debug:', {
          hasController: !!controller,
          hasRunQuery: !!(controller?.runQuery),
          controllerMethods: controller ? Object.getOwnPropertyNames(controller).filter((name: string) => typeof controller[name] === 'function') : [],
          basesContainerKeys: Object.keys(basesContainer || {}),
          basesContainerMethods: Object.keys(basesContainer || {}).filter((key: string) => typeof (basesContainer as any)[key] === 'function'),
          potentialController: !!potentialController,
          queryKeys: (basesContainer as any)?.query ? Object.keys((basesContainer as any).query) : [],
          ctxKeys: (basesContainer as any)?.ctx ? Object.keys((basesContainer as any).ctx) : []
        });
        
        if (controller?.runQuery) {
          console.debug('[TaskNotes][Bases] Triggering formula computation...');
          await controller.runQuery();
          console.debug('[TaskNotes][Bases] Formula computation completed');
        } else {
          console.debug('[TaskNotes][Bases] No runQuery method available - checking alternatives');
          
          // Check if basesContainer itself has query methods
          if ((basesContainer as any)?.runQuery) {
            console.debug('[TaskNotes][Bases] Found runQuery on basesContainer itself');
            try {
              const result = (basesContainer as any).runQuery();
              console.debug('[TaskNotes][Bases] runQuery result type:', typeof result, result);
              
              // Handle both sync and async runQuery
              if (result && typeof result.then === 'function') {
                await result;
                console.debug('[TaskNotes][Bases] Async runQuery completed');
              } else {
                console.debug('[TaskNotes][Bases] Sync runQuery completed');
              }
            } catch (error) {
              console.debug('[TaskNotes][Bases] runQuery failed:', error);
            }
          } else {
            console.debug('[TaskNotes][Bases] No runQuery method found anywhere');
          }
          
          // Try alternative approaches to trigger formula computation
          console.debug('[TaskNotes][Bases] Exploring alternative trigger methods:');
          console.debug('  - query:', !!(basesContainer as any)?.query);
          console.debug('  - relevantProperties:', !!(basesContainer as any)?.relevantProperties);
          console.debug('  - queryState:', !!(basesContainer as any)?.queryState);
          
          // Try accessing query methods
          const query = (basesContainer as any)?.query;
          if (query) {
            console.debug('[TaskNotes][Bases] Query object methods:', Object.getOwnPropertyNames(query).filter((name: string) => typeof query[name] === 'function'));
            
            // Try common query methods
            if (typeof query.runQuery === 'function') {
              console.debug('[TaskNotes][Bases] Trying query.runQuery()');
              const result = query.runQuery();
              if (result && typeof result.then === 'function') {
                await result;
                console.debug('[TaskNotes][Bases] query.runQuery() completed (async)');
              } else {
                console.debug('[TaskNotes][Bases] query.runQuery() completed (sync)');
              }
            } else if (typeof query.update === 'function') {
              console.debug('[TaskNotes][Bases] Trying query.update()');
              query.update();
            } else if (typeof query.refresh === 'function') {
              console.debug('[TaskNotes][Bases] Trying query.refresh()');
              query.refresh();
            }
          }
          
          // Try requestNotifyView if available
          if (typeof (basesContainer as any).requestNotifyView === 'function') {
            console.debug('[TaskNotes][Bases] Trying requestNotifyView()');
            (basesContainer as any).requestNotifyView();
          }
          
          // Simplified: just log that we're trying to access plugin
          console.debug('[TaskNotes][Bases] Simplified approach - no formula computation attempts');
        }
        
        const dataItems = extractDataItems();
        
        // CRITICAL INVESTIGATION: Tell Bases what data we're displaying
        const investigationController = (basesContainer as any)?.controller;
        if (investigationController && dataItems.length > 0) {
          console.debug('[TaskNotes][Bases] Investigating formula computation triggers...');
          
          // Method 1: Check if controller has methods to notify about displayed data
          const controllerMethods = investigationController ? Object.getOwnPropertyNames(investigationController) : [];
          const displayMethods = controllerMethods.filter((name: string) => 
            name.toLowerCase().includes('display') || 
            name.toLowerCase().includes('show') || 
            name.toLowerCase().includes('visible') ||
            name.toLowerCase().includes('render') ||
            name.toLowerCase().includes('compute') ||
            name.toLowerCase().includes('formula')
          );
          console.debug('[TaskNotes][Bases] Display-related methods:', displayMethods);
          
          // Method 2: Check if we can trigger formula computation for specific items
          const results = (basesContainer as any)?.results;
          if (results && results instanceof Map) {
            console.debug('[TaskNotes][Bases] Attempting to trigger formula computation for displayed items...');
            
            // Try to get first few items for testing
            const firstItems = Array.from(results.entries()).slice(0, 3);
            console.debug('[TaskNotes][Bases] Working with items:', firstItems.map(([k, v]) => ({
              key: k,
              path: (v as any)?.file?.path || (v as any)?.path,
              hasFormulas: !!(v as any)?.formulaResults
            })));
            
            // Investigation: What if we need to tell Bases controller which items are visible?
            if (typeof investigationController.setVisibleItems === 'function') {
              console.debug('[TaskNotes][Bases] Found setVisibleItems method - calling it');
              investigationController.setVisibleItems(firstItems.map(([k, v]) => k));
            }
            
            if (typeof investigationController.computeFormulasForItems === 'function') {
              console.debug('[TaskNotes][Bases] Found computeFormulasForItems method - calling it');
              await investigationController.computeFormulasForItems(firstItems.map(([k, v]) => k));
            }
            
            if (typeof investigationController.requestFormulaComputation === 'function') {
              console.debug('[TaskNotes][Bases] Found requestFormulaComputation method - calling it');
              await investigationController.requestFormulaComputation();
            }
          }
        }
        
        // CRITICAL: Check formulas BEFORE processing  
        console.debug('[TaskNotes][Bases] PRE-PROCESSING formula check...');
        
        // INVESTIGATE: Check ctx.formulas and query.formulas as the actual formula engines
        const ctxFormulas = (basesContainer as any)?.ctx?.formulas;
        const queryFormulas = (basesContainer as any)?.query?.formulas;
        
        console.debug('[TaskNotes][Bases] FORMULA ENGINES:', {
          ctxFormulas: ctxFormulas ? Object.keys(ctxFormulas) : 'NONE',
          queryFormulas: queryFormulas ? Object.keys(queryFormulas) : 'NONE',
          ctxFormulaTypes: ctxFormulas ? Object.keys(ctxFormulas).map(k => typeof ctxFormulas[k]) : [],
          queryFormulaTypes: queryFormulas ? Object.keys(queryFormulas).map(k => typeof queryFormulas[k]) : []
        });
        
        if (dataItems.length > 0) {
          const firstItem = dataItems[0];
          const formulaResults = firstItem.basesData?.formulaResults;
          
          console.debug('[TaskNotes][Bases] PRE-PROCESSING formulas:', {
            hasFormulaResults: !!formulaResults,
            cachedFormulas: formulaResults?.cachedFormulaOutputs ? Object.keys(formulaResults.cachedFormulaOutputs) : [],
            definedFormulas: formulaResults?.definedFormulas || []
          });
          
          // CRITICAL TEST: Compute formulas for ALL data items, not just the first
          if (ctxFormulas && typeof ctxFormulas === 'object') {
            const formulaKeys = Object.keys(ctxFormulas);
            console.debug('[TaskNotes][Bases] Computing formulas for all', dataItems.length, 'items...');
            
            // Process each data item separately
            for (let i = 0; i < dataItems.length; i++) {
              const item = dataItems[i];
              const itemFormulaResults = item.basesData?.formulaResults;
              
              if (!itemFormulaResults?.cachedFormulaOutputs) continue;
              
              console.debug(`[TaskNotes][Bases] Computing formulas for item ${i + 1}/${dataItems.length} (${item.path})`);
              
              // Compute ALL formulas for this item
              for (const formulaName of formulaKeys) {
                const formula = ctxFormulas[formulaName];
                if (formula && typeof formula.getValue === 'function') {
                  try {
                    const result = formula.getValue(item.basesData);
                    
                    // BREAKTHROUGH: Inject computed result into THIS item's cache
                    if (result !== undefined) {
                      itemFormulaResults.cachedFormulaOutputs[formulaName] = result;
                      console.debug(`[TaskNotes][Bases] INJECTED ${formulaName} for item ${i + 1}:`, result);
                    }
                  } catch (e) {
                    console.debug(`[TaskNotes][Bases] ${formulaName} failed for item ${i + 1}:`, e);
                  }
                }
              }
            }
          }
          
          if (queryFormulas && typeof queryFormulas === 'object') {
            const formulaKeys = Object.keys(queryFormulas);
            console.debug('[TaskNotes][Bases] Attempting to compute using query.formulas:', formulaKeys);
            
            // Investigate query formula object structure  
            if (formulaKeys.includes('TESTST')) {
              const teststFormula = queryFormulas.TESTST;
              console.debug('[TaskNotes][Bases] TESTST query formula structure:', {
                type: typeof teststFormula,
                isFunction: typeof teststFormula === 'function',
                keys: typeof teststFormula === 'object' ? Object.keys(teststFormula) : [],
                methods: typeof teststFormula === 'object' ? Object.keys(teststFormula).filter(k => typeof teststFormula[k] === 'function') : [],
                prototype: teststFormula ? Object.getOwnPropertyNames(Object.getPrototypeOf(teststFormula)) : []
              });
              
              // Try different ways to execute the query formula
              if (typeof teststFormula === 'function') {
                try {
                  const result = teststFormula(firstItem.basesData);
                  console.debug('[TaskNotes][Bases] TESTST query formula (direct call):', result);
                  
                  // BREAKTHROUGH: Try to inject the computed result into the cache!
                  // The formula already returns {icon: "lucide-binary", data: value} - store it directly
                  if (result !== undefined && formulaResults?.cachedFormulaOutputs) {
                    formulaResults.cachedFormulaOutputs.TESTST = result;
                    console.debug('[TaskNotes][Bases] INJECTED TESTST into cache (direct):', result);
                  }
                } catch (e) {
                  console.debug('[TaskNotes][Bases] TESTST query formula (direct call) failed:', e);
                }
              } else if (teststFormula && typeof teststFormula.execute === 'function') {
                try {
                  const result = teststFormula.execute(firstItem.basesData);
                  console.debug('[TaskNotes][Bases] TESTST query formula (execute method):', result);
                  
                  // BREAKTHROUGH: Try to inject the computed result into the cache!
                  // The formula already returns {icon: "lucide-binary", data: value} - store it directly
                  if (result !== undefined && formulaResults?.cachedFormulaOutputs) {
                    formulaResults.cachedFormulaOutputs.TESTST = result;
                    console.debug('[TaskNotes][Bases] INJECTED TESTST into cache (direct):', result);
                  }
                } catch (e) {
                  console.debug('[TaskNotes][Bases] TESTST query formula (execute method) failed:', e);
                }
              } else if (teststFormula && typeof teststFormula.getValue === 'function') {
                try {
                  console.debug('[TaskNotes][Bases] Calling query TESTST.getValue() with basesData...');
                  const result = teststFormula.getValue(firstItem.basesData);
                  console.debug('[TaskNotes][Bases] TESTST query formula (getValue method):', result);
                  
                  // BREAKTHROUGH: Try to inject the computed result into the cache!
                  if (result !== undefined && formulaResults?.cachedFormulaOutputs) {
                    formulaResults.cachedFormulaOutputs.TESTST = { icon: "lucide-binary", data: result };
                    console.debug('[TaskNotes][Bases] INJECTED TESTST query result into cache:', result);
                  }
                } catch (e) {
                  console.debug('[TaskNotes][Bases] TESTST query formula (getValue method) failed:', e);
                }
              } else if (teststFormula && typeof teststFormula.test === 'function') {
                try {
                  console.debug('[TaskNotes][Bases] Calling query TESTST.test() with basesData...');
                  const result = teststFormula.test(firstItem.basesData);
                  console.debug('[TaskNotes][Bases] TESTST query formula (test method):', result);
                } catch (e) {
                  console.debug('[TaskNotes][Bases] TESTST query formula (test method) failed:', e);
                }
              }
            }
          }
        }
        
        // ARCHITECTURAL INVESTIGATION: Can Bases render objects itself?
        console.debug('[TaskNotes][Bases] INVESTIGATING: Can Bases handle rendering?');
        const renderController = (basesContainer as any)?.controller;
        const renderQuery = (basesContainer as any)?.query;
        
        // Check if Bases has native rendering capabilities
        const renderingMethods = [];
        if (renderController) {
          const methods = Object.getOwnPropertyNames(renderController);
          renderingMethods.push(...methods.filter((name: string) => 
            name.toLowerCase().includes('render') || 
            name.toLowerCase().includes('view') || 
            name.toLowerCase().includes('display')
          ));
        }
        
        if (renderQuery) {
          const methods = Object.getOwnPropertyNames(renderQuery);
          renderingMethods.push(...methods.filter((name: string) => 
            name.toLowerCase().includes('render') || 
            name.toLowerCase().includes('view') || 
            name.toLowerCase().includes('display')
          ));
        }
        
        console.debug('[TaskNotes][Bases] Bases rendering methods found:', renderingMethods);
        
        const taskNotes = await identifyTaskNotesFromBasesData(dataItems);
        
        // CRITICAL: Check formulas AFTER identifyTaskNotesFromBasesData
        console.debug('[TaskNotes][Bases] POST-PROCESSING formula check...');
        if (dataItems.length > 0) {
          const firstItem = dataItems[0];
          const formulaResults = firstItem.basesData?.formulaResults;
          console.debug('[TaskNotes][Bases] POST-PROCESSING formulas:', {
            hasFormulaResults: !!formulaResults,
            cachedFormulas: formulaResults?.cachedFormulaOutputs ? Object.keys(formulaResults.cachedFormulaOutputs) : [],
            definedFormulas: formulaResults?.definedFormulas || [],
            basesDataStillExists: !!firstItem.basesData
          });
        }

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
            dataItems.filter(i => !!i.path).map(i => [i.path!, (i as any).properties || (i as any).frontmatter || {}])
          );


          // Apply Bases sorting if configured
          const { getBasesSortComparator } = await import('./sorting');
          const sortComparator = getBasesSortComparator(basesContainer, pathToProps);
          if (sortComparator) {
            taskNotes.sort(sortComparator);
          }

          // Render tasks using existing helper
          await renderTaskNotesInBasesView(itemsContainer, taskNotes, plugin, basesContainer);
          
          // CRITICAL INVESTIGATION: Check formulas after rendering
          console.debug('[TaskNotes][Bases] POST-RENDER formula check...');
          const postResults = (basesContainer as any)?.results;
          if (postResults && postResults instanceof Map) {
            const firstItem = Array.from(postResults.entries())[0];
            if (firstItem) {
              const [key, value] = firstItem;
              const formulaResults = (value as any)?.formulaResults;
              console.debug('[TaskNotes][Bases] POST-RENDER formulas:', {
                hasFormulaResults: !!formulaResults,
                cachedFormulas: formulaResults?.cachedFormulaOutputs ? Object.keys(formulaResults.cachedFormulaOutputs) : [],
                definedFormulas: formulaResults?.definedFormulas || []
              });
            }
          }
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
        console.debug('[TaskNotes][Bases] onDataUpdated called - checking if this triggers formula computation');
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
          } catch (e) {}
        }
        if (currentRoot) {
          currentRoot.remove();
          currentRoot = null;
        }
        queryListener = null;
      },
      load: () => {
        console.debug('[TaskNotes][Bases] View LOAD called - this might be key for formula computation');
        
        if ((basesContainer as any)?.query?.on && !queryListener) {
          queryListener = () => void render();
          try {
            (basesContainer as any).query.on('change', queryListener);
          } catch (e) {}
        }
        
        // INVESTIGATION: Maybe we need to tell Bases this view is "active" or "loaded"
        const controller = (basesContainer as any)?.controller;
        console.debug('[TaskNotes][Bases] Load - investigating activation methods...');
        
        if (controller) {
          const methods = Object.getOwnPropertyNames(controller);
          const activationMethods = methods.filter((name: string) => 
            name.toLowerCase().includes('active') || 
            name.toLowerCase().includes('focus') || 
            name.toLowerCase().includes('load') ||
            name.toLowerCase().includes('mount') ||
            name.toLowerCase().includes('attach')
          );
          console.debug('[TaskNotes][Bases] Activation-related methods:', activationMethods);
          
          // Try calling activation methods
          activationMethods.forEach(method => {
            if (typeof controller[method] === 'function') {
              try {
                console.debug(`[TaskNotes][Bases] Calling ${method}()`);
                controller[method]();
              } catch (e) {
                console.debug(`[TaskNotes][Bases] ${method}() failed:`, e);
              }
            }
          });
        }
        
        // Trigger initial formula computation on load
        console.debug('[TaskNotes][Bases] Load - checking for runQuery method:', !!controller?.runQuery);
        
        if (controller?.runQuery) {
          controller.runQuery().then(() => {
            console.debug('[TaskNotes][Bases] Initial formula computation complete');
            void render(); // Re-render with computed formulas
          }).catch((e: any) => {
            console.debug('[TaskNotes][Bases] Initial formula computation failed:', e);
          });
        } else if ((basesContainer as any)?.runQuery) {
          try {
            const result = (basesContainer as any).runQuery();
            console.debug('[TaskNotes][Bases] Load runQuery result type:', typeof result);
            
            if (result && typeof result.then === 'function') {
              result.then(() => {
                console.debug('[TaskNotes][Bases] Initial runQuery (direct) complete');
                void render();
              }).catch((e: any) => {
                console.debug('[TaskNotes][Bases] Initial runQuery (direct) failed:', e);
              });
            } else {
              console.debug('[TaskNotes][Bases] Sync runQuery completed in load');
              void render();
            }
          } catch (error) {
            console.debug('[TaskNotes][Bases] Load runQuery failed:', error);
          }
        }
      },
      unload: () => {
        if (queryListener && (basesContainer as any)?.query?.off) {
          try {
            (basesContainer as any).query.off('change', queryListener);
          } catch (e) {}
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