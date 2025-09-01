import TaskNotesPlugin from '../main';
import { BasesDataItem, identifyTaskNotesFromBasesData, renderTaskNotesInBasesView } from './helpers';

export interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void };
  viewContainerEl?: HTMLElement;
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
          dataItems.push({
            key,
            data: value,
            file: (value as any)?.file,
            path: (value as any)?.file?.path || (value as any)?.path,
            properties: (value as any)?.properties || (value as any)?.frontmatter,
            // Note: Formula results extraction is handled in the property rendering layer
            // since Bases formula computation is complex and property-specific
            formulaResults: {}
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
      // Core interface for Bases
      refresh: render,
      destroy: () => {
        // Clean up query listener
        if (queryListener && (basesContainer as any)?.query?.off) {
          try {
            (basesContainer as any).query.off('change', queryListener);
          } catch (e) {
            // Silently handle query listener cleanup failure
          }
        }
        
        // Clean up DOM
        if (currentRoot) {
          currentRoot.remove();
          currentRoot = null;
        }
        queryListener = null;
      },
      
      // Bases lifecycle methods
      load: () => {
        // Attach query change listener if available
        if ((basesContainer as any)?.query?.on && !queryListener) {
          queryListener = () => void render();
          try {
            (basesContainer as any).query.on('change', queryListener);
          } catch (e) {
            // Silently handle query listener attachment failure
          }
        }
      },
      
      unload: () => {
        // Clean up query listener
        if (queryListener && (basesContainer as any)?.query?.off) {
          try {
            (basesContainer as any).query.off('change', queryListener);
          } catch (e) {
            // Silently handle query listener cleanup failure
          }
        }
        
        // Clean up DOM
        if (currentRoot) {
          currentRoot.remove();
          currentRoot = null;
        }
        queryListener = null;
      },

      // Additional methods that Bases might expect
      onDataUpdated: () => void render(),
      getViewType: () => 'tasknotes',
      getDisplayText: () => 'TaskNotes'
    };

    return viewObject;
  };
}