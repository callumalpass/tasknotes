import { App, FuzzySuggestModal, TAbstractFile, TFile, SearchResult, parseFrontMatterAliases } from 'obsidian';
import type TaskNotesPlugin from '../main';
import { ProjectMetadataResolver } from '../utils/projectMetadataResolver';
import { parseDisplayFieldsRow } from '../utils/projectAutosuggestDisplayFieldsParser';

/**
 * Modal for selecting project notes using fuzzy search
 * Based on the existing AttachmentSelectModal pattern
 */
export class ProjectSelectModal extends FuzzySuggestModal<TAbstractFile> {
    private onChoose: (file: TAbstractFile) => void;
    private plugin: TaskNotesPlugin;

    constructor(app: App, plugin: TaskNotesPlugin, onChoose: (file: TAbstractFile) => void) {
        super(app);
        this.plugin = plugin;
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
        if (!(file instanceof TFile)) {
            return file.name;
        }
        
        let text = `${file.name} ${file.path}`;
        
        // Use the same searchable fields as the inline autosuggest
        const rows = this.plugin.settings?.projectAutosuggest?.rows ?? [];
        const searchableFields = new Set<string>();
        
        // Parse searchable fields from configuration
        for (const row of rows) {
            try {
                const tokens = parseDisplayFieldsRow(row);
                for (const token of tokens) {
                    if ((token as any).searchable && !token.property.startsWith('literal:')) {
                        searchableFields.add(token.property);
                    }
                }
            } catch {
                // Ignore parse errors
            }
        }
        
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter) {
            const mapped = this.plugin.fieldMapper.mapFromFrontmatter(cache.frontmatter, file.path, this.plugin.settings.storeTitleInFilename);
            
            // Always include title and aliases (default searchable)
            const title = typeof mapped.title === 'string' ? mapped.title : '';
            if (title) {
                text += ` ${title}`;
            }
            
            const aliases = parseFrontMatterAliases(cache.frontmatter) || [];
            if (Array.isArray(aliases) && aliases.length > 0) {
                text += ` ${aliases.join(' ')}`;
            }
            
            // Add additional searchable fields based on configuration
            for (const fieldKey of searchableFields) {
                let value = '';
                
                switch (fieldKey) {
                    case 'file.path':
                        value = file.path;
                        break;
                    case 'file.parent':
                        value = file.parent?.name || '';
                        break;
                    case 'file.basename':
                        value = file.basename; // Already included as file.name
                        break;
                    case 'title':
                    case 'aliases':
                        // Already handled above
                        break;
                    default:
                        // Custom frontmatter field
                        const customValue = cache.frontmatter[fieldKey];
                        if (customValue != null) {
                            value = Array.isArray(customValue) ? customValue.join(' ') : String(customValue);
                        }
                        break;
                }
                
                if (value) {
                    text += ` ${value}`;
                }
            }
        }
        
        return text;
    }

    renderSuggestion(value: { item: TAbstractFile; match: SearchResult }, el: HTMLElement) {
        const file = value.item;
        el.empty();
        
        if (!(file instanceof TFile)) {
            // Fallback for non-TFile items
            el.textContent = file.name;
            return;
        }
        
        const container = el.createDiv({ cls: 'project-suggestion' });
        
        // Use the same configurable display as the inline autosuggest
        const rowConfigs = (this.plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);
        
        if (rowConfigs.length === 0) {
            // Fallback to simple display if no config
            container.createSpan({ cls: 'project-name', text: file.basename });
            return;
        }
        
        try {
            const cache = this.app.metadataCache.getFileCache(file);
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
            
            const resolver = new ProjectMetadataResolver({
                getFrontmatter: () => frontmatter,
            });
            
            // Always show filename first
            const filenameEl = container.createDiv({ cls: 'project-name', text: file.basename });
            
            // Render configured rows
            for (let i = 0; i < Math.min(rowConfigs.length, 3); i++) {
                const row = rowConfigs[i];
                if (!row) continue;
                
                try {
                    const tokens = parseDisplayFieldsRow(row);
                    const parts: string[] = [];
                    
                    for (const token of tokens) {
                        if (token.property.startsWith('literal:')) {
                            parts.push(token.property.slice(8));
                            continue;
                        }
                        
                        const value = resolver.resolve(token.property, fileData) || '';
                        if (!value) continue;
                        
                        if (token.showName) {
                            const label = token.displayName ?? token.property;
                            parts.push(`${label}: ${value}`);
                        } else {
                            parts.push(value);
                        }
                    }
                    
                    const line = parts.join(' ');
                    if (line.trim()) {
                        const metaEl = container.createDiv({ cls: 'project-meta' });
                        metaEl.textContent = line;
                    }
                } catch {
                    // Skip invalid rows
                }
            }
        } catch (error) {
            console.error('Error rendering project suggestion:', error);
            // Fallback to simple display
            container.createSpan({ cls: 'project-name', text: file.basename });
        }
    }

    onChooseItem(file: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(file);
    }
}