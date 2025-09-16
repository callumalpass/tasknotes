import { App, Notice, setIcon, AbstractInputSuggest, setTooltip, parseFrontMatterAliases } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskModal } from './TaskModal';
import { TaskInfo, TaskCreationData } from '../types';
import { getCurrentTimestamp } from '../utils/dateUtils';
import { generateTaskFilename, FilenameContext } from '../utils/filenameGenerator';
import { calculateDefaultDate, sanitizeTags } from '../utils/helpers';
import { NaturalLanguageParser, ParsedTaskData as NLParsedTaskData } from '../services/NaturalLanguageParser';
import { StatusSuggestionService, StatusSuggestion } from '../services/StatusSuggestionService';
import { combineDateAndTime } from '../utils/dateUtils';
import { splitListPreservingLinksAndQuotes } from '../utils/stringSplit';
import { ProjectMetadataResolver, ProjectEntry } from '../utils/projectMetadataResolver';
import { parseDisplayFieldsRow } from '../utils/projectAutosuggestDisplayFieldsParser';

interface TriggerDetectionResult {
    trigger: '@' | '#' | '+' | null;
    triggerIndex: number;
    queryAfterTrigger: string;
}

/**
 * Pure function to detect suggestion triggers in text
 * @param textBeforeCursor - Text before cursor position
 * @returns Trigger detection result with trigger type, index, and query
 */
function detectSuggestionTrigger(textBeforeCursor: string): TriggerDetectionResult {
    // Find the last @, #, or + before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    const lastPlusIndex = textBeforeCursor.lastIndexOf('+');

    let triggerIndex = -1;
    let trigger: '@' | '#' | '+' | null = null;

    // Find the most recent trigger
    if (lastAtIndex >= lastHashIndex && lastAtIndex >= lastPlusIndex && lastAtIndex !== -1) {
        triggerIndex = lastAtIndex;
        trigger = '@';
    } else if (lastHashIndex >= lastPlusIndex && lastHashIndex !== -1) {
        triggerIndex = lastHashIndex;
        trigger = '#';
    } else if (lastPlusIndex !== -1) {
        triggerIndex = lastPlusIndex;
        trigger = '+';
    }

    // Extract the query after the trigger
    const queryAfterTrigger = triggerIndex !== -1 ? textBeforeCursor.slice(triggerIndex + 1) : '';

    return {
        trigger,
        triggerIndex,
        queryAfterTrigger
    };
}

export interface TaskCreationOptions {
    prePopulatedValues?: Partial<TaskInfo>;
    onTaskCreated?: (task: TaskInfo) => void;
}

/**
 * Auto-suggestion provider for NLP textarea with @, #, and + triggers
 * @ = contexts, # = tags, + = wikilinks to vault files
 */
interface ProjectSuggestion {
    basename: string;
    displayName: string;
    type: 'project';
    toString(): string;
}

interface TagSuggestion {
    value: string;
    display: string;
    type: 'tag';
    toString(): string;
}

interface ContextSuggestion {
    value: string;
    display: string;
    type: 'context';
    toString(): string;
}



class NLPSuggest extends AbstractInputSuggest<TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion> {
    private plugin: TaskNotesPlugin;
    private textarea: HTMLTextAreaElement;
    private currentTrigger: '@' | '#' | '+' | 'status' | null = null;
    // Store app reference explicitly to avoid relying on plugin.app in tests and runtime
    private obsidianApp: App;
    constructor(app: App, textareaEl: HTMLTextAreaElement, plugin: TaskNotesPlugin) {
        super(app, textareaEl as unknown as HTMLInputElement);
        this.plugin = plugin;
        this.textarea = textareaEl;
        this.obsidianApp = app;
    }

    protected async getSuggestions(query: string): Promise<(TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion)[]> {
        // Get cursor position and text around it
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCursor = this.textarea.value.slice(0, cursorPos);

        // Find the last @, #, +, or custom status trigger before cursor
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        const lastHashIndex = textBeforeCursor.lastIndexOf('#');
        const lastPlusIndex = textBeforeCursor.lastIndexOf('+');
        const statusTrig = (this.plugin.settings.statusSuggestionTrigger || '').trim();
        const lastStatusIndex = statusTrig ? textBeforeCursor.lastIndexOf(statusTrig) : -1;

        let triggerIndex = -1;
        let trigger: '@' | '#' | '+' | 'status' | null = null;

        // Helper: boundary check for multi-char trigger
        const isBoundary = (index: number) => {
            if (index === -1) return false;
            if (index === 0) return true;
            const prev = textBeforeCursor[index - 1];
            return !/\w/.test(prev);
        };

        // Determine most recent valid trigger by index
        const candidates: Array<{type: '@'|'#'|'+'|'status'; index: number}> = [
            { type: '@' as const, index: lastAtIndex },
            { type: '#' as const, index: lastHashIndex },
            { type: '+' as const, index: lastPlusIndex },
            { type: 'status' as const, index: lastStatusIndex }
        ].filter(c => isBoundary(c.index));

        if (candidates.length === 0) {
            this.currentTrigger = null;
            return [];
        }

        candidates.sort((a,b) => b.index - a.index);
        triggerIndex = candidates[0].index;
        trigger = candidates[0].type;

        // Extract the query after the trigger (respect multi-char trigger for status)
        const offset = trigger === 'status' ? (statusTrig?.length || 0) : 1;
        const queryAfterTrigger = textBeforeCursor.slice(triggerIndex + offset);

        // If '+' trigger already has a completed wikilink (+[[...]]), do not suggest again
        if (trigger === '+' && /^\[\[[^\]]*\]\]/.test(queryAfterTrigger)) {
            this.currentTrigger = null;
            return [];
        }

        // Check if there's a space in the query (which would end the suggestion context)
        // For '+' (projects/wikilinks), allow spaces for multi-word fuzzy queries
        if ((trigger === '@' || trigger === '#' || trigger === 'status') && (queryAfterTrigger.includes(' ') || queryAfterTrigger.includes('\n'))) {
            this.currentTrigger = null;
            return [];
        }
        this.currentTrigger = trigger;

        // Get suggestions based on trigger type
        if (trigger === '@') {
            const contexts = this.plugin.cacheManager.getAllContexts();
            return contexts
                .filter(context => context && typeof context === 'string')
                .filter(context =>
                    context.toLowerCase().includes(queryAfterTrigger.toLowerCase())
                )
                .slice(0, 10)
                .map(context => ({
                    value: context,
                    display: context,
                    type: 'context' as const,
                    toString() { return this.value; }
                }));
        } else if (trigger === 'status') {
            // Use the StatusSuggestionService for status suggestions
            const statusService = new StatusSuggestionService(
                this.plugin.settings.customStatuses,
                this.plugin.settings.customPriorities,
                this.plugin.settings.nlpDefaultToScheduled,
                this.plugin.settings.nlpLanguage
            );
            return statusService.getStatusSuggestions(
                queryAfterTrigger,
                this.plugin.settings.customStatuses || [],
                10
            );
        } else if (trigger === '#') {
            const tags = this.plugin.cacheManager.getAllTags();
            return tags
                .filter(tag => tag && typeof tag === 'string')
                .filter(tag =>
                    tag.toLowerCase().includes(queryAfterTrigger.toLowerCase())
                )
                .slice(0, 10)
                .map(tag => ({
                    value: tag,
                    display: tag,
                    type: 'tag' as const,
                    toString() { return this.value; }
                }));
        } else if (trigger === '+') {
            // Use FileSuggestHelper for multi-word support with enhanced project autosuggest cards and |s flag support
            const { FileSuggestHelper } = await import('../suggest/FileSuggestHelper');

            // Apply excluded folders filter to FileSuggestHelper
            const excluded = (this.plugin.settings.excludedFolders || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            // Get suggestions using FileSuggestHelper (with multi-word support)
            const list = await FileSuggestHelper.suggest(this.plugin, queryAfterTrigger);

            // Filter out excluded folders
            const filteredList = list.filter(item => {
                // Find the corresponding file to check its path
                const appRef: App | undefined = (this as any).obsidianApp ?? (this as any).app ?? this.plugin?.app;
                const file = appRef?.vault.getMarkdownFiles().find(f => f.basename === item.insertText);
                if (!file) return true; // Keep if we can't find the file
                return !excluded.some(folder => file.path.startsWith(folder));
            });

            // Robustly resolve app reference for both runtime and tests
            const appRef: App | undefined = (this as any).obsidianApp ?? (this as any).app ?? this.plugin?.app;

            try {
                // Convert to enhanced project suggestions with configurable cards and |s flag support
                const resolver = new ProjectMetadataResolver({
                    getFrontmatter: (entry) => {
                        // entry.path refers to a markdown file path
                        const file = appRef?.vault.getAbstractFileByPath(entry.path);
                        // @ts-ignore obsidian typing: we only read cache.frontmatter
                        const cache = file ? appRef?.metadataCache.getFileCache(file as any) : undefined;
                        return cache?.frontmatter || {};
                    },
                });

                const rowConfigs = (this.plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);

                return filteredList.map(item => {
                    // Find the corresponding file for enhanced metadata
                    const file = appRef?.vault.getMarkdownFiles().find(f => f.basename === item.insertText);
                    if (!file) {
                        // Fallback to basic suggestion if file not found
                        return {
                            basename: item.insertText,
                            displayName: item.displayText,
                            type: 'project' as const,
                            toString() { return this.basename; }
                        };
                    }

                    const cache = appRef?.metadataCache.getFileCache(file);
                    const frontmatter = cache?.frontmatter || {};
                    const mapped = this.plugin.fieldMapper.mapFromFrontmatter(frontmatter, file.path, this.plugin.settings.storeTitleInFilename);

                    // Derive title and aliases for display
                    const title = typeof mapped.title === 'string' ? mapped.title : '';
                    const aliasesFm = parseFrontMatterAliases(frontmatter) || [];
                    const aliases = Array.isArray(aliasesFm) ? aliasesFm.filter(a => typeof a === 'string') as string[] : [];

                    const fileData = {
                        basename: file.basename,
                        name: file.name,
                        path: file.path,
                        parent: file.parent?.path || '',
                        title,
                        aliases,
                        frontmatter: frontmatter
                    };

                    // Generate enhanced display name using configured rows
                    const generateDisplayName = (rows: string[], item: any, resolver: ProjectMetadataResolver): string => {
                        const lines: string[] = [];
                        for (const row of rows) {
                            try {
                                const tokens = parseDisplayFieldsRow(row);
                                const parts: string[] = [];
                                for (const token of tokens) {
                                    if (token.property.startsWith('literal:')) {
                                        parts.push(token.property.slice(8));
                                        continue;
                                    }
                                    const value = resolver.resolve(token.property, item) || '';
                                    if (!value) continue;
                                    if (token.showName) {
                                        const label = token.displayName ?? token.property;
                                        parts.push(`${label}: ${value}`);
                                    } else {
                                        parts.push(value);
                                    }
                                }
                                const line = parts.join(' ');
                                if (line.trim()) lines.push(line);
                            } catch {
                                // Skip invalid rows
                            }
                        }
                        return lines.join(' | ') || file.basename;
                    };

                    const displayName = generateDisplayName(rowConfigs, fileData, resolver);

                    return {
                        basename: item.insertText,
                        displayName: displayName,
                        type: 'project' as const,
                        entry: {
                            basename: fileData.basename,
                            name: fileData.name,
                            path: fileData.path,
                            parent: fileData.parent,
                            title: fileData.title,
                            aliases: fileData.aliases,
                            frontmatter: fileData.frontmatter
                        },
                        toString() { return this.basename; }
                    } as ProjectSuggestion;
                });
            } catch (err) {
                console.error('Enhanced project autosuggest failed, falling back to basic suggestions', err);
                return filteredList.map(item => ({
                    basename: item.insertText,
                    displayName: item.displayText,
                    type: 'project' as const,
                    toString() { return this.basename; }
                }));
            }
        }

        return [];
    }

    public renderSuggestion(suggestion: TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion, el: HTMLElement): void {
        const icon = el.createSpan('nlp-suggest-icon');
        icon.textContent = this.currentTrigger === 'status' ? (this.plugin.settings.statusSuggestionTrigger || '') : (this.currentTrigger || '');

        const text = el.createSpan('nlp-suggest-text');

        // Helper: highlight all occurrences (multi-word)
        const highlightOccurrences = (container: HTMLElement, query: string) => {
            if (!query) return;
            const words = query.toLowerCase().split(/\s+/).filter(Boolean);
            if (!words.length) return;
            const walk = (node: Node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const original = node.nodeValue || '';
                    const lower = original.toLowerCase();
                    const matches: Array<{start:number,end:number}> = [];
                    for (const w of words) {
                        let idx = lower.indexOf(w);
                        while (idx !== -1) { matches.push({start: idx, end: idx + w.length}); idx = lower.indexOf(w, idx + 1); }
                    }
                    matches.sort((a,b)=>a.start-b.start);
                    const filtered: typeof matches = [];
                    for (const m of matches) { if (!filtered.length || m.start >= filtered[filtered.length-1].end) filtered.push(m); }
                    if (!filtered.length) return;
                    const frag = document.createDocumentFragment();
                    let last = 0;
                    for (const m of filtered) {
                        if (m.start > last) frag.appendChild(document.createTextNode(original.slice(last, m.start)));
                        const mark = document.createElement('mark');
                        mark.textContent = original.slice(m.start, m.end);
                        frag.appendChild(mark);
                        last = m.end;
                    }
                    if (last < original.length) frag.appendChild(document.createTextNode(original.slice(last)));
                    node.parentNode?.replaceChild(frag, node);
                } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName !== 'MARK') {
                    const children = Array.from(node.childNodes);
                    for (const c of children) walk(c);
                }
            };
            walk(container);
        };

        // Determine active +query to highlight
        let activeQuery = '';
        if (this.currentTrigger === '+') {
            const cursorPos = this.textarea.selectionStart;
            const before = this.textarea.value.slice(0, cursorPos);
            const lastPlus = before.lastIndexOf('+');
            if (lastPlus !== -1) {
                const after = before.slice(lastPlus + 1);
                if (after && !after.includes('\n')) activeQuery = after.trim();
            }
        }

        if (suggestion.type === 'project') {
            // Multi-line card: first line = filename, extra lines from config
            const filenameRow = text.createDiv({ cls: 'nlp-suggest-project__filename', text: suggestion.basename });
            if (activeQuery) highlightOccurrences(filenameRow, activeQuery);

            const cfg = (this.plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);
            if (Array.isArray(cfg) && cfg.length > 0 && (suggestion as any).entry) {
                const resolver = new ProjectMetadataResolver({ getFrontmatter: (e) => (e as ProjectEntry).frontmatter });
                for (let i = 0; i < Math.min(cfg.length, 3); i++) {
                    const row = cfg[i]; if (!row) continue;
                    try {
                        const tokens = parseDisplayFieldsRow(row);
                        const metaRow = text.createDiv({ cls: 'nlp-suggest-project__meta' });
                        const ALWAYS = new Set(['title','aliases','file.basename']);
                        let appended = false;
                        for (const t of tokens) {
                            if (t.property.startsWith('literal:')) {
                                const lit = t.property.slice(8);
                                if (lit) { if (metaRow.childNodes.length) metaRow.appendChild(document.createTextNode(' ')); metaRow.appendChild(document.createTextNode(lit)); appended = true; }
                                continue;
                            }
                            const value = resolver.resolve(t.property, (suggestion as any).entry);
                            if (!value) continue;
                            if (metaRow.childNodes.length) metaRow.appendChild(document.createTextNode(' '));
                            if (t.showName) {
                                const labelSpan = document.createElement('span');
                                labelSpan.className = 'nlp-suggest-project__meta-label';
                                labelSpan.textContent = `${t.displayName ?? t.property}:`;
                                metaRow.appendChild(labelSpan);
                                metaRow.appendChild(document.createTextNode(' '));
                            }
                            const valueSpan = document.createElement('span');
                            valueSpan.className = 'nlp-suggest-project__meta-value';
                            valueSpan.textContent = value;
                            metaRow.appendChild(valueSpan);
                            appended = true;
                            const searchable = (t as any).searchable === true || ALWAYS.has(t.property);
                            if (activeQuery && searchable) highlightOccurrences(valueSpan, activeQuery);
                        }
                        if (!appended || metaRow.textContent?.trim().length === 0) metaRow.remove();
                    } catch {/* ignore row parse errors */}
                }
            }
        } else if (suggestion.type === 'status') {
            text.textContent = suggestion.display;
        } else {
            text.textContent = suggestion.display;
        }
    }

    public selectSuggestion(suggestion: TagSuggestion | ContextSuggestion | ProjectSuggestion | StatusSuggestion): void {
        if (!this.currentTrigger) return;

        const cursorPos = this.textarea.selectionStart;
        const textBeforeCursor = this.textarea.value.slice(0, cursorPos);
        const textAfterCursor = this.textarea.value.slice(cursorPos);

        // Find the last trigger position (handle custom status trigger length)
        let lastTriggerIndex = -1;
        const statusTrig = (this.plugin.settings.statusSuggestionTrigger || '').trim();
        if (this.currentTrigger === '@') {
            lastTriggerIndex = textBeforeCursor.lastIndexOf('@');
        } else if (this.currentTrigger === '#') {
            lastTriggerIndex = textBeforeCursor.lastIndexOf('#');
        } else if (this.currentTrigger === '+') {
            lastTriggerIndex = textBeforeCursor.lastIndexOf('+');
        } else if (this.currentTrigger === 'status' && statusTrig) {
            lastTriggerIndex = textBeforeCursor.lastIndexOf(statusTrig);
        }

        if (lastTriggerIndex === -1) return;

        // Get the actual suggestion text to insert
        const suggestionText = suggestion.type === 'project' ? suggestion.basename : suggestion.value;

        // Replace the trigger and partial text with the full suggestion
        const beforeTrigger = textBeforeCursor.slice(0, lastTriggerIndex);
        let replacement = '';

        if (this.currentTrigger === '+') {
            // For project (+) trigger, wrap in wikilink syntax but keep the + sign
            replacement = '+[[' + suggestionText + ']]';
        } else if (this.currentTrigger === 'status') {
            // For status: insert the label text (like other suggestions)
            replacement = suggestion.type === 'status' ? suggestion.label : suggestionText;
        } else {
            // For @ and #, keep the trigger and the suggestion
            replacement = this.currentTrigger + suggestionText;
        }

        const newText = beforeTrigger + replacement + (replacement ? ' ' : '') + textAfterCursor;

        this.textarea.value = newText;

        // Set cursor position after the inserted suggestion
        const newCursorPos = beforeTrigger.length + replacement.length + (replacement ? 1 : 0);
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);

        // Trigger input event to update preview
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        this.textarea.focus();
    }
}

export class TaskCreationModal extends TaskModal {
    private options: TaskCreationOptions;
    private nlParser: NaturalLanguageParser;
    private statusSuggestionService: StatusSuggestionService;
    private nlInput: HTMLTextAreaElement;
    private nlPreviewContainer: HTMLElement;
    private nlButtonContainer: HTMLElement;
    private nlpSuggest: NLPSuggest;

    constructor(
        app: App,
        plugin: TaskNotesPlugin,
        options: TaskCreationOptions = {},
        statusSuggestionService?: StatusSuggestionService // Optional for backward compatibility
    ) {
        super(app, plugin);
        this.options = options;
        this.nlParser = new NaturalLanguageParser(
            plugin.settings.customStatuses,
            plugin.settings.customPriorities,
            plugin.settings.nlpDefaultToScheduled,
            plugin.settings.nlpLanguage
        );

        // Use injected service or create default one
        this.statusSuggestionService = statusSuggestionService || new StatusSuggestionService(
            plugin.settings.customStatuses,
            plugin.settings.customPriorities,
            plugin.settings.nlpDefaultToScheduled,
            plugin.settings.nlpLanguage
        );
    }

    getModalTitle(): string {
        return 'Create task';
    }

    protected createModalContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Create main container
        const container = contentEl.createDiv('minimalist-modal-container');

        // Create NLP input as primary interface (if enabled)
        if (this.plugin.settings.enableNaturalLanguageInput) {
            this.createNaturalLanguageInput(container);
        } else {
            // Fall back to regular title input
            this.createTitleInput(container);
            // When NLP is disabled, start with the modal expanded
            this.isExpanded = true;
            this.containerEl.addClass('expanded');
        }

        // Create action bar with icons
        this.createActionBar(container);

        // Create collapsible details section
        this.createDetailsSection(container);

        // Re-render projects list if pre-populated values were applied or defaults are set
        if ((this.options.prePopulatedValues && this.options.prePopulatedValues.projects) ||
            this.selectedProjectFiles.length > 0) {
            this.renderProjectsList();
        }

        // Create save/cancel buttons
        this.createActionButtons(container);
    }

    private createNaturalLanguageInput(container: HTMLElement): void {
        const nlContainer = container.createDiv('nl-input-container');

        // Create minimalist input field
        this.nlInput = nlContainer.createEl('textarea', {
            cls: 'nl-input',
            attr: {
                placeholder: 'Buy groceries tomorrow at 3pm @home #errands\n\nAdd details here...',
                rows: '3'
            }
        });

        // Preview container
        this.nlPreviewContainer = nlContainer.createDiv('nl-preview-container');

        // Event listeners
        this.nlInput.addEventListener('input', () => {
            const input = this.nlInput.value.trim();
            if (input) {
                this.updateNaturalLanguagePreview(input);
            } else {
                this.clearNaturalLanguagePreview();
            }
        });

        // Keyboard shortcuts
        this.nlInput.addEventListener('keydown', (e) => {
            const input = this.nlInput.value.trim();
            if (!input) return;

            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleSave();
            } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                this.parseAndFillForm(input);
            }
        });

        // Initialize auto-suggestion
        this.nlpSuggest = new NLPSuggest(this.app, this.nlInput, this.plugin);

        // Focus the input
        setTimeout(() => {
            this.nlInput.focus();
        }, 100);
    }

    private updateNaturalLanguagePreview(input: string): void {
        if (!this.nlPreviewContainer) return;

        const parsed = this.nlParser.parseInput(input);
        const previewData = this.nlParser.getPreviewData(parsed);

        if (previewData.length > 0 && parsed.title) {
            this.nlPreviewContainer.empty();
            this.nlPreviewContainer.style.display = 'block';

            previewData.forEach((item) => {
                const previewItem = this.nlPreviewContainer.createDiv('nl-preview-item');
                previewItem.textContent = item.text;
            });
        } else {
            this.clearNaturalLanguagePreview();
        }
    }

    private clearNaturalLanguagePreview(): void {
        if (this.nlPreviewContainer) {
            this.nlPreviewContainer.empty();
            this.nlPreviewContainer.style.display = 'none';
        }
    }

    protected createActionBar(container: HTMLElement): void {
        this.actionBar = container.createDiv('action-bar');

        // NLP-specific icons (only if NLP is enabled)
        if (this.plugin.settings.enableNaturalLanguageInput) {
            // Fill form icon
            this.createActionIcon(this.actionBar, 'wand', 'Fill form from natural language', (icon, event) => {
                const input = this.nlInput?.value.trim();
                if (input) {
                    this.parseAndFillForm(input);
                }
            });

            // Expand/collapse icon
            this.createActionIcon(this.actionBar, this.isExpanded ? 'chevron-up' : 'chevron-down',
                this.isExpanded ? 'Hide detailed options' : 'Show detailed options', (icon, event) => {
                this.toggleDetailedForm();
                // Update icon and tooltip
                const iconEl = icon.querySelector('.icon');
                if (iconEl) {
                    setIcon(iconEl as HTMLElement, this.isExpanded ? 'chevron-up' : 'chevron-down');
                }
                setTooltip(icon, this.isExpanded ? 'Hide detailed options' : 'Show detailed options', { placement: 'top' });
            });

            // Add separator
            const separator = this.actionBar.createDiv('action-separator');
            separator.style.width = '1px';
            separator.style.height = '24px';
            separator.style.backgroundColor = 'var(--background-modifier-border)';
            separator.style.margin = '0 var(--size-4-2)';
        }

        // Due date icon
        this.createActionIcon(this.actionBar, 'calendar', 'Set due date', (icon, event) => {
            this.showDateContextMenu(event, 'due');
        }, 'due-date');

        // Scheduled date icon
        this.createActionIcon(this.actionBar, 'calendar-clock', 'Set scheduled date', (icon, event) => {
            this.showDateContextMenu(event, 'scheduled');
        }, 'scheduled-date');

        // Status icon
        this.createActionIcon(this.actionBar, 'dot-square', 'Set status', (icon, event) => {
            this.showStatusContextMenu(event);
        }, 'status');

        // Priority icon
        this.createActionIcon(this.actionBar, 'star', 'Set priority', (icon, event) => {
            this.showPriorityContextMenu(event);
        }, 'priority');

        // Recurrence icon
        this.createActionIcon(this.actionBar, 'refresh-ccw', 'Set recurrence', (icon, event) => {
            this.showRecurrenceContextMenu(event);
        }, 'recurrence');

        // Reminder icon
        this.createActionIcon(this.actionBar, 'bell', 'Set reminders', (icon, event) => {
            this.showReminderContextMenu(event);
        }, 'reminders');

        // Update icon states based on current values
        this.updateIconStates();
    }


    private parseAndFillForm(input: string): void {
        const parsed = this.statusSuggestionService.extractTaskDataFromInput(input);
        this.applyParsedData(parsed);

        // Expand the form to show filled fields
        if (!this.isExpanded) {
            this.expandModal();
        }
    }

    private applyParsedData(parsed: NLParsedTaskData): void {
        if (parsed.title) this.title = parsed.title;
        if (parsed.status) this.status = parsed.status;
        if (parsed.priority) this.priority = parsed.priority;

        // Handle due date with time
        if (parsed.dueDate) {
            this.dueDate = parsed.dueTime ? combineDateAndTime(parsed.dueDate, parsed.dueTime) : parsed.dueDate;
        }

        // Handle scheduled date with time
        if (parsed.scheduledDate) {
            this.scheduledDate = parsed.scheduledTime ? combineDateAndTime(parsed.scheduledDate, parsed.scheduledTime) : parsed.scheduledDate;
        }

        if (parsed.contexts && parsed.contexts.length > 0) this.contexts = parsed.contexts.join(', ');
        // Projects will be handled in the form input update section below
        if (parsed.tags && parsed.tags.length > 0) this.tags = sanitizeTags(parsed.tags.join(', '));
        if (parsed.details) this.details = parsed.details;
        if (parsed.recurrence) this.recurrenceRule = parsed.recurrence;
        if (parsed.estimate !== undefined) {
            this.timeEstimate = parsed.estimate > 0 ? parsed.estimate : 0;
            if (this.timeEstimateInput) {
                this.timeEstimateInput.value = this.timeEstimate > 0 ? this.timeEstimate.toString() : '';
            }
        }

        // Update form inputs if they exist
        if (this.titleInput) this.titleInput.value = this.title;
        if (this.detailsInput) this.detailsInput.value = this.details;
        if (this.contextsInput) this.contextsInput.value = this.contexts;
        if (this.tagsInput) this.tagsInput.value = this.tags;

        // Handle projects differently - they use file selection, not text input
        if (parsed.projects && parsed.projects.length > 0) {
            this.initializeProjectsFromStrings(parsed.projects);
            this.renderProjectsList();
        }

        // Update icon states
        this.updateIconStates();
    }

    private toggleDetailedForm(): void {
        if (this.isExpanded) {
            // Collapse
            this.isExpanded = false;
            this.detailsContainer.style.display = 'none';
            this.containerEl.removeClass('expanded');
        } else {
            // Expand
            this.expandModal();
        }
    }

    async initializeFormData(): Promise<void> {
        // Initialize with default values from settings
        this.priority = this.plugin.settings.defaultTaskPriority;
        this.status = this.plugin.settings.defaultTaskStatus;

        // Apply task creation defaults
        const defaults = this.plugin.settings.taskCreationDefaults;

        // Apply default due date
        this.dueDate = calculateDefaultDate(defaults.defaultDueDate);

        // Apply default scheduled date based on user settings
        this.scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);

        // Apply default contexts, tags, and projects
        this.contexts = defaults.defaultContexts || '';
        this.tags = defaults.defaultTags || '';

        // Apply default projects
        if (defaults.defaultProjects) {
            const projectStrings = splitListPreservingLinksAndQuotes(defaults.defaultProjects);
            if (projectStrings.length > 0) {
                this.initializeProjectsFromStrings(projectStrings);
            }
        }

        // Apply default time estimate
        if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
            this.timeEstimate = defaults.defaultTimeEstimate;
        }

        // Apply default reminders
        if (defaults.defaultReminders && defaults.defaultReminders.length > 0) {
            // Import the conversion function
            const { convertDefaultRemindersToReminders } = await import('../utils/settingsUtils');
            this.reminders = convertDefaultRemindersToReminders(defaults.defaultReminders);
        }

        // Apply pre-populated values if provided (overrides defaults)
        if (this.options.prePopulatedValues) {
            this.applyPrePopulatedValues(this.options.prePopulatedValues);
        }
    }

    private applyPrePopulatedValues(values: Partial<TaskInfo>): void {
        if (values.title !== undefined) this.title = values.title;
        if (values.due !== undefined) this.dueDate = values.due;
        if (values.scheduled !== undefined) this.scheduledDate = values.scheduled;
        if (values.priority !== undefined) this.priority = values.priority;
        if (values.status !== undefined) this.status = values.status;
        if (values.contexts !== undefined) {
            this.contexts = values.contexts.join(', ');
        }
        if (values.projects !== undefined) {
            // Filter out null, undefined, or empty strings before checking if we have valid projects
            const validProjects = values.projects.filter(p => p && typeof p === 'string' && p.trim() !== '');
            if (validProjects.length > 0) {
                this.initializeProjectsFromStrings(values.projects);
            }
            this.renderProjectsList();
        }
        if (values.tags !== undefined) {
            this.tags = sanitizeTags(values.tags.filter(tag => tag !== this.plugin.settings.taskTag).join(', '));
        }
        if (values.timeEstimate !== undefined) this.timeEstimate = values.timeEstimate;
        if (values.recurrence !== undefined && typeof values.recurrence === 'string') {
            this.recurrenceRule = values.recurrence;
        }
    }

    async handleSave(): Promise<void> {
        // If NLP is enabled and there's content in the NL field, parse it first
        if (this.plugin.settings.enableNaturalLanguageInput && this.nlInput) {
            const nlContent = this.nlInput.value.trim();
            if (nlContent && !this.title.trim()) {
                // Only auto-parse if no title has been manually entered
                const parsed = this.statusSuggestionService.extractTaskDataFromInput(nlContent);
                this.applyParsedData(parsed);
            }
        }

        if (!this.validateForm()) {
            new Notice('Please enter a task title');
            return;
        }

        try {
            const taskData = this.buildTaskData();
            const result = await this.plugin.taskService.createTask(taskData);

            // Check if filename was changed due to length constraints
            const expectedFilename = result.taskInfo.title.replace(/[<>:"/\\|?*]/g, '').trim();
            const actualFilename = result.file.basename;
            
            if (actualFilename.startsWith('task-') && actualFilename !== expectedFilename) {
                new Notice(`Task "${result.taskInfo.title}" created successfully (filename shortened due to length)`);
            } else {
                new Notice(`Task "${result.taskInfo.title}" created successfully`);
            }

            if (this.options.onTaskCreated) {
                this.options.onTaskCreated(result.taskInfo);
            }

            this.close();

        } catch (error) {
            console.error('Failed to create task:', error);
            new Notice('Failed to create task: ' + error.message);
        }
    }

    private buildTaskData(): Partial<TaskInfo> {
        const now = getCurrentTimestamp();

        // Parse contexts, projects, and tags
        const contextList = this.contexts
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);

        const projectList = splitListPreservingLinksAndQuotes(this.projects);
        const tagList = sanitizeTags(this.tags)
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        // Add the task tag if it's not already present
        if (this.plugin.settings.taskTag && !tagList.includes(this.plugin.settings.taskTag)) {
            tagList.push(this.plugin.settings.taskTag);
        }

        const taskData: TaskCreationData = {
            title: this.title.trim(),
            due: this.dueDate || undefined,
            scheduled: this.scheduledDate || undefined,
            priority: this.priority,
            status: this.status,
            contexts: contextList.length > 0 ? contextList : undefined,
            projects: projectList.length > 0 ? projectList : undefined,
            tags: tagList.length > 0 ? tagList : undefined,
            timeEstimate: this.timeEstimate > 0 ? this.timeEstimate : undefined,
            recurrence: this.recurrenceRule || undefined,
            reminders: this.reminders.length > 0 ? this.reminders : undefined,
            creationContext: 'manual-creation', // Mark as manual creation for folder logic
            dateCreated: now,
            dateModified: now,
            // Add user fields as custom frontmatter properties
            customFrontmatter: this.buildCustomFrontmatter()
        };

        // Add details if provided
        if (this.details.trim()) {
            // You might want to add the details to the task content or as a separate field
            // For now, we'll add it as part of the task description
            taskData.details = this.details.trim();
        }

        return taskData;
    }

    private buildCustomFrontmatter(): Record<string, any> {
        const customFrontmatter: Record<string, any> = {};

        // Add user field values to frontmatter
        for (const [fieldKey, fieldValue] of Object.entries(this.userFields)) {
            if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                customFrontmatter[fieldKey] = fieldValue;
            }
        }

        return customFrontmatter;
    }

    private generateFilename(taskData: TaskCreationData): string {
        const context: FilenameContext = {
            title: taskData.title || '',
            status: taskData.status || 'open',
            priority: taskData.priority || 'normal',
            dueDate: taskData.due,
            scheduledDate: taskData.scheduled
        };

        return generateTaskFilename(context, this.plugin.settings);
    }

    // Override to prevent creating duplicate title input when NLP is enabled
    protected createTitleInput(container: HTMLElement): void {
        // Only create title input if NLP is disabled
        if (!this.plugin.settings.enableNaturalLanguageInput) {
            super.createTitleInput(container);
        }
    }
}
