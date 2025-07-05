import { App, FuzzySuggestModal, TAbstractFile, TFile, SearchResult } from 'obsidian';

/**
 * Modal for selecting project notes using fuzzy search
 * Based on the existing AttachmentSelectModal pattern
 */
export class ProjectSelectModal extends FuzzySuggestModal<TAbstractFile> {
    private onChoose: (file: TAbstractFile) => void;

    constructor(app: App, onChoose: (file: TAbstractFile) => void) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder('Type to search for project notes...');
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
        
        const container = el.createDiv({ cls: 'project-suggestion' });
        
        // File name
        const nameEl = container.createSpan({ cls: 'project-name' });
        nameEl.textContent = file.name;
        
        // File path (if different from name)
        if (file.path !== file.name) {
            const pathEl = container.createDiv({ cls: 'project-path' });
            pathEl.textContent = file.path;
        }
    }

    onChooseItem(file: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(file);
    }
}