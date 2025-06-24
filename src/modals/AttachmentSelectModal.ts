import { App, FuzzySuggestModal, TAbstractFile, SearchResult } from 'obsidian';

export class AttachmentSelectModal extends FuzzySuggestModal<TAbstractFile> {
    private onChoose: (file: TAbstractFile) => void;

    constructor(app: App, onChoose: (file: TAbstractFile) => void) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder('Type to search for files and notes...');
        this.setInstructions([
            { command: '↑↓', purpose: 'to navigate' },
            { command: '↵', purpose: 'to select' },
            { command: 'esc', purpose: 'to cancel' }
        ]);
    }

    getItems(): TAbstractFile[] {
        return this.app.vault.getAllLoadedFiles();
    }

    getItemText(file: TAbstractFile): string {
        return `${file.name} ${file.path}`;
    }

    renderSuggestion(value: { item: TAbstractFile; match: SearchResult }, el: HTMLElement) {
        const file = value.item;
        el.empty();
        
        const container = el.createDiv({ cls: 'attachment-suggestion' });
        
        // File name
        const nameEl = container.createSpan({ cls: 'attachment-name' });
        nameEl.textContent = file.name;
        
        // File path (if different from name)
        if (file.path !== file.name) {
            const pathEl = container.createDiv({ cls: 'attachment-path' });
            pathEl.textContent = file.path;
        }
    }

    onChooseItem(file: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(file);
    }
}