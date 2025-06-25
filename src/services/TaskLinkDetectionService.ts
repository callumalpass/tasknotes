import { TFile } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';

export interface TaskLinkInfo {
    isValidTaskLink: boolean;
    taskPath?: string;
    taskInfo?: TaskInfo;
    displayText?: string;
}

export class TaskLinkDetectionService {
    private plugin: TaskNotesPlugin;
    private linkCache = new Map<string, { result: TaskLinkInfo; lastModified: number }>();

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
    }

    /**
     * Parse a wikilink and determine if it points to a valid task
     */
    async detectTaskLink(wikilinkText: string, sourcePath: string): Promise<TaskLinkInfo> {
        const parsed = this.parseWikilink(wikilinkText);
        if (!parsed) {
            return { isValidTaskLink: false };
        }

        const { linkPath, displayText } = parsed;
        const cacheKey = `${sourcePath}:${linkPath}`;
        
        // Check cache first
        const cached = this.linkCache.get(cacheKey);
        if (cached) {
            const file = this.plugin.app.vault.getAbstractFileByPath(linkPath);
            if (file instanceof TFile && file.stat.mtime === cached.lastModified) {
                return cached.result;
            }
        }

        // Resolve the link path
        const resolvedPath = this.resolveLinkPath(linkPath, sourcePath);
        if (!resolvedPath) {
            const result = { isValidTaskLink: false };
            this.cacheResult(cacheKey, result, 0);
            return result;
        }

        // Check if file exists and is a valid task
        const file = this.plugin.app.vault.getAbstractFileByPath(resolvedPath);
        if (!(file instanceof TFile)) {
            const result = { isValidTaskLink: false };
            this.cacheResult(cacheKey, result, 0);
            return result;
        }

        // Check if file contains task metadata
        try {
            const taskInfo = await this.plugin.cacheManager.getTaskInfo(resolvedPath);
            if (taskInfo) {
                const result: TaskLinkInfo = {
                    isValidTaskLink: true,
                    taskPath: resolvedPath,
                    taskInfo,
                    displayText
                };
                this.cacheResult(cacheKey, result, file.stat.mtime);
                return result;
            }
        } catch (error) {
            console.debug('TaskLinkDetectionService: Error checking task info for link:', resolvedPath, error);
        }

        const result = { isValidTaskLink: false };
        this.cacheResult(cacheKey, result, file.stat.mtime);
        return result;
    }

    /**
     * Parse wikilink syntax to extract link path and display text
     */
    private parseWikilink(wikilinkText: string): { linkPath: string; displayText?: string } | null {
        // Remove the [[ and ]] brackets
        const content = wikilinkText.slice(2, -2).trim();
        if (!content) return null;

        // Check for display text syntax: [[link|display]]
        const pipeIndex = content.indexOf('|');
        if (pipeIndex !== -1) {
            return {
                linkPath: content.slice(0, pipeIndex).trim(),
                displayText: content.slice(pipeIndex + 1).trim()
            };
        }

        return { linkPath: content };
    }

    /**
     * Resolve a link path relative to the source file
     */
    private resolveLinkPath(linkPath: string, sourcePath: string): string | null {
        try {
            // Use Obsidian's built-in link resolution
            const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
            return file?.path || null;
        } catch (error) {
            console.debug('Error resolving link path:', linkPath, error);
            return null;
        }
    }

    /**
     * Cache the result of a task link detection
     */
    private cacheResult(cacheKey: string, result: TaskLinkInfo, lastModified: number): void {
        this.linkCache.set(cacheKey, { result, lastModified });
        
        // Prevent memory leaks by limiting cache size
        if (this.linkCache.size > 1000) {
            const firstKey = this.linkCache.keys().next().value;
            this.linkCache.delete(firstKey);
        }
    }

    /**
     * Clear cache for a specific file path
     */
    clearCacheForFile(filePath: string): void {
        for (const [key] of this.linkCache) {
            if (key.includes(filePath)) {
                this.linkCache.delete(key);
            }
        }
    }

    /**
     * Clear entire cache
     */
    clearCache(): void {
        this.linkCache.clear();
    }

    /**
     * Find all wikilinks in a text string
     */
    findWikilinks(text: string): Array<{ match: string; start: number; end: number }> {
        const wikilinks: Array<{ match: string; start: number; end: number }> = [];
        const regex = /\[\[([^\]]+)\]\]/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            wikilinks.push({
                match: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }

        return wikilinks;
    }

    /**
     * Clean up resources and clear caches
     */
    cleanup(): void {
        // Clear the link cache to prevent memory leaks
        this.linkCache.clear();
    }
}