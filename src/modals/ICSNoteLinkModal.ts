import { App, FuzzySuggestModal, TAbstractFile, TFile, SearchResult } from 'obsidian';

/**
 * Modal for selecting notes to link to ICS events using fuzzy search
 * Based on the existing ProjectSelectModal pattern
 */
export class ICSNoteLinkModal extends FuzzySuggestModal<TAbstractFile> {
    private onChoose: (file: TAbstractFile) => void;

    constructor(app: App, onChoose: (file: TAbstractFile) => void) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder('Type to search for notes to link...');
        this.setInstructions([
            { command: '↑↓', purpose: 'to navigate' },
            { command: '↵', purpose: 'to select' },
            { command: 'esc', purpose: 'to cancel' }
        ]);
    }

    getItems(): TAbstractFile[] {
        return this.app.vault.getAllLoadedFiles().filter(file => 
            file instanceof TFile && file.extension === 'md' && !file.path.includes('.trash')
        );
    }

    getItemText(file: TAbstractFile): string {
        return `${file.name} ${file.path}`;
    }

    renderSuggestion(value: { item: TAbstractFile; match: SearchResult }, el: HTMLElement) {
        const file = value.item;
        el.empty();
        
        const container = el.createDiv({ cls: 'ics-note-link-suggestion' });
        
        // File name
        const nameEl = container.createSpan({ cls: 'note-link-name' });
        nameEl.textContent = file.name;
        
        // File path (if different from name)
        if (file.path !== file.name) {
            const pathEl = container.createDiv({ cls: 'note-link-path' });
            pathEl.textContent = file.path;
        }
    }

    onChooseItem(file: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(file);
    }
}