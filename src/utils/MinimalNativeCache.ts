import { TFile, App, Events } from 'obsidian';
import { TaskInfo, NoteInfo } from '../types';
import { FieldMapper } from '../services/FieldMapper';
import { 
    getTodayString, 
    isBeforeDateSafe, 
    getDatePart,
    parseDate
} from './dateUtils';

/**
 * Ultra-minimal cache manager that leverages Obsidian's native metadata cache
 * to the maximum extent possible. Only maintains essential indexes for performance.
 * 
 * Design Philosophy:
 * - Native-first: Always use app.metadataCache as primary data source
 * - Minimal indexing: Only index performance-critical queries
 * - Compute on-demand: Replace complex indexes with smart filtering
 * - Event-driven: React to native metadata changes
 */
export class MinimalNativeCache extends Events {
    private app: App;
    private taskTag: string;
    private excludedFolders: string[];
    private fieldMapper?: FieldMapper;
    private disableNoteIndexing: boolean;
    private storeTitleInFilename: boolean;
    
    // Only essential indexes - everything else computed on-demand
    private tasksByDate: Map<string, Set<string>> = new Map(); // YYYY-MM-DD -> task paths
    private tasksByStatus: Map<string, Set<string>> = new Map(); // status -> task paths
    private overdueTasks: Set<string> = new Set(); // overdue task paths
    
    // Initialization state
    private initialized = false;
    private indexesBuilt = false;
    
    constructor(
        app: App,
        taskTag: string,
        excludedFolders = '',
        fieldMapper?: FieldMapper,
        disableNoteIndexing = false,
        storeTitleInFilename = false
    ) {
        super();
        this.app = app;
        this.taskTag = taskTag;
        this.excludedFolders = excludedFolders 
            ? excludedFolders.split(',').map(folder => folder.trim())
            : [];
        this.fieldMapper = fieldMapper;
        this.disableNoteIndexing = disableNoteIndexing;
        this.storeTitleInFilename = storeTitleInFilename;
    }
    
    /**
     * Initialize by setting up native event listeners
     * Indexes built lazily for optimal startup performance
     */
    initialize(): void {
        if (this.initialized) {
            return;
        }
        
        this.setupNativeEventListeners();
        this.initialized = true;
        this.trigger('cache-initialized', { message: 'Minimal native cache ready' });
    }
    
    /**
     * Set up native event listeners for real-time updates
     */
    private setupNativeEventListeners(): void {
        this.app.metadataCache.on('changed', (file, data, cache) => {
            if (file instanceof TFile && file.extension === 'md' && this.isValidFile(file.path)) {
                this.handleFileChanged(file, cache);
            }
        });
        
        this.app.metadataCache.on('deleted', (file, prevCache) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileDeleted(file.path);
            }
        });
        
        this.app.vault.on('rename', (file, oldPath) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileRenamed(file, oldPath);
            }
        });
    }
    
    /**
     * Ensure essential indexes are built (lazy loading)
     */
    private ensureIndexesBuilt(): void {
        if (this.indexesBuilt) return;
        
        this.indexesBuilt = true;
        window.setTimeout(() => this.buildEssentialIndexes(), 1);
    }
    
    /**
     * Build only essential indexes in background
     */
    private async buildEssentialIndexes(): Promise<void> {
        try {
            const markdownFiles = this.app.vault.getMarkdownFiles()
                .filter(file => this.isValidFile(file.path));
            
            // Process in small batches to avoid blocking
            const batchSize = 50;
            for (let i = 0; i < markdownFiles.length; i += batchSize) {
                const batch = markdownFiles.slice(i, i + batchSize);
                
                for (const file of batch) {
                    try {
                        const metadata = this.app.metadataCache.getFileCache(file);
                        if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                            await this.indexTaskFile(file, metadata.frontmatter);
                        }
                    } catch (error) {
                        console.error(`Error indexing file ${file.path}:`, error);
                    }
                }
                
                // Yield control between batches
                await new Promise(resolve => window.setTimeout(resolve, 1));
            }
            
            this.trigger('indexes-built', { 
                tasksByDate: this.tasksByDate.size,
                tasksByStatus: this.tasksByStatus.size,
                overdueTasks: this.overdueTasks.size 
            });
            
        } catch (error) {
            console.error('Error building essential indexes:', error);
        }
    }
    
    /**
     * Index a task file (minimal - only essential indexes)
     */
    private async indexTaskFile(file: TFile, frontmatter: any): Promise<void> {
        if (!this.fieldMapper) return;
        
        try {
            const taskInfo = this.extractTaskInfoFromNative(file.path, frontmatter);
            if (!taskInfo) return;
            
            // Update only essential indexes
            this.updateDateIndex(file.path, taskInfo);
            this.updateStatusIndex(file.path, taskInfo.status);
            this.updateOverdueIndex(file.path, taskInfo);
            
        } catch (error) {
            console.error(`Error indexing task ${file.path}:`, error);
        }
    }
    
    // ========================================
    // PUBLIC API - NATIVE-FIRST APPROACH
    // ========================================
    
    /**
     * Get task info directly from native metadata cache
     */
    async getTaskInfo(path: string): Promise<TaskInfo | null> {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return null;
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter) return null;
        
        return this.extractTaskInfoFromNative(path, metadata.frontmatter);
    }
    
    /**
     * Get all tasks by scanning native metadata cache
     */
    async getAllTasks(): Promise<TaskInfo[]> {
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        const tasks: TaskInfo[] = [];
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo) tasks.push(taskInfo);
            }
        }
        
        return tasks;
    }
    
    /**
     * Get tasks for specific date (uses essential index)
     */
    getTasksForDate(date: string): string[] {
        this.ensureIndexesBuilt();
        const taskPaths = this.tasksByDate.get(date) || new Set();
        return Array.from(taskPaths);
    }
    
    /**
     * Get task paths by status (uses essential index)
     */
    getTaskPathsByStatus(status: string): string[] {
        this.ensureIndexesBuilt();
        const taskPaths = this.tasksByStatus.get(status) || new Set();
        return Array.from(taskPaths);
    }
    
    /**
     * Get overdue task paths (uses essential index)
     */
    getOverdueTaskPaths(): Set<string> {
        this.ensureIndexesBuilt();
        return new Set(this.overdueTasks);
    }
    
    /**
     * Get calendar data by computing on-demand
     */
    async getCalendarData(year: number, month: number): Promise<any> {
        const taskData = new Map();
        const noteData = new Map();
        const dailyNotesSet = new Set<string>();
        
        // Get all markdown files for note counting
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        // Use Obsidian's daily notes interface for daily notes detection
        try {
            const { getAllDailyNotes } = require('obsidian-daily-notes-interface');
            const allDailyNotes = getAllDailyNotes();
            
            for (const [dateStr] of Object.entries(allDailyNotes)) {
                dailyNotesSet.add(dateStr);
            }
        } catch (e) {
            // Daily notes interface not available, fallback to filename pattern matching
        }
        
        // Process all files to extract date information for notes
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata?.frontmatter) continue;
            
            const frontmatter = metadata.frontmatter;
            const isTask = frontmatter.tags?.includes(this.taskTag);
            
            if (!isTask && !this.disableNoteIndexing) {
                // This is a note - extract date information
                let noteDate: string | null = null;
                
                // Try to extract date from frontmatter
                if (frontmatter.dateCreated || frontmatter.date) {
                    const dateValue = frontmatter.dateCreated || frontmatter.date;
                    try {
                        const parsed = new Date(dateValue);
                        if (!isNaN(parsed.getTime())) {
                            noteDate = parsed.toISOString().split('T')[0];
                        }
                    } catch (e) {
                        // Ignore invalid dates
                    }
                }
                
                // Check if it's a daily note by filename pattern (fallback)
                if (!noteDate) {
                    const fileName = file.basename;
                    // Common daily note patterns: YYYY-MM-DD, YYYY-MM-DD HH-mm-ss, etc.
                    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        noteDate = dateMatch[1];
                        dailyNotesSet.add(noteDate);
                    }
                }
                
                if (noteDate) {
                    // Increment note count for this date
                    const currentCount = noteData.get(noteDate) || 0;
                    noteData.set(noteDate, currentCount + 1);
                }
            }
        }
        
        // Build task data for the requested month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // Get tasks for this date
            const taskPaths = this.getTasksForDate(dateKey);
            if (taskPaths.length > 0) {
                const tasks = await Promise.all(
                    taskPaths.map(path => this.getTaskInfo(path))
                );
                const validTasks = tasks.filter(task => task !== null) as TaskInfo[];
                
                if (validTasks.length > 0) {
                    // Create task summary info for calendar coloring
                    const taskSummary = {
                        count: validTasks.length,
                        hasDue: validTasks.some(task => task.due && !task.scheduled),
                        hasScheduled: validTasks.some(task => task.scheduled),
                        hasCompleted: validTasks.some(task => task.status === 'completed' || task.status === 'done'),
                        hasArchived: validTasks.some(task => task.archived),
                        tasks: validTasks
                    };
                    taskData.set(dateKey, taskSummary);
                }
            }
        }
        
        return { tasks: taskData, notes: noteData, dailyNotes: dailyNotesSet };
    }
    
    /**
     * Get all task paths by scanning native cache
     */
    getAllTaskPaths(): Set<string> {
        const taskPaths = new Set<string>();
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                taskPaths.add(file.path);
            }
        }
        
        return taskPaths;
    }
    
    /**
     * Get all statuses by computing on-demand from active tasks
     */
    getAllStatuses(): string[] {
        this.ensureIndexesBuilt();
        return Array.from(this.tasksByStatus.keys()).sort();
    }
    
    /**
     * Get all priorities by computing on-demand
     */
    getAllPriorities(): string[] {
        const priorities = new Set<string>();
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo?.priority) {
                    priorities.add(taskInfo.priority);
                }
            }
        }
        
        return Array.from(priorities).sort();
    }
    
    /**
     * Get all tags by computing on-demand
     */
    getAllTags(): string[] {
        const tags = new Set<string>();
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo?.tags) {
                    taskInfo.tags.forEach(tag => tags.add(tag));
                }
            }
        }
        
        return Array.from(tags).sort();
    }
    
    /**
     * Get all contexts by computing on-demand
     */
    getAllContexts(): string[] {
        const contexts = new Set<string>();
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo?.contexts) {
                    taskInfo.contexts.forEach(context => contexts.add(context));
                }
            }
        }
        
        return Array.from(contexts).sort();
    }
    
    // ========================================
    // BACKWARD COMPATIBILITY METHODS
    // ========================================
    
    /**
     * Sync version of getTaskInfo for editor extensions
     */
    getCachedTaskInfoSync(path: string): TaskInfo | null {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return null;
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter) return null;
        
        // Check if the note has the task tag
        if (!metadata.frontmatter.tags?.includes(this.taskTag)) return null;
        
        return this.extractTaskInfoFromNative(path, metadata.frontmatter);
    }
    
    /**
     * Alias methods for backward compatibility
     */
    async getCachedTaskInfo(path: string): Promise<TaskInfo | null> {
        return this.getTaskInfo(path);
    }
    
    async getTaskByPath(path: string): Promise<TaskInfo | null> {
        return this.getTaskInfo(path);
    }
    
    async getNotesForDate(date: Date): Promise<NoteInfo[]> {
        // Check if note indexing is disabled
        if (this.disableNoteIndexing) {
            return [];
        }
        
		const targetDateStr = getDatePart(date.toISOString()); // YYYY-MM-DD format
        const notes: NoteInfo[] = [];
        
        // Get all markdown files excluding task files and excluded folders
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata?.frontmatter) continue;
            
            const frontmatter = metadata.frontmatter;
            const isTask = frontmatter.tags?.includes(this.taskTag);
            
            // Skip task files - we only want notes
            if (isTask) continue;
            
            let noteDate: string | null = null;
            
            // Try to extract date from frontmatter using parseDate
            if (frontmatter.dateCreated || frontmatter.date) {
                const dateValue = frontmatter.dateCreated || frontmatter.date;
                try {
                    const parsed = parseDate(dateValue);
                    noteDate = getDatePart(parsed.toISOString());
                } catch (e) {
                    // Ignore invalid dates or parsing errors
                }
            }
            
            // If not found in frontmatter, try to extract from filename using parseDate
            if (!noteDate) {
                const fileName = file.basename;
                const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    try {
                        const parsed = parseDate(dateMatch[1]);
                        noteDate = getDatePart(parsed.toISOString());
                    } catch (e) {
                        // Ignore invalid dates or parsing errors
                    }
                }
            }
            
            // If we found a date and it matches our target date, include this note
            if (noteDate === targetDateStr) {
                // Extract tags from frontmatter or metadata
                let tags: string[] = [];
                if (frontmatter.tags) {
                    if (Array.isArray(frontmatter.tags)) {
                        tags = frontmatter.tags.filter(tag => typeof tag === 'string');
                    } else if (typeof frontmatter.tags === 'string') {
                        tags = [frontmatter.tags];
                    }
                }
                
                // Also include tags from Obsidian's tag parsing
                if (metadata.tags) {
                    const obsidianTags = metadata.tags.map(tag => tag.tag.replace('#', ''));
                    tags = [...new Set([...tags, ...obsidianTags])];
                }
                
                const noteInfo: NoteInfo = {
                    title: file.basename,
                    tags: tags,
                    path: file.path,
                    createdDate: noteDate,
                    lastModified: file.stat.mtime
                };
                
                notes.push(noteInfo);
            }
        }
        
        return notes;
    }
    
    async getTaskInfoForDate(date: Date): Promise<TaskInfo[]> {
        const dateStr = date.toISOString().split('T')[0];
        const taskPaths = this.getTasksForDate(dateStr);
        const tasks = await Promise.all(
            taskPaths.map(path => this.getTaskInfo(path))
        );
        return tasks.filter(task => task !== null) as TaskInfo[];
    }
    
    getTaskPathsByDate(dateStr: string): Set<string> {
        return new Set(this.getTasksForDate(dateStr));
    }
    
    getTaskPathsByPriority(priority: string): string[] {
        // Compute on-demand - no longer indexed
        const taskPaths: string[] = [];
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo?.priority === priority) {
                    taskPaths.push(file.path);
                }
            }
        }
        
        return taskPaths;
    }
    
    async rebuildDailyNotesCache(year: number, month: number): Promise<void> {
        // No-op - use Obsidian's daily notes interface
    }
    
    // ========================================
    // ESSENTIAL INDEX MANAGEMENT
    // ========================================
    
    private updateDateIndex(path: string, taskInfo: TaskInfo): void {
        // Remove from existing date indexes
        for (const taskSet of this.tasksByDate.values()) {
            taskSet.delete(path);
        }
        
        // Add to due date index
        if (taskInfo.due) {
            const dueDateKey = getDatePart(taskInfo.due);
            if (!this.tasksByDate.has(dueDateKey)) {
                this.tasksByDate.set(dueDateKey, new Set());
            }
            this.tasksByDate.get(dueDateKey)!.add(path);
        }
        
        // Add to scheduled date index
        if (taskInfo.scheduled) {
            const scheduledDateKey = getDatePart(taskInfo.scheduled);
            if (!this.tasksByDate.has(scheduledDateKey)) {
                this.tasksByDate.set(scheduledDateKey, new Set());
            }
            this.tasksByDate.get(scheduledDateKey)!.add(path);
        }
    }
    
    private updateStatusIndex(path: string, status: string): void {
        // Remove from all status indexes
        for (const statusSet of this.tasksByStatus.values()) {
            statusSet.delete(path);
        }
        
        // Add to new status index
        if (!this.tasksByStatus.has(status)) {
            this.tasksByStatus.set(status, new Set());
        }
        this.tasksByStatus.get(status)!.add(path);
    }
    
    private updateOverdueIndex(path: string, taskInfo: TaskInfo): void {
        this.overdueTasks.delete(path);
        
        // Check if task is overdue
        if (!taskInfo.recurrence) {
            const today = getTodayString();
            
            if (taskInfo.due && isBeforeDateSafe(taskInfo.due, today)) {
                this.overdueTasks.add(path);
            } else if (!taskInfo.due && taskInfo.scheduled && isBeforeDateSafe(taskInfo.scheduled, today)) {
                this.overdueTasks.add(path);
            }
        }
    }
    
    // ========================================
    // EVENT HANDLERS
    // ========================================
    
    private handleFileChanged(file: TFile, cache: any): void {
        if (!this.initialized) return;
        
        this.clearFileFromIndexes(file.path);
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
            this.indexTaskFile(file, metadata.frontmatter);
        }
        
        this.trigger('file-updated', { path: file.path, file });
    }
    
    private handleFileDeleted(path: string): void {
        if (!this.initialized) return;
        
        this.clearFileFromIndexes(path);
        this.trigger('file-deleted', { path });
    }
    
    private handleFileRenamed(file: TFile, oldPath: string): void {
        if (!this.initialized) return;
        
        this.clearFileFromIndexes(oldPath);
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
            this.indexTaskFile(file, metadata.frontmatter);
        }
        
        this.trigger('file-renamed', { oldPath, newPath: file.path, file });
    }
    
    // ========================================
    // UTILITY METHODS
    // ========================================
    
    private extractTaskInfoFromNative(path: string, frontmatter: any): TaskInfo | null {
        if (!this.fieldMapper) return null;
        
        try {
            const mappedTask = this.fieldMapper.mapFromFrontmatter(frontmatter, path, this.storeTitleInFilename);
            
            return {
                title: mappedTask.title || 'Untitled task',
                status: mappedTask.status || 'open',
                priority: mappedTask.priority || 'normal',
                due: mappedTask.due,
                scheduled: mappedTask.scheduled,
                path,
                archived: mappedTask.archived || false,
                tags: mappedTask.tags || [],
                contexts: mappedTask.contexts || [],
                recurrence: mappedTask.recurrence,
                complete_instances: mappedTask.complete_instances,
                completedDate: mappedTask.completedDate,
                timeEstimate: mappedTask.timeEstimate,
                timeEntries: mappedTask.timeEntries,
                dateCreated: mappedTask.dateCreated,
                dateModified: mappedTask.dateModified
            };
        } catch (error) {
            console.error(`Error extracting task info from native metadata for ${path}:`, error);
            return null;
        }
    }
    
    private isValidFile(path: string): boolean {
        return !this.excludedFolders.some(folder => path.startsWith(folder));
    }
    
    private clearFileFromIndexes(path: string): void {
        // Remove from date indexes
        for (const taskSet of this.tasksByDate.values()) {
            taskSet.delete(path);
        }
        
        // Remove from status indexes
        for (const statusSet of this.tasksByStatus.values()) {
            statusSet.delete(path);
        }
        
        // Remove from overdue tasks
        this.overdueTasks.delete(path);
    }
    
    private clearAllIndexes(): void {
        this.tasksByDate.clear();
        this.tasksByStatus.clear();
        this.overdueTasks.clear();
    }
    
    // ========================================
    // CACHE MANAGEMENT API
    // ========================================
    
    updateConfig(
        taskTag: string,
        excludedFolders: string,
        fieldMapper?: FieldMapper,
        disableNoteIndexing = false,
        storeTitleInFilename = false
    ): void {
        this.taskTag = taskTag;
        this.excludedFolders = excludedFolders 
            ? excludedFolders.split(',').map(folder => folder.trim())
            : [];
        this.fieldMapper = fieldMapper;
        this.disableNoteIndexing = disableNoteIndexing;
        this.storeTitleInFilename = storeTitleInFilename;
        
        if (this.initialized) {
            this.clearAllIndexes();
            this.indexesBuilt = false;
        }
    }
    
    clearCacheEntry(path: string): void {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                this.indexTaskFile(file, metadata.frontmatter);
            }
        }
    }
    
    async clearAllCaches(): Promise<void> {
        this.clearAllIndexes();
        this.indexesBuilt = false;
    }
    
    updateTaskInfoInCache(path: string, taskInfo: TaskInfo): void {
        // Native metadata cache handles this automatically
        // Just trigger our minimal index update
        if (this.indexesBuilt) {
            this.clearFileFromIndexes(path);
            this.updateDateIndex(path, taskInfo);
            this.updateStatusIndex(path, taskInfo.status);
            this.updateOverdueIndex(path, taskInfo);
        }
    }
    
    subscribe(eventName: string, callback: (data: any) => void): () => void {
        this.on(eventName, callback);
        return () => this.off(eventName, callback);
    }
    
    isInitialized(): boolean {
        return this.initialized;
    }
    
    getStats() {
        return {
            indexSizes: {
                tasksByDate: this.tasksByDate.size,
                tasksByStatus: this.tasksByStatus.size,
                overdueTasks: this.overdueTasks.size
            },
            memoryFootprint: 'Minimal - only essential indexes'
        };
    }
    
    destroy(): void {
        this.clearAllIndexes();
        this.initialized = false;
        this.indexesBuilt = false;
    }
}
