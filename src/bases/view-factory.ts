import TaskNotesPlugin from '../main';
import { BasesDataItem, identifyTaskNotesFromBasesData, renderTaskNotesInBasesView } from './helpers';
import { TaskNotesBasesTaskListComponent } from './component';
import { setIcon, ButtonComponent, TextComponent, debounce, setTooltip, TFile } from 'obsidian';
import { renderTextWithLinks, appendInternalLink } from '../ui/renderers/linkRenderer';

export interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void };
  viewContainerEl?: HTMLElement;
}

export function buildTasknotesTaskListViewFactory(plugin: TaskNotesPlugin) {
  return function tasknotesTaskListViewFactory(basesContainer: BasesContainerLike) {
    let currentRoot: HTMLElement | null = null;

    // Guard
    const viewContainerEl = (basesContainer as any)?.viewContainerEl as HTMLElement | undefined;
    if (!viewContainerEl) {
      console.error('[TaskNotes][BasesPOC] No viewContainerEl found');
      return { destroy: () => {} } as any;
    }

    // Ensure clean container
    viewContainerEl.innerHTML = '';

    // Root container for TaskNotes view
    const root = document.createElement('div');
    root.className = 'tn-bases-integration tasknotes-plugin tasknotes-container';
    viewContainerEl.appendChild(root);
    currentRoot = root;


    // Controls container (top bar) - mimic FilterBar expand/collapse buttons
    const controls = document.createElement('div');
    controls.className = 'filter-bar__top-controls';
    root.appendChild(controls);

    // Add search input (ephemeral in-memory filtering)
    let currentSearchTerm = '';
    const searchInput = new TextComponent(controls)
      .setPlaceholder('Search path | title | aliases');
    searchInput.inputEl.addClass('filter-bar__search-input');
    setTooltip(searchInput.inputEl, 'Quick search (ephemeral)', { placement: 'top' } as any);

    const triggerSearch = debounce(() => {
      currentSearchTerm = searchInput.getValue();
      void render();
    }, 800);
    searchInput.onChange(() => triggerSearch());

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'tn-bases-items-container';
    itemsContainer.style.cssText = 'margin-top: 12px;';
    root.appendChild(itemsContainer);

    /**
     * Add "+New" button to the right side of the controls (after expand/collapse buttons)
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
          // TODO: In the future, we could use the base file itself as context
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

        // Clear previous expand/collapse buttons (keep search input)
        controls.querySelectorAll('.filter-bar__expand-groups, .filter-bar__collapse-groups').forEach(el => el.remove());

        // Render body
        itemsContainer.innerHTML = '';
        if (taskNotes.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'tn-bases-empty';
          emptyEl.style.cssText = 'padding: 20px; text-align: center; color: #666;';

          const emptyTitle = document.createElement('p');
          emptyTitle.textContent = 'No TaskNotes tasks found for this Base.';
          emptyTitle.style.cssText = 'margin: 0 0 10px 0; font-weight: 500;';
          emptyEl.appendChild(emptyTitle);

          const emptyDesc = document.createElement('p');
          emptyDesc.textContent = 'TaskNotes are identified by files with task-related frontmatter properties.';
          emptyDesc.style.cssText = 'margin: 0; font-size: 0.9em; opacity: 0.7;';
          emptyEl.appendChild(emptyDesc);

          itemsContainer.appendChild(emptyEl);
        } else {
          // Build a map from task path to its properties/frontmatter for property value resolution
          const pathToProps = new Map<string, Record<string, any>>(
            dataItems.filter(i => !!i.path).map(i => [i.path!, (i as any).properties || (i as any).frontmatter || {}])
          );

          // Compute TaskNotes Task Card property rows from Bases view config
          const { getTaskNotesTasklistRows } = await import('./tasklist-rows');
          const rows = getTaskNotesTasklistRows(basesContainer as any, pathToProps);
          let extraRows = [rows.row3, rows.row4].filter(Boolean) as any[];
          try {
            const settingsLogsOn = !!((plugin as any)?.settings?.basesPOCLogs);
            if (settingsLogsOn) {
              console.log('[TaskNotes][Bases] EXTRA_ROWS_UNCONDITIONAL:', {
                count: extraRows.length,
                row3: rows.row3?.selected?.map(s => s.id),
                row4: rows.row4?.selected?.map(s => s.id)
              });
            }
          } catch (_) { /* ignore */ }
          // Backward-compatible fallback: use 'order' as single row if custom config absent
          if (extraRows.length === 0) {
            const { getBasesPropertyRowConfig } = await import('./property-selection');
            const fallback = getBasesPropertyRowConfig(basesContainer as any, pathToProps) || undefined;
            if (fallback) extraRows = [fallback] as any[];
          }

          // In-memory search filter (ephemeral)
          const { buildSearchIndex, filterTasksBySearch } = await import('./search');
          const getAliases = (p: string): string[] => {
            const props = pathToProps.get(p) || {};
            const v = props['note.aliases'] ?? props['aliases'];
            if (Array.isArray(v)) return v.filter((x: any) => !!x).map(String);
            if (typeof v === 'string' && v.trim()) return [v];
            return [];
          };
          const searchIndex = buildSearchIndex(taskNotes, { getAliases });
          const searchedTasks = filterTasksBySearch(taskNotes, searchIndex, currentSearchTerm);

          // Attempt to read Bases native groupBy configuration
          const { getBasesGroupByConfig } = await import('./group-by');
          const groupCfg = getBasesGroupByConfig(basesContainer as any, pathToProps);

          if (groupCfg) {
            // Sort tasks using Bases view sort settings if available
            const { getBasesSortComparator } = await import('./sorting');
            const cmp = getBasesSortComparator(basesContainer as any, pathToProps);
            const tasksForGrouping = cmp ? [...searchedTasks].sort(cmp) : searchedTasks;

            const groups = new Map<string, typeof taskNotes>();
            for (const t of tasksForGrouping) {
              const values = groupCfg.getGroupValues(t.path) || ['none'];
              for (const v of values) {
                const key = String(v ?? 'none');
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(t);
              }
            }

            // Order group headings: if first sort key matches the same domain, use its direction; else alphabetical
            let groupNames = Array.from(groups.keys());
            if (cmp && (cmp as any).__basesSortEntries && (cmp as any).__basesSortEntries.length > 0) {
              const first = (cmp as any).__basesSortEntries[0];
              const { getGroupNameComparator } = await import('./group-ordering');
              groupNames = groupNames.sort(getGroupNameComparator(first));
            } else {
              groupNames = groupNames.sort((a, b) => a.localeCompare(b));
            }

            // Utilities for count and collapsed state
            const { GroupCountUtils } = await import('../utils/GroupCountUtils');
            const { GroupingUtils } = await import('../utils/GroupingUtils');
            const { BASES_TASK_LIST_VIEW_TYPE } = await import('../types');
            const groupingKey = `bases:${groupCfg.normalizedId}`;

            const groupSections: HTMLElement[] = [];
            for (const groupName of groupNames) {
              const tasks = groups.get(groupName)!;
              if (!tasks.length) continue;

              const section = document.createElement('section');
              section.className = 'task-section task-group';
              section.setAttribute('data-group', groupName);

              // Header
              const header = document.createElement('h3');
              header.className = 'task-group-header task-list-view__group-header';

              const toggleBtn = document.createElement('button');
              toggleBtn.className = 'task-group-toggle';
              toggleBtn.setAttribute('aria-label', 'Toggle group');
              try {
                setIcon(toggleBtn, 'chevron-right');
                const svg = toggleBtn.querySelector('svg');
                if (svg) { svg.classList.add('chevron'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); }
              } catch (_) {
                toggleBtn.textContent = '▸';
              }
              header.appendChild(toggleBtn);

              const labelSpan = document.createElement('span');
              labelSpan.className = 'tn-bases-group-label';

              // Render wikilinks/markdown links clickable in group names (Text/List props)
              // If the rendered result has no anchors, fall back to plain text
              renderTextWithLinks(labelSpan, groupName, { metadataCache: plugin.app.metadataCache, workspace: plugin.app.workspace });
              if (labelSpan.querySelectorAll('a').length === 0) {
                labelSpan.textContent = groupName;
              }
              header.appendChild(labelSpan);

              // Count
              const stats = GroupCountUtils.calculateGroupStats(tasks, plugin);
              const countSpan = document.createElement('span');
              countSpan.className = 'agenda-view__item-count';
              countSpan.textContent = ` ${GroupCountUtils.formatGroupCount(stats.completed, stats.total).text}`;
              header.appendChild(countSpan);

              section.appendChild(header);

              // List container
              const list = document.createElement('div');
              list.className = 'tasks-container task-cards';
              section.appendChild(list);

              // Collapsed state
              const collapsedInitially = GroupingUtils.isGroupCollapsed(
                BASES_TASK_LIST_VIEW_TYPE,
                groupingKey,
                groupName,
                plugin
              );
              if (collapsedInitially) {
                section.classList.add('is-collapsed');
                list.style.display = 'none';
              }
              toggleBtn.setAttribute('aria-expanded', String(!collapsedInitially));

              // Toggle behavior
              const toggle = () => {
                const willCollapse = !section.classList.contains('is-collapsed');
                GroupingUtils.setGroupCollapsed(BASES_TASK_LIST_VIEW_TYPE, groupingKey, groupName, willCollapse, plugin);
                section.classList.toggle('is-collapsed', willCollapse);
                list.style.display = willCollapse ? 'none' : '';
                toggleBtn.setAttribute('aria-expanded', String(!willCollapse));
              };
              header.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('a')) return; // ignore internal link clicks
                toggle();
              });
              toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle();
              });

              // Render tasks for this group using existing helper
              await renderTaskNotesInBasesView(list, tasks, plugin, { extraPropertiesRows: extraRows as any });

              itemsContainer.appendChild(section);
              groupSections.push(section);
            }

            // After creating all groups, add expand/collapse all buttons matching Task List behavior
            try {
              const { GroupingUtils } = await import('../utils/GroupingUtils');
              const { BASES_TASK_LIST_VIEW_TYPE } = await import('../types');
              const groupingKeyForButtons = `bases:${groupCfg.normalizedId}`;

              // Expand All button
              const expandAllBtn = new ButtonComponent(controls)
                .setIcon('list-tree')
                .setTooltip('Expand All Groups')
                .setClass('filter-bar__expand-groups');
              (expandAllBtn as any).buttonEl.classList.add('clickable-icon');
              expandAllBtn.onClick(() => {
                for (const section of groupSections) {
                  section.classList.remove('is-collapsed');
                  const list = section.querySelector('.task-cards') as HTMLElement | null;
                  if (list) list.style.display = '';
                  const name = section.getAttribute('data-group') || '';
                  GroupingUtils.setGroupCollapsed(BASES_TASK_LIST_VIEW_TYPE, groupingKeyForButtons, name, false, plugin);
                  const btn = section.querySelector('.task-group-toggle');
                  btn?.setAttribute('aria-expanded', 'true');
                }
              });

              // Collapse All button
              const collapseAllBtn = new ButtonComponent(controls)
                .setIcon('list-collapse')
                .setTooltip('Collapse All Groups')
                .setClass('filter-bar__collapse-groups');
              (collapseAllBtn as any).buttonEl.classList.add('clickable-icon');
              collapseAllBtn.onClick(() => {
                const names = groupSections.map(s => s.getAttribute('data-group') || '');
                for (const section of groupSections) {
                  const list = section.querySelector('.task-cards') as HTMLElement | null;
                  const hasTasks = !!list && list.children.length > 0;
                  if (hasTasks) {
                    section.classList.add('is-collapsed');
                    if (list) list.style.display = 'none';
                    const btn = section.querySelector('.task-group-toggle');
                    btn?.setAttribute('aria-expanded', 'false');
                  }
                }
                GroupingUtils.collapseAllGroups(BASES_TASK_LIST_VIEW_TYPE, groupingKeyForButtons, names, plugin);
              });

              // Add "+New" button after expand/collapse buttons
              addNewTaskButton();
            } catch (_) { /* ignore */ }
          } else {
            // No groupBy configured -> flat list, but still apply Bases sort if present
            const { getBasesSortComparator } = await import('./sorting');
            const cmp = getBasesSortComparator(basesContainer as any, pathToProps);
            const toRender = cmp ? [...searchedTasks].sort(cmp) : searchedTasks;
            await renderTaskNotesInBasesView(itemsContainer, toRender, plugin, { extraPropertiesRows: extraRows as any });

            // Add "+New" button for flat list view
            addNewTaskButton();
          }
        }
      } catch (error: any) {
        console.error('[TaskNotes][BasesPOC] Error rendering Bases data:', error);
        const errorEl = document.createElement('div');
        errorEl.className = 'tn-bases-error';
        errorEl.style.cssText = 'padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;';
        root.appendChild(errorEl);
      }
    };

    // Build component with lifecycle hooks
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
    // Do not override onResize; use class method

    // Kick off initial async render
    void render();

    return component as any;
  };
}

