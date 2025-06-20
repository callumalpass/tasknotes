import { format } from 'date-fns';
import { TFile } from 'obsidian';
import { NoteInfo } from '../types';
import TaskNotesPlugin from '../main';
import { formatDateForDisplay } from '../utils/dateUtils';
import { getAllDailyNotes } from 'obsidian-daily-notes-interface';

export interface NoteCardOptions {
    showCreatedDate: boolean;
    showTags: boolean;
    showPath: boolean;
    maxTags: number;
    showDailyNoteBadge: boolean;
}

export const DEFAULT_NOTE_CARD_OPTIONS: NoteCardOptions = {
    showCreatedDate: true,
    showTags: true,
    showPath: false,
    maxTags: 3,
    showDailyNoteBadge: true
};

/**
 * Create a reusable note card element
 */
export function createNoteCard(note: NoteInfo, plugin: TaskNotesPlugin, options: Partial<NoteCardOptions> = {}): HTMLElement {
    const opts = { ...DEFAULT_NOTE_CARD_OPTIONS, ...options };
    
    const item = document.createElement('div');
    // Check if this is a daily note using the core plugin
    let isDailyNote = false;
    try {
        const allDailyNotes = getAllDailyNotes();
        isDailyNote = Object.values(allDailyNotes).some(file => file.path === note.path);
    } catch (error) {
        // Daily Notes interface not available, fallback to false
        isDailyNote = false;
    }
    
    // Build BEM class names
    const cardClasses = ['note-card'];
    
    // Add modifiers
    if (isDailyNote) cardClasses.push('note-card--daily-note');
    cardClasses.push('note-card--compact', 'note-card--shadow-light');
    
    
    item.className = cardClasses.join(' ');
    item.dataset.notePath = note.path;
    
    // Daily note badge (if enabled and applicable)
    if (opts.showDailyNoteBadge && isDailyNote) {
        const dailyBadge = item.createSpan({ 
            cls: 'note-card__badge',
            text: 'Daily',
            attr: { title: 'Daily note' }
        });
    }
    
    // Main content container  
    const contentContainer = item.createDiv({ cls: 'note-card__content' });
    
    // Title
    const title = contentContainer.createDiv({ 
        cls: 'note-card__title',
        text: note.title
    });
    
    // Tags section (separate from other metadata)
    if (opts.showTags && note.tags && note.tags.length > 0) {
        // Divider line
        const divider = contentContainer.createEl('div', { cls: 'note-card__divider' });
        
        // Tags line
        const tagsToShow = note.tags.slice(0, opts.maxTags);
        let tagsText = tagsToShow.map(tag => `#${tag}`).join(' ');
        
        // Add "more tags" indicator if there are additional tags
        if (note.tags.length > opts.maxTags) {
            tagsText += ` +${note.tags.length - opts.maxTags}`;
        }
        
        const tagsLine = contentContainer.createEl('div', { 
            cls: 'note-card__tags-text',
            text: tagsText
        });
    }
    
    // Other metadata (date, path) if needed
    if (opts.showCreatedDate && note.createdDate) {
        const dateStr = note.createdDate.indexOf('T') > 0 
            ? formatDateForDisplay(note.createdDate, 'MMM d, yyyy h:mm a') 
            : note.createdDate;
        const dateEl = contentContainer.createDiv({ 
            cls: 'note-card__metadata',
            text: `Created: ${dateStr}`,
            attr: { title: `Created: ${dateStr}` }
        });
    }
    
    if (opts.showPath) {
        const pathEl = contentContainer.createDiv({ 
            cls: 'note-card__metadata',
            text: note.path,
            attr: { title: `Path: ${note.path}` }
        });
    }
    
    // Add click handler to open note
    item.addEventListener('click', () => {
        const file = plugin.app.vault.getAbstractFileByPath(note.path);
        if (file instanceof TFile) {
            plugin.app.workspace.getLeaf(false).openFile(file);
        }
    });
    
    // Add hover preview
    item.addEventListener('mouseover', (event) => {
        const file = plugin.app.vault.getAbstractFileByPath(note.path);
        if (file) {
            plugin.app.workspace.trigger('hover-link', {
                event,
                source: 'tasknotes-note-card',
                hoverParent: item,
                targetEl: item,
                linktext: note.path,
                sourcePath: note.path
            });
        }
    });
    
    return item;
}

/**
 * Update an existing note card with new data
 */
export function updateNoteCard(element: HTMLElement, note: NoteInfo, plugin: TaskNotesPlugin, options: Partial<NoteCardOptions> = {}): void {
    const opts = { ...DEFAULT_NOTE_CARD_OPTIONS, ...options };
    
    // Update main element classes using BEM structure
    // Check if this is a daily note using the core plugin
    let isDailyNote = false;
    try {
        const allDailyNotes = getAllDailyNotes();
        isDailyNote = Object.values(allDailyNotes).some(file => file.path === note.path);
    } catch (error) {
        // Daily Notes interface not available, fallback to false
        isDailyNote = false;
    }
    
    // Build BEM class names for update
    const cardClasses = ['note-card'];
    
    // Add modifiers
    if (isDailyNote) cardClasses.push('note-card--daily-note');
    cardClasses.push('note-card--compact', 'note-card--shadow-light');
    
    
    element.className = cardClasses.join(' ');
    
    // Update title
    const titleEl = element.querySelector('.note-card__title') as HTMLElement;
    if (titleEl) {
        titleEl.textContent = note.title;
    }
    
    // Update created date
    const dateEl = element.querySelector('.note-card__metadata') as HTMLElement;
    if (dateEl && opts.showCreatedDate && note.createdDate) {
        const dateStr = note.createdDate.indexOf('T') > 0 
            ? formatDateForDisplay(note.createdDate, 'MMM d, yyyy h:mm a') 
            : note.createdDate;
        dateEl.textContent = `Created: ${dateStr}`;
    }
    
    // Update path
    const pathEl = element.querySelector('.note-card__metadata') as HTMLElement;
    if (pathEl && opts.showPath) {
        pathEl.textContent = note.path;
    }
    
    // Update tags
    const tagContainer = element.querySelector('.note-card__tags-text') as HTMLElement;
    if (tagContainer && opts.showTags && note.tags && note.tags.length > 0) {
        // For the new BEM structure, update the text content directly
        const tagsToShow = note.tags.slice(0, opts.maxTags);
        let tagsText = tagsToShow.map(tag => `#${tag}`).join(' ');
        
        if (note.tags.length > opts.maxTags) {
            tagsText += ` +${note.tags.length - opts.maxTags}`;
        }
        
        tagContainer.textContent = tagsText;
    }
    
    // Add update animation
    element.classList.add('note-card--updated');
    window.setTimeout(() => {
        element.classList.remove('note-card--updated');
    }, 1000);
}
