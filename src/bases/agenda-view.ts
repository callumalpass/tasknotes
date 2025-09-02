import TaskNotesPlugin from '../main';
import { TextComponent, debounce, setTooltip, ButtonComponent, setIcon } from 'obsidian';
import { BasesDataItem, identifyTaskNotesFromBasesData, renderTaskNotesInBasesView } from './helpers';
import { getTaskNotesTasklistRows } from './tasklist-rows';
import { buildSearchIndex, filterTasksBySearch } from './search';
import { TaskNotesBasesTaskListComponent } from './component';
import { GroupCountUtils } from '../utils/GroupCountUtils';
import { GroupingUtils } from '../utils/GroupingUtils';
import { BASES_TASK_LIST_VIEW_TYPE } from '../types';
import { addDays, startOfWeek, endOfWeek } from 'date-fns';
import { convertUTCToLocalCalendarDate, createUTCDateFromLocalCalendarDate, formatDateForStorage, isTodayUTC } from '../utils/dateUtils';


export interface BasesContainerLike {
  results?: Map<any, any>;
  query?: { on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void };
  viewContainerEl?: HTMLElement;
}

// Simplified date extraction from task properties for grouping
function getTaskDates(props: Record<string, any>): string[] {
  const out: string[] = [];
  const due = props['due'] ?? props['note.due'];
  const scheduled = props['scheduled'] ?? props['note.scheduled'];
  const push = (v: any) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach((x) => { if (x) out.push(String(x)); });
    else out.push(String(v));
  };
  push(due);
  push(scheduled);
  // normalize to YYYY-MM-DD if possible (already expected)
  return out.filter(Boolean);
}

// Bases agenda period config: number of days or "week"; fallback to 7 days
function readAgendaPeriod(basesContainer: any, plugin: TaskNotesPlugin): { daysToShow: number; weekMode: boolean } {
  try {
    const controller = (basesContainer?.controller ?? basesContainer) as any;
    const query = (basesContainer?.query ?? controller?.query) as any;
    const fullCfg = controller?.getViewConfig?.() ?? {};
    const data = (fullCfg as any)?.data ?? {};
    let raw = data['tasknotes.agenda']
      ?? data?.tasknotes?.agenda
      ?? (fullCfg as any)['tasknotes.agenda']
      ?? (fullCfg as any)?.tasknotes?.agenda;
    if (!raw) {
      try { raw = query?.getViewConfig?.('tasknotes.agenda') ?? (query?.getViewConfig?.('tasknotes') as any)?.agenda; } catch (_) {}
    }

    let period = (raw && typeof raw === 'object') ? (raw as any).period : raw;
    if (period === 'week') return { daysToShow: -1, weekMode: true };
    const n = parseInt(String(period ?? '7'), 10);
    if (!isNaN(n) && n > 0) return { daysToShow: n, weekMode: false };
  } catch (_) {}
  return { daysToShow: 7, weekMode: false };
}

function getAgendaDates(selectedDate: Date, daysToShow: number, firstDay: number): Date[] {
  const dates: Date[] = [];
  if (daysToShow === -1) {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: firstDay as 0|1|2|3|4|5|6 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: firstDay as 0|1|2|3|4|5|6 });
    let current = weekStart;
    while (current <= weekEnd) {
      const normalized = createUTCDateFromLocalCalendarDate(current);
      dates.push(normalized);
      current = addDays(current, 1);
    }
  } else {
    for (let i = 0; i < daysToShow; i++) {
      const target = addDays(selectedDate, i);
      const normalized = createUTCDateFromLocalCalendarDate(target);
      dates.push(normalized);
    }
  }
  return dates;
}

export function buildTasknotesAgendaViewFactory(plugin: TaskNotesPlugin) {
  return function tasknotesAgendaViewFactory(basesContainer: BasesContainerLike) {
    let currentRoot: HTMLElement | null = null;

    const viewContainerEl = (basesContainer as any)?.viewContainerEl as HTMLElement | undefined;
    if (!viewContainerEl) {
      console.error('[TaskNotes][BasesPOC] No viewContainerEl found');
      return { destroy: () => {} } as any;
    }

    viewContainerEl.innerHTML = '';

    // Root & controls
    const root = document.createElement('div');
    root.className = 'tn-bases-integration tasknotes-plugin tasknotes-container';
    viewContainerEl.appendChild(root);
    currentRoot = root;

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
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Search path | title | aliases';
      input.className = 'filter-bar__search-input';
      input.addEventListener('input', debounce(() => { currentSearchTerm = input.value; void render(); }, 800));
      controls.appendChild(input);
    }

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'tn-bases-items-container';
    itemsContainer.style.cssText = 'margin-top: 12px;';
    root.appendChild(itemsContainer);

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

        // Reset controls and container (preserve search input)
        itemsContainer.innerHTML = '';
        controls.querySelectorAll('.filter-bar__expand-groups, .filter-bar__collapse-groups').forEach(el => el.remove());

        if (taskNotes.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'tn-bases-empty';
          empty.style.cssText = 'padding: 20px; text-align: center; color: #666;';
          empty.textContent = 'No TaskNotes tasks found for this Base.';
          itemsContainer.appendChild(empty);
          return;
        }

        // path -> props for property rendering
        const pathToProps = new Map<string, Record<string, any>>(
          dataItems.filter(i => !!i.path).map(i => [i.path!, (i as any).properties || (i as any).frontmatter || {}])
        );

        // Extra property rows
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
          const v = (props as any)['note.aliases'] ?? (props as any)['aliases'];
          if (Array.isArray(v)) return v.filter((x: any) => !!x).map(String);
          if (typeof v === 'string' && v.trim()) return [v];
          return [];
        };
        const searchIndex = buildSearchIndex(taskNotes, { getAliases });

        // Compute agenda dates exactly like AgendaView
        const selected = new Date(plugin.selectedDate);
        const firstDay = (plugin.settings?.calendarViewSettings?.firstDay ?? 0) as number;
        const { daysToShow } = readAgendaPeriod(basesContainer as any, plugin);
        const agendaDates = getAgendaDates(selected, daysToShow, firstDay);

        // Build a base query similar to AgendaView
        const baseQuery: any = {
          type: 'group', id: 'bases-agenda', conjunction: 'and', children: [],
          sortKey: 'due', sortDirection: 'asc', groupKey: 'none'
        };

        // Gather tasks per day using FilterService when available, else fallback to raw tasks
        const agendaData: Array<{ date: Date; tasks: any[] }> = [];
        for (const date of agendaDates) {
          if ((plugin as any).filterService?.getTasksForDate) {
            try {
              const tasksForDate = await (plugin as any).filterService.getTasksForDate(date, baseQuery, true);
              agendaData.push({ date, tasks: filterTasksBySearch(tasksForDate, searchIndex, currentSearchTerm) });
            } catch {
              // Fallback: approximate by checking task props against this date
              const dayKey = formatDateForStorage(date);
              const approx = taskNotes.filter(t => {
                const props = pathToProps.get(t.path) || {};
                const keys = getTaskDates(props);
                return keys.includes(dayKey);
              });
              agendaData.push({ date, tasks: filterTasksBySearch(approx, searchIndex, currentSearchTerm) });
            }
          } else {
            const dayKey = formatDateForStorage(date);
            const approx = taskNotes.filter(t => {
              const props = pathToProps.get(t.path) || {};
              const keys = getTaskDates(props);
              return keys.includes(dayKey);
            });
            agendaData.push({ date, tasks: filterTasksBySearch(approx, searchIndex, currentSearchTerm) });
          }
        }

        // Render sections in chronological order with Agenda header styling
        const groupSections: HTMLElement[] = [];
        for (const { date, tasks } of agendaData) {
          const hasItems = (tasks?.length || 0) > 0;
          if (!hasItems) continue;

          const dayKey = formatDateForStorage(date);

          const section = document.createElement('section');
          section.className = 'agenda-view__day-section task-group';
          section.setAttribute('data-day', dayKey);

          // Header (similar to AgendaView.createDayHeader)
          const header = document.createElement('div');
          header.className = 'agenda-view__day-header task-group-header';
          header.setAttribute('data-day', dayKey);

          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'task-group-toggle';
          toggleBtn.setAttribute('aria-label', 'Toggle day');
          try { setIcon(toggleBtn, 'chevron-right'); } catch (_) {}
          const svg = toggleBtn.querySelector('svg');
          if (svg) { svg.classList.add('chevron'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); } else { toggleBtn.textContent = '▸'; }
          header.appendChild(toggleBtn);

          // Add a consistent group label span used by tests and for copyable day key
          const labelSpan = document.createElement('span');
          labelSpan.className = 'tn-bases-group-label';
          labelSpan.textContent = dayKey;
          header.appendChild(labelSpan);

          const headerText = document.createElement('div');
          headerText.className = 'agenda-view__day-header-text';
          const displayDate = convertUTCToLocalCalendarDate(date);
          const { format } = await import('date-fns');
          const dayName = format(displayDate, 'EEEE');
          const dateFormatted = format(displayDate, 'MMMM d');
          if (isTodayUTC(date)) {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'agenda-view__day-name agenda-view__day-name--today';
            nameSpan.textContent = 'Today';
            headerText.appendChild(nameSpan);
            const dateSpan = document.createElement('span');
            dateSpan.className = 'agenda-view__day-date';
            dateSpan.textContent = ` • ${dateFormatted}`;
            headerText.appendChild(dateSpan);
          } else {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'agenda-view__day-name';
            nameSpan.textContent = dayName;
            headerText.appendChild(nameSpan);
            const dateSpan = document.createElement('span');
            dateSpan.className = 'agenda-view__day-date';
            dateSpan.textContent = ` • ${dateFormatted}`;
            headerText.appendChild(dateSpan);
          }
          header.appendChild(headerText);

          // Count badge (tasks completion)
          const stats = GroupCountUtils.calculateGroupStats(tasks as any, plugin);
          const countSpan = document.createElement('span');
          countSpan.className = 'agenda-view__item-count';
          countSpan.textContent = `${GroupCountUtils.formatGroupCount(stats.completed, stats.total).text}`;
          header.appendChild(countSpan);

          section.appendChild(header);

          const list = document.createElement('div');
          list.className = 'agenda-view__day-items';
          section.appendChild(list);

          const collapsedInitially = GroupingUtils.isGroupCollapsed(
            BASES_TASK_LIST_VIEW_TYPE,
            'bases:agenda',
            dayKey,
            plugin
          );
          if (collapsedInitially) {
            section.classList.add('is-collapsed');
            list.style.display = 'none';
          }
          toggleBtn.setAttribute('aria-expanded', String(!collapsedInitially));

          const toggle = () => {
            const willCollapse = !section.classList.contains('is-collapsed');
            GroupingUtils.setGroupCollapsed(BASES_TASK_LIST_VIEW_TYPE, 'bases:agenda', dayKey, willCollapse, plugin);
            section.classList.toggle('is-collapsed', willCollapse);
            list.style.display = willCollapse ? 'none' : '';
            toggleBtn.setAttribute('aria-expanded', String(!willCollapse));
          };
          header.addEventListener('click', (e) => { const target = e.target as HTMLElement; if (target.closest('a')) return; toggle(); });
          toggleBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });

          await renderTaskNotesInBasesView(list, tasks as any, plugin, { extraPropertiesRows: extraRows as any });

          itemsContainer.appendChild(section);
          groupSections.push(section);
        }

        // Expand/Collapse all
        try {
          const expandAllBtn = new ButtonComponent(controls)
            .setIcon('list-tree')
            .setTooltip('Expand All Groups')
            .setClass('filter-bar__expand-groups');
          (expandAllBtn as any).buttonEl.classList.add('clickable-icon');
          expandAllBtn.onClick(() => {
            for (const section of groupSections) {
              section.classList.remove('is-collapsed');
              const list = section.querySelector('.agenda-view__day-items') as HTMLElement | null;
              if (list) list.style.display = '';
              const name = section.getAttribute('data-day') || '';
              GroupingUtils.setGroupCollapsed(BASES_TASK_LIST_VIEW_TYPE, 'bases:agenda', name, false, plugin);
              const btn = section.querySelector('.task-group-toggle');
              btn?.setAttribute('aria-expanded', 'true');
            }
          });

          const collapseAllBtn = new ButtonComponent(controls)
            .setIcon('list-collapse')
            .setTooltip('Collapse All Groups')
            .setClass('filter-bar__collapse-groups');
          (collapseAllBtn as any).buttonEl.classList.add('clickable-icon');
          collapseAllBtn.onClick(() => {
            const names = groupSections.map(s => s.getAttribute('data-day') || '');
            for (const section of groupSections) {
              const list = section.querySelector('.agenda-view__day-items') as HTMLElement | null;
              const hasTasks = !!list && list.children.length > 0;
              if (hasTasks) {
                section.classList.add('is-collapsed');
                if (list) list.style.display = 'none';
                const btn = section.querySelector('.task-group-toggle');
                btn?.setAttribute('aria-expanded', 'false');
              }
            }
            GroupingUtils.collapseAllGroups(BASES_TASK_LIST_VIEW_TYPE, 'bases:agenda', names, plugin);
          });
        } catch (_) { /* ignore */ }
      } catch (error) {
        console.error('[TaskNotes][BasesPOC] Error rendering Bases Agenda:', error);
      }
    };

    const component = new TaskNotesBasesTaskListComponent({
      getContainer: () => currentRoot,
      setContainer: (el) => { currentRoot = el; },
      refresh: render,
      attachQueryListener: (handler) => (basesContainer as any)?.query?.on?.('change', handler),
      detachQueryListener: (handler) => (basesContainer as any)?.query?.off?.('change', handler)
    });

    (component as any).load = component.onload.bind(component);
    (component as any).unload = component.onunload.bind(component);

    void render();

    return component as any;
  };
}

