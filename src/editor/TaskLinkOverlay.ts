import { Extension, RangeSetBuilder, StateField, Transaction, StateEffect } from '@codemirror/state';
import {
    Decoration,
    DecorationSet,
    EditorView,
} from '@codemirror/view';
import { editorLivePreviewField, MarkdownView } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskLinkDetectionService, TaskLinkInfo } from '../services/TaskLinkDetectionService';
import { TaskLinkWidget } from './TaskLinkWidget';
import { EVENT_TASK_UPDATED } from '../types';

// Define a state effect for task updates
const taskUpdateEffect = StateEffect.define<{ taskPath?: string }>();

// Create a state field factory that takes the plugin as a parameter
export function createTaskLinkField(plugin: TaskNotesPlugin) {
    // Track widget instances for updates
    const activeWidgets = new Map<string, TaskLinkWidget>();
    
    return StateField.define<DecorationSet>({
        create(state): DecorationSet {
            // Build decorations immediately when the state field is created
            // This ensures overlays appear when returning to a note
            try {
                if (plugin?.settings?.enableTaskLinkOverlay) {
                    const isLivePreview = state.field(editorLivePreviewField);
                    if (isLivePreview) {
                        return buildTaskLinkDecorations(state, plugin, activeWidgets);
                    }
                }
            } catch (error) {
                console.debug('Error building initial decorations:', error);
            }
            return Decoration.none;
        },
        
        update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
            // Validate inputs
            if (!plugin || !transaction) {
                return Decoration.none;
            }
            
            if (!transaction.state) {
                console.warn('Invalid transaction state in task link overlay update');
                return Decoration.none;
            }
        
            // Only process if overlay is enabled in settings
            if (!plugin.settings || !plugin.settings.enableTaskLinkOverlay) {
                return Decoration.none;
            }

            // Only process in Live Preview mode
            try {
                const isLivePreview = transaction.state.field(editorLivePreviewField);
                if (!isLivePreview) {
                    return Decoration.none;
                }
            } catch (error) {
                console.debug('Error checking live preview mode:', error);
                return Decoration.none;
            }

            try {
                // Check for task update effects
                const hasTaskUpdateEffect = transaction.effects.some(effect => effect.is(taskUpdateEffect));
                
                // Rebuild decorations on document changes OR task update effects
                if (transaction.docChanged || hasTaskUpdateEffect) {
                    // Clear active widgets cache on task updates to ensure fresh widgets are created
                    if (hasTaskUpdateEffect) {
                        // Get the specific task path that was updated
                        const taskUpdateData = transaction.effects.find(effect => effect.is(taskUpdateEffect))?.value;
                        if (taskUpdateData?.taskPath) {
                            // Clear only widgets for the specific task that was updated
                            for (const [key, widget] of activeWidgets.entries()) {
                                if (key.includes(taskUpdateData.taskPath)) {
                                    activeWidgets.delete(key);
                                }
                            }
                        } else {
                            // If no specific path, clear all widgets
                            activeWidgets.clear();
                        }
                    }
                    return buildTaskLinkDecorations(transaction.state, plugin, activeWidgets);
                }

                // For other transactions (cursor moves, etc.), just map the existing decorations
                if (oldState !== Decoration.none) {
                    return oldState.map(transaction.changes);
                }

                return oldState;
            } catch (error) {
                console.error('Error updating task link overlay decorations:', error);
                return Decoration.none;
            }
        },
        
        provide(field: StateField<DecorationSet>): Extension {
            return EditorView.decorations.from(field);
        },
    });
}

function buildTaskLinkDecorations(state: any, plugin: TaskNotesPlugin, activeWidgets: Map<string, TaskLinkWidget>): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    
    // Validate inputs
    if (!state || !plugin || !activeWidgets) {
        console.warn('Invalid inputs for building task link decorations');
        return builder.finish();
    }
    
    const doc = state.doc;
    if (!doc) {
        console.warn('Invalid document state');
        return builder.finish();
    }
    
    // Validate plugin components
    if (!plugin.app || !plugin.app.workspace) {
        console.warn('Plugin app or workspace not available');
        return builder.finish();
    }
    
    const detectionService = plugin.taskLinkDetectionService || new TaskLinkDetectionService(plugin);
    
    // Get current file path
    const activeMarkdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeMarkdownView) {
        return builder.finish();
    }
    const currentFile = activeMarkdownView.file?.path;
    
    if (!currentFile) {
        return builder.finish();
    }

    // Validate current file path
    if (typeof currentFile !== 'string' || currentFile.length === 0) {
        console.warn('Invalid current file path');
        return builder.finish();
    }

    try {
        // Process the entire document text for wikilinks
        const text = doc.toString();
        
        // Validate document text
        if (typeof text !== 'string') {
            console.warn('Invalid document text');
            return builder.finish();
        }
        
        // Performance safeguard: skip processing extremely large documents
        if (text.length > 100000) {
            console.warn('Document too large for task link processing, skipping');
            return builder.finish();
        }
        
        const wikilinks = detectionService.findWikilinks(text);
        
        // Validate wikilinks result
        if (!Array.isArray(wikilinks)) {
            console.warn('Invalid wikilinks result from detection service');
            return builder.finish();
        }

        // Process each wikilink and check if it's a valid task link
        // Note: In State Field, we need to do this synchronously, so we'll use cached results
        for (const wikilink of wikilinks) {
            try {
                // Validate wikilink object
                if (!wikilink || typeof wikilink.match !== 'string' || 
                    typeof wikilink.start !== 'number' || typeof wikilink.end !== 'number') {
                    console.debug('Invalid wikilink object:', wikilink);
                    continue;
                }
                
                // Validate positions
                if (wikilink.start < 0 || wikilink.end <= wikilink.start || 
                    wikilink.start >= text.length || wikilink.end > text.length) {
                    console.debug('Invalid wikilink positions:', wikilink.start, wikilink.end);
                    continue;
                }
                
                // Parse the wikilink to get the link path
                const parsed = parseWikilinkSync(wikilink.match);
                if (!parsed) continue;

                const { linkPath } = parsed;
                
                // Validate link path
                if (!linkPath || typeof linkPath !== 'string' || linkPath.trim().length === 0) {
                    console.debug('Invalid link path:', linkPath);
                    continue;
                }
                
                // Resolve the link path
                const resolvedPath = resolveLinkPathSync(linkPath, currentFile, plugin);
                if (!resolvedPath) continue;

                // Check if we have cached task info for this file
                const taskInfo = getTaskInfoSync(resolvedPath, plugin);
                if (taskInfo) {
                    // Validate task info
                    if (!taskInfo.title || typeof taskInfo.title !== 'string') {
                        console.debug('Invalid task info for:', resolvedPath);
                        continue;
                    }
                    
                    // Create or reuse widget instance
                    const widgetKey = `${resolvedPath}-${wikilink.start}-${wikilink.end}`;
                    
                    // Always create a new widget with the current task info
                    const newWidget = new TaskLinkWidget(taskInfo, plugin, wikilink.match, parsed.displayText);
                    
                    // Check if we need to update the cached widget
                    const cachedWidget = activeWidgets.get(widgetKey);
                    if (!cachedWidget || !cachedWidget.eq(newWidget)) {
                        activeWidgets.set(widgetKey, newWidget);
                    }
                    
                    // Use the new widget to ensure fresh data
                    const widget = activeWidgets.get(widgetKey);

                    // Create a replacement decoration that replaces the wikilink with our widget
                    const decoration = Decoration.replace({
                        widget: widget as any,
                        inclusive: true
                    });

                    builder.add(wikilink.start, wikilink.end, decoration);
                }
            } catch (error) {
                // If there's any error, skip this wikilink
                console.debug('Error processing wikilink:', wikilink.match, error);
                continue;
            }
        }
        
    } catch (error) {
        console.error('Error in buildTaskLinkDecorations:', error);
    }

    return builder.finish();
}

// Synchronous helper functions for State Field context
function parseWikilinkSync(wikilinkText: string): { linkPath: string; displayText?: string } | null {
    // Validate input
    if (!wikilinkText || typeof wikilinkText !== 'string') {
        return null;
    }
    
    // Validate wikilink format
    if (wikilinkText.length < 4 || !wikilinkText.startsWith('[[') || !wikilinkText.endsWith(']]')) {
        return null;
    }
    
    const content = wikilinkText.slice(2, -2).trim();
    if (!content || content.length === 0) {
        return null;
    }
    
    // Prevent processing of extremely long links
    if (content.length > 500) {
        console.debug('Wikilink content too long, skipping:', content.length);
        return null;
    }

    const pipeIndex = content.indexOf('|');
    if (pipeIndex !== -1) {
        const linkPath = content.slice(0, pipeIndex).trim();
        const displayText = content.slice(pipeIndex + 1).trim();
        
        // Validate both parts
        if (!linkPath || !displayText) {
            return null;
        }
        
        return { linkPath, displayText };
    }

    return { linkPath: content };
}

function resolveLinkPathSync(linkPath: string, sourcePath: string, plugin: TaskNotesPlugin): string | null {
    // Validate inputs
    if (!linkPath || typeof linkPath !== 'string' || linkPath.trim().length === 0) {
        return null;
    }
    
    if (!sourcePath || typeof sourcePath !== 'string') {
        return null;
    }
    
    if (!plugin || !plugin.app || !plugin.app.metadataCache) {
        return null;
    }
    
    try {
        // Sanitize link path to prevent directory traversal
        const sanitizedLinkPath = linkPath.replace(/\.\./g, '').trim();
        if (!sanitizedLinkPath) {
            return null;
        }
        
        const file = plugin.app.metadataCache.getFirstLinkpathDest(sanitizedLinkPath, sourcePath);
        
        // Validate result
        if (!file || !file.path || typeof file.path !== 'string') {
            return null;
        }
        
        return file.path;
    } catch (error) {
        console.debug('Error resolving link path:', linkPath, error);
        return null;
    }
}

function getTaskInfoSync(filePath: string, plugin: TaskNotesPlugin): any {
    // Validate inputs
    if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
        return null;
    }
    
    if (!plugin) {
        return null;
    }
    
    try {
        // Validate file path format
        if (filePath.length > 260) { // Windows path limit
            console.debug('File path too long:', filePath.length);
            return null;
        }
        
        // Check for invalid characters
        const invalidChars = /[<>:"|?*\x00-\x1f\x7f]/;
        if (invalidChars.test(filePath)) {
            console.debug('File path contains invalid characters:', filePath);
            return null;
        }
        
        // Use the same cached data access pattern as the views
        // This gets the most up-to-date cached task info (updated immediately after any changes)
        const cacheManager = plugin.cacheManager;
        if (!cacheManager || !cacheManager.getCachedTaskInfoSync) {
            return null;
        }
        
        const taskInfo = cacheManager.getCachedTaskInfoSync(filePath);
        
        // Basic validation of task info structure
        if (taskInfo && typeof taskInfo === 'object' && taskInfo.title) {
            return taskInfo;
        }
        
        return null;
    } catch (error) {
        console.debug('Error getting task info for:', filePath, error);
        return null;
    }
}


export function createTaskLinkOverlay(plugin: TaskNotesPlugin): Extension {
    const stateField = createTaskLinkField(plugin);
    
    return stateField;
}

// Export the effect and utility function for triggering updates
export { taskUpdateEffect };

// Helper function to dispatch task update effects to an editor view
export function dispatchTaskUpdate(view: EditorView, taskPath?: string): void {
    // Validate that view is a proper EditorView with dispatch method
    if (!view || typeof view.dispatch !== 'function') {
        console.warn('Invalid EditorView passed to dispatchTaskUpdate:', view);
        return;
    }
    
    try {
        view.dispatch({
            effects: [taskUpdateEffect.of({ taskPath })]
        });
    } catch (error) {
        console.error('Error dispatching task update:', error);
    }
}

// Export the service for use elsewhere
export { TaskLinkDetectionService };