import TaskNotesPlugin from '../main';
import { TextComponent, debounce, setTooltip, Notice, setIcon, ButtonComponent, TFile } from 'obsidian';
import { BasesDataItem, identifyTaskNotesFromBasesData, renderTaskNotesInBasesView } from './helpers';
import { getTaskNotesTasklistRows } from './tasklist-rows';
import { getBasesGroupByConfig } from './group-by';
import { getBasesSortComparator } from './sorting';
import { buildSearchIndex, filterTasksBySearch } from './search';
import { TaskNotesBasesTaskListComponent } from './component';

export interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void };
  viewContainerEl?: HTMLElement;
}

/**
 * Build a Kanban view factory for Obsidian Bases integration following the Task List pattern.
 * - Columns are defined by Bases groupBy configuration
 * - Supports ephemeral search filter
 * - Renders TaskNotes TaskCard(s) with extraPropertiesRows from tasknotes.tasklist config
 * - Minimal drag-and-drop support across columns (status/priority/context/project)
 */
export function buildTasknotesKanbanViewFactory(plugin: TaskNotesPlugin) {
  return function tasknotesKanbanViewFactory(basesContainer: BasesContainerLike) {
    let currentRoot: HTMLElement | null = null;

    // Guard
    const viewContainerEl = (basesContainer as any)?.viewContainerEl as HTMLElement | undefined;
    if (!viewContainerEl) {
      console.error('[TaskNotes][BasesPOC] No viewContainerEl found');
      return { destroy: () => {} } as any;
    }

    // Ensure clean container
    viewContainerEl.innerHTML = '';

    // Root container
    const root = document.createElement('div');
    root.className = 'tn-bases-integration tasknotes-plugin kanban-view';
    viewContainerEl.appendChild(root);
    currentRoot = root;

    // Controls (search)
    const controls = document.createElement('div');
    controls.className = 'filter-bar__top-controls';
    root.appendChild(controls);

    let currentSearchTerm = '';
    try {
      const searchInput = new TextComponent(controls).setPlaceholder('Search path | title | aliases');
      searchInput.inputEl.addClass('filter-bar__search-input');
      setTooltip(searchInput.inputEl, 'Quick search (ephemeral)', { placement: 'top' } as any);
      const triggerSearch = debounce(() => { currentSearchTerm = searchInput.getValue(); void render(); }, 800);
      searchInput.onChange(() => triggerSearch());
    } catch (_) {
      // Fallback in unit-test or non-Obsidian environment
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Search path | title | aliases';
      input.className = 'filter-bar__search-input';
      input.addEventListener('input', debounce(() => {
        currentSearchTerm = input.value;
        void render();
      }, 800));
      controls.appendChild(input);
    }

    // Board container
    const board = document.createElement('div');
    board.className = 'kanban-view__board';
    board.style.marginTop = '12px';
    root.appendChild(board);

    /**
     * Add "+New" button to the right side of the controls
     */
    const addNewTaskButton = () => {
      // Remove any existing "+New" button first
      controls.querySelectorAll('.filter-bar__new-task-button').forEach(el => el.remove());

      const newTaskButton = new ButtonComponent(controls)
        .setTooltip('Create new task')
        .setClass('filter-bar__new-task-button')
        .onClick(() => {
          createNewTaskWithContext();
        });
      newTaskButton.buttonEl.addClass('clickable-icon');
      newTaskButton.buttonEl.addClass('has-text-icon');

      // Clear any existing content and build manually
      newTaskButton.buttonEl.empty();

      // Add icon
      const iconEl = newTaskButton.buttonEl.createSpan({ cls: 'button-icon' });
      setIcon(iconEl, 'plus');

      // Add text
      const textEl = newTaskButton.buttonEl.createSpan({ cls: 'button-text', text: 'New' });
    };

    /**
     * Context-aware task creation based on workspace position
     */
    const createNewTaskWithContext = () => {
      try {
        // Detect workspace position and determine context
        const context = detectWorkspaceContext();

        if (context.isInSidebar) {
          // Sidebar mode: Use active file as project context
          const activeFile = plugin.app.workspace.getActiveFile();
          if (activeFile) {
            const projectReference = `[[${activeFile.basename}]]`;
            plugin.openTaskCreationModal({
              projects: [projectReference]
            });
          } else {
            // No active file, create standalone task
            plugin.openTaskCreationModal();
          }
        } else {
          // Main content mode: Create standalone task
          plugin.openTaskCreationModal();
        }
      } catch (error) {
        console.error('[TaskNotes][Bases] Error creating new task:', error);
        // Fallback to basic task creation
        plugin.openTaskCreationModal();
      }
    };

    /**
     * Detect if the Bases view is in sidebar vs main content area
     */
    const detectWorkspaceContext = () => {
      try {
        // Try to find the workspace leaf containing this view
        const workspace = plugin.app.workspace;
        let currentLeaf = null;

        // Search through all leaves to find the one containing our view
        workspace.iterateAllLeaves((leaf) => {
          if (leaf.view && leaf.view.containerEl &&
              leaf.view.containerEl.contains(viewContainerEl)) {
            currentLeaf = leaf;
          }
        });

        if (!currentLeaf) {
          // Fallback: assume main content if we can't determine
          return { isInSidebar: false, leaf: null };
        }

        // Check if the leaf is in a sidebar by examining its parent structure
        const leafEl = currentLeaf.containerEl;
        const isInLeftSidebar = leafEl.closest('.workspace-split.mod-left-split') !== null;
        const isInRightSidebar = leafEl.closest('.workspace-split.mod-right-split') !== null;
        const isInSidebar = isInLeftSidebar || isInRightSidebar;

        return {
          isInSidebar,
          isInLeftSidebar,
          isInRightSidebar,
          leaf: currentLeaf
        };
      } catch (error) {
        console.error('[TaskNotes][Bases] Error detecting workspace context:', error);
        // Safe fallback
        return { isInSidebar: false, leaf: null };
      }
    };

    // Helpers
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
        try {
          if (plugin.settings?.basesAdvancedDataLogs) {
            const raw = Array.from(((basesContainer as any)?.results as Map<any, any> | undefined)?.entries?.() || []);
            console.log('[TaskNotes][Bases][ADVANCED-DUMP]', {
              size: (basesContainer as any)?.results instanceof Map ? (basesContainer as any).results.size : undefined,
              results: raw
            });
          }
        } catch (_) { /* ignore */ }
        const taskNotes = await identifyTaskNotesFromBasesData(dataItems);

        // Clear board
        board.innerHTML = '';

        if (taskNotes.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'tn-bases-empty';
          empty.style.cssText = 'padding: 20px; text-align: center; color: #666;';
          empty.textContent = 'No TaskNotes tasks found for this Base.';
          board.appendChild(empty);
          return;
        }

        // Map path -> properties/frontmatter for property value resolution
        const pathToProps = new Map<string, Record<string, any>>(
          dataItems.filter(i => !!i.path).map(i => [i.path!, (i as any).properties || (i as any).frontmatter || {}])
        );

        // Extra property rows for TaskCard from tasknotes.tasklist
        const rows = getTaskNotesTasklistRows(basesContainer as any, pathToProps);
        let extraRows = [rows.row3, rows.row4].filter(Boolean) as any[];
        if (extraRows.length === 0) {
          const { getBasesPropertyRowConfig } = await import('./property-selection');
          const fallback = getBasesPropertyRowConfig(basesContainer as any, pathToProps) || undefined;
          if (fallback) extraRows = [fallback] as any[];
        }

        // Search
        const getAliases = (p: string): string[] => {
          const props = pathToProps.get(p) || {};
          const v = props['note.aliases'] ?? props['aliases'];
          if (Array.isArray(v)) return v.filter((x: any) => !!x).map(String);
          if (typeof v === 'string' && v.trim()) return [v];
          return [];
        };
        const searchIndex = buildSearchIndex(taskNotes, { getAliases });
        const searchedTasks = filterTasksBySearch(taskNotes, searchIndex, currentSearchTerm);

        // Grouping (required for Kanban)
        const groupCfg = getBasesGroupByConfig(basesContainer as any, pathToProps);
        if (!groupCfg) {
          const msg = document.createElement('div');
          msg.className = 'tn-bases-warning';
          msg.textContent = 'Kanban requires a groupBy configuration in this Base.';
          board.appendChild(msg);
          return;
        }

        // Sort according to Bases sort if present
        const cmp = getBasesSortComparator(basesContainer as any, pathToProps);
        const tasksForGrouping = cmp ? [...searchedTasks].sort(cmp) : searchedTasks;

        // Build groups
        const groups = new Map<string, typeof taskNotes>();
        for (const t of tasksForGrouping) {
          const values = groupCfg.getGroupValues(t.path) || ['none'];
          for (const v of values) {
            const key = String(v ?? 'none');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(t);
          }
        }

        // Column names: include all statuses/priorities as empty columns when applicable
        const namesSet = new Set<string>(Array.from(groups.keys()));
        const groupDomain = groupCfg.normalizedId.includes('.') ? groupCfg.normalizedId.split('.').pop()! : groupCfg.normalizedId;
        try {
          if (groupDomain === 'status') {
            const allStatuses = plugin.statusManager.getAllStatuses().map(s => s.value);
            for (const s of allStatuses) namesSet.add(String(s));
          } else if (groupDomain === 'priority') {
            const allPriorities = plugin.priorityManager.getAllPriorities().map(p => p.value);
            for (const p of allPriorities) namesSet.add(String(p));
          }
        } catch (_) { /* ignore if managers not available */ }

        let columnNames = Array.from(namesSet);
        if (cmp && (cmp as any).__basesSortEntries && (cmp as any).__basesSortEntries.length > 0) {
          const first = (cmp as any).__basesSortEntries[0];
          const { getGroupNameComparator } = await import('./group-ordering');
          columnNames = columnNames.sort(getGroupNameComparator(first));
        } else {
          columnNames = columnNames.sort((a, b) => a.localeCompare(b));
        }

        // Render columns
        for (const colName of columnNames) {
          const column = document.createElement('div');
          column.className = 'kanban-view__column';
          column.setAttribute('data-column-id', colName);

          const header = document.createElement('div');
          header.className = 'kanban-view__column-header';
          const title = document.createElement('div');
          title.className = 'kanban-view__column-title';
          title.textContent = colName;
          header.appendChild(title);
          const count = document.createElement('div');
          count.className = 'kanban-view__column-count';
          count.textContent = `${(groups.get(colName) || []).length} tasks`;
          header.appendChild(count);
          column.appendChild(header);

          const body = document.createElement('div');
          body.className = 'kanban-view__column-body';
          const tasksContainer = document.createElement('div');
          tasksContainer.className = 'kanban-view__tasks-container';
          body.appendChild(tasksContainer);
          column.appendChild(body);

          // Render tasks using helper to ensure TaskCard consistency (with extra rows)
          const tasks = groups.get(colName) || [];
          await renderTaskNotesInBasesView(tasksContainer, tasks, plugin, { extraPropertiesRows: extraRows as any });

          // Make task cards draggable
          for (const card of Array.from(tasksContainer.querySelectorAll('.task-card')) as HTMLElement[]) {
            const p = card.getAttribute('data-task-path');
            if (p) {
              card.draggable = true;
              card.addEventListener('dragstart', (e) => {
                if (e.dataTransfer) {
                  e.dataTransfer.setData('text/plain', p);
                  e.dataTransfer.effectAllowed = 'move';
                }
                window.setTimeout(() => card.classList.add('task-card--dragging'), 0);
              });
              card.addEventListener('dragend', () => card.classList.remove('task-card--dragging'));
            }
          }

          // Accept drops on column
          addColumnDropHandlers(column, async (taskPath: string, targetColumnId: string) => {
            try {
              const last = groupCfg.normalizedId.includes('.') ? groupCfg.normalizedId.split('.').pop()! : groupCfg.normalizedId;
              let propertyToUpdate: any; let valueToSet: any;
              switch (last) {
                case 'status': propertyToUpdate = 'status'; valueToSet = targetColumnId; break;
                case 'priority': propertyToUpdate = 'priority'; valueToSet = targetColumnId; break;
                case 'context':
                case 'contexts': propertyToUpdate = 'contexts'; valueToSet = [targetColumnId]; break;
                case 'project':
                case 'projects': propertyToUpdate = 'projects'; valueToSet = [targetColumnId]; break;
                default:
                  throw new Error(`Unsupported groupBy for drag-and-drop: ${groupCfg.normalizedId}`);
              }
              const task = await plugin.cacheManager.getCachedTaskInfo(taskPath);
              if (task) {
                await plugin.updateTaskProperty(task, propertyToUpdate, valueToSet, { silent: true });
                new Notice(`Task moved to "${targetColumnId}"`);
              }
            } catch (e) {
              console.error('[TaskNotes][BasesPOC] Move failed:', e);
              new Notice('Failed to move task');
            } finally {
              void render();
            }
          });

          board.appendChild(column);
        }

        // Add "+New" button after rendering columns
        addNewTaskButton();
      } catch (error) {
        console.error('[TaskNotes][BasesPOC] Error rendering Kanban:', error);
      }
    };

    function addColumnDropHandlers(columnEl: HTMLElement, onDropTask: (taskPath: string, targetColumnId: string) => void | Promise<void>) {
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
        if (taskPath && targetColumnId) await onDropTask(taskPath, targetColumnId);
      });
    }

    // Build component with lifecycle hooks mirroring Task List component
    const component = new TaskNotesBasesTaskListComponent({
      getContainer: () => currentRoot,
      setContainer: (el) => { currentRoot = el; },
      refresh: render,
      attachQueryListener: (handler) => (basesContainer as any)?.query?.on?.('change', handler),
      detachQueryListener: (handler) => (basesContainer as any)?.query?.off?.('change', handler)
    });

    // Add Bases lifecycle shims
    (component as any).load = component.onload.bind(component);
    (component as any).unload = component.onunload.bind(component);

    // Kick off initial async render
    void render();

    return component as any;
  };
}

