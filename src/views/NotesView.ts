import { TFile, ItemView, WorkspaceLeaf, setIcon, EventRef, Setting } from 'obsidian';
import { formatDateForDisplay } from '../utils/dateUtils';
import TaskNotesPlugin from '../main';
import { 
    NOTES_VIEW_TYPE, 
    NoteInfo, 
    EVENT_DATE_SELECTED,
    EVENT_DATA_CHANGED
} from '../types';
import { createNoteCard, updateNoteCard } from '../ui/NoteCard';

export class NotesView extends ItemView {
    plugin: TaskNotesPlugin;
    
    // UI elements
    private loadingIndicator: HTMLElement | null = null;
    
    // Removed redundant local caching - CacheManager is the single source of truth
    
    // Loading states
    private isNotesLoading = false;
    
    // Event listeners
    private listeners: EventRef[] = [];
    
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Register event listeners
        this.registerEvents();
    }
    
    getViewType(): string {
        return NOTES_VIEW_TYPE;
    }
    
    getDisplayText(): string {
        return 'Notes';
    }
    
    getIcon(): string {
        return 'file-text';
    }
    
    registerEvents(): void {
        // Clean up any existing listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];
        
        // Listen for date selection changes - force a full refresh when date changes
        const dateListener = this.plugin.emitter.on(EVENT_DATE_SELECTED, () => {
            this.refresh(true); // Force refresh on date change
        });
        this.listeners.push(dateListener);
        
        // Listen for data changes
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, () => {
            this.refresh();
        });
        this.listeners.push(dataListener);
    }
    
    async onOpen() {
        // Wait for the plugin to be fully initialized before proceeding
        await this.plugin.onReady();
        await this.refresh();
    }
    
    async onClose() {
        // Remove event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.contentEl.empty();
    }
    
    async refresh(forceFullRefresh = false) {
        // Force refresh is handled by CacheManager
        
        // Try to preserve scroll position if not forcing full refresh
        const existingContainer = this.contentEl.querySelector('.notes-view');
        let scrollTop = 0;
        if (existingContainer && !forceFullRefresh) {
            const notesList = existingContainer.querySelector('.notes-view__list') as HTMLElement;
            if (notesList) {
                scrollTop = notesList.scrollTop;
            }
        }
        
        // Clear and prepare the content element
        this.contentEl.empty();
        await this.render(forceFullRefresh);
        
        // Restore scroll position
        if (scrollTop > 0) {
            const newNotesList = this.contentEl.querySelector('.notes-view__list') as HTMLElement;
            if (newNotesList) {
                newNotesList.scrollTop = scrollTop;
            }
        }
    }
    
    async render(forceRefresh = false) {
        const container = this.contentEl.createDiv({ cls: 'tasknotes-plugin notes-view' });
        
        // Create header with current date information
        this.createHeader(container);
        
        // Create notes content
        await this.createNotesContent(container, forceRefresh);
    }
    
    createHeader(container: HTMLElement) {
        const headerContainer = container.createDiv({ cls: 'notes-view__header' });
        
        // Display selected date
        const formattedDate = formatDateForDisplay(this.plugin.selectedDate.toISOString(), 'EEEE, MMMM d, yyyy');
        const titleContainer = headerContainer.createDiv();
        new Setting(titleContainer)
            .setName('Notes')
            .setHeading();
        titleContainer.createEl('div', {
            text: formattedDate,
            cls: 'notes-view__date'
        });
        
        // Add actions
        const actionsContainer = headerContainer.createDiv({ cls: 'notes-view__actions' });
        
        // Add refresh button
        const refreshButton = actionsContainer.createEl('button', { 
            text: 'Refresh', 
            cls: 'notes-view__refresh-button',
            attr: {
                'aria-label': 'Refresh notes list',
                'title': 'Refresh notes list'
            }
        });
        
        refreshButton.addEventListener('click', async () => {
            // Prevent double-clicks during refresh
            if (refreshButton.classList.contains('is-loading')) return;
            
            refreshButton.classList.add('is-loading');
            refreshButton.disabled = true;
            const originalText = refreshButton.textContent;
            refreshButton.textContent = 'Refreshing...';
            
            try {
                // Force refresh through CacheManager
                await this.refresh(true);
            } finally {
                refreshButton.classList.remove('is-loading');
                refreshButton.disabled = false;
                refreshButton.textContent = originalText;
            }
        });
    }
    
    async createNotesContent(container: HTMLElement, forceRefresh = false) {
        // Notes list
        const notesList = container.createDiv({ cls: 'notes-view__list' });
        
        // Add loading indicator
        this.loadingIndicator = notesList.createDiv({ cls: 'notes-view__loading is-hidden' });
        this.loadingIndicator.createSpan({ text: 'Loading notes...' });
        
        // Show loading state
        this.isNotesLoading = true;
        this.updateLoadingState();
        
        // Get notes for the current view
        const notes = await this.getNotesForView(forceRefresh);
        
        // Hide loading state
        this.isNotesLoading = false;
        this.updateLoadingState();
        
        if (notes.length === 0) {
            // Placeholder for empty notes list
            const emptyState = notesList.createDiv({ cls: 'notes-view__empty' });
            const emptyIcon = emptyState.createDiv({ cls: 'notes-view__empty-icon' });
            setIcon(emptyIcon, 'file-text');
            
            if (this.plugin.settings.disableNoteIndexing) {
                new Setting(emptyState)
                    .setName('Note indexing disabled')
                    .setHeading();
                emptyState.createEl('p', {
                    text: 'Note indexing has been disabled in settings for better performance. To view notes, enable note indexing in Settings > TaskNotes > General > Performance settings and restart the plugin.',
                    cls: 'notes-view__empty-description'
                });
            } else {
                new Setting(emptyState)
                    .setName('No notes found')
                    .setHeading();
                emptyState.createEl('p', {
                    text: 'No notes found for the selected date. Try selecting a different date in the Mini Calendar view or create some notes.',
                    cls: 'notes-view__empty-description'
                });
            }
        } else {
            // Create a div to hold all note items
            const notesContainer = notesList.createDiv({ cls: 'notes-view__container' });
            
            // Use DOMReconciler for efficient updates
            this.renderNotesWithReconciler(notesContainer, notes);
        }
    }
    
    /**
     * Render notes using DOMReconciler for optimal performance
     */
    private renderNotesWithReconciler(container: HTMLElement, notes: NoteInfo[]) {
        this.plugin.domReconciler.updateList<NoteInfo>(
            container,
            notes,
            (note) => note.path, // Unique key
            (note) => this.createNoteCardForReconciler(note), // Render new item
            (element, note) => this.updateNoteCardForReconciler(element, note) // Update existing item
        );
    }

    /**
     * Create a note card for use with DOMReconciler
     */
    private createNoteCardForReconciler(note: NoteInfo): HTMLElement {
        const noteCard = createNoteCard(note, this.plugin, {
            showCreatedDate: true,
            showTags: true,
            showPath: false,
            maxTags: 5,
            showDailyNoteBadge: true
        });
        
        // Ensure the key is set for reconciler
        noteCard.dataset.key = note.path;
        
        return noteCard;
    }

    /**
     * Update an existing note card for use with DOMReconciler
     */
    private updateNoteCardForReconciler(element: HTMLElement, note: NoteInfo): void {
        updateNoteCard(element, note, this.plugin, {
            showCreatedDate: true,
            showTags: true,
            showPath: false,
            maxTags: 5,
            showDailyNoteBadge: true
        });
    }
    
    /**
     * Helper method to update the loading indicator visibility
     */
    private updateLoadingState(): void {
        if (!this.loadingIndicator) return;
        
        if (this.isNotesLoading) {
            this.loadingIndicator?.classList.remove('is-hidden');
        } else {
            this.loadingIndicator?.classList.add('is-hidden');
        }
    }
    
    async getNotesForView(forceRefresh = false): Promise<NoteInfo[]> {
        try {
            // Set loading state
            this.isNotesLoading = true;
            this.updateLoadingState();
            
            // Check if note indexing is disabled
            if (this.plugin.settings.disableNoteIndexing) {
                return [];
            }
            
            // Use the CacheManager to get notes information for the specific date
            const notes = await this.plugin.cacheManager.getNotesForDate(this.plugin.selectedDate);
            
            // Include all notes (both regular notes and daily notes)
            const filteredNotes = notes;
            
            // Sort notes by title
            const sortedResult = filteredNotes.sort((a, b) => a.title.localeCompare(b.title));
            
            return sortedResult;
        } finally {
            // Clear loading state
            this.isNotesLoading = false;
            this.updateLoadingState();
        }
    }
    
    openNote(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf(false).openFile(file);
        }
    }
}
