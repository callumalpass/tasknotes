import { TFile, App, Events, Component } from 'obsidian';
import { TaskInfo, NoteInfo, IndexedFile } from '../types';
import { FieldMapper } from '../services/FieldMapper';
import { 
    parseDate, 
    getTodayString, 
    isBeforeDateSafe, 
    getCurrentTimestamp,
    isOverdueTimeAware,
    getDatePart,
    hasTimeComponent
} from './dateUtils';

/**
 * Native metadata cache manager that leverages Obsidian's native metadata cache
 * and event system for optimal performance and memory usage.
 * 
 * Key Design Principles:
 * - Use app.metadataCache as the single source of truth for file metadata
 * - Leverage native events (metadataCache.on) for real-time updates
 * - Maintain only computed indexes for performance-critical queries
 * - Native implementation following Obsidian best practices
 */
export class NativeMetadataCacheManager extends Events {
    private app: App;
    private taskTag: string;
    private excludedFolders: string[];
    private fieldMapper?: FieldMapper;
    private disableNoteIndexing: boolean;
    
    // Computed indexes for performance (only what's not available natively)
    private tasksByDate: Map<string, Set<string>> = new Map(); // YYYY-MM-DD -> task paths
    private notesByDate: Map<string, Set<string>> = new Map(); // YYYY-MM-DD -> note paths  
    private tasksByStatus: Map<string, Set<string>> = new Map(); // status -> task paths
    private tasksByPriority: Map<string, Set<string>> = new Map(); // priority -> task paths
    private overdueTasks: Set<string> = new Set(); // overdue task paths
    private dailyNotes: Set<string> = new Set(); // daily note paths
    
    // Canonical sets for UI components
    private allTags: Set<string> = new Set();
    private allContexts: Set<string> = new Set();
    
    // Performance tracking
    private stats = {
        nativeCacheHits: 0,
        computedIndexHits: 0,
        fileProcessingTime: 0,
        indexUpdateTime: 0
    };
    
    // Initialization state
    private initialized: boolean = false;
    private indexesBuilt: boolean = false;
    
    constructor(
        app: App,
        taskTag: string,
        excludedFolders: string = '',
        fieldMapper?: FieldMapper,
        disableNoteIndexing: boolean = false
    ) {
        super();
        this.app = app;
        this.taskTag = taskTag;
        this.excludedFolders = excludedFolders 
            ? excludedFolders.split(',').map(folder => folder.trim())
            : [];
        this.fieldMapper = fieldMapper;
        this.disableNoteIndexing = disableNoteIndexing;
    }
    
    /**
     * Initialize the cache manager by setting up native event listeners
     * Indexes are built lazily when first accessed for optimal startup performance
     */
    initialize(): void {
        if (this.initialized) {
            return;
        }
        
        // Set up native metadata cache event listeners (lightweight)
        this.setupNativeEventListeners();
        
        this.initialized = true;
        
        // Emit initialization complete event (no heavy work done)
        this.trigger('cache-initialized', { message: 'Native cache ready - indexes will be built on demand' });
    }
    
    /**
     * Set up native event listeners for real-time cache updates
     */
    private setupNativeEventListeners(): void {
        // Listen to metadata cache changes for real-time updates
        this.app.metadataCache.on('changed', (file, data, cache) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileChanged(file, cache);
            }
        });
        
        // Listen to metadata cache deletions
        this.app.metadataCache.on('deleted', (file, prevCache) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileDeleted(file.path);
            }
        });
        
        // Listen to file renames
        this.app.vault.on('rename', (file, oldPath) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileRenamed(file, oldPath);
            }
        });
    }
    
    /**
     * Lazily build indexes when first accessed (non-blocking)
     * This happens in the background after the first request
     */
    private ensureIndexesBuilt(): void {
        if (this.indexesBuilt) {
            return;
        }
        
        this.indexesBuilt = true;
        
        // Build indexes in the background without blocking
        this.buildIndexesInBackground();
    }
    
    /**
     * Build indexes in background without blocking the main thread
     */
    private async buildIndexesInBackground(): Promise<void> {
        try {
            const startTime = performance.now();
            
            // Get all markdown files and process them
            const markdownFiles = this.app.vault.getMarkdownFiles();
            const validFiles = markdownFiles.filter(file => this.isValidFile(file.path));
            
            // Process files in small batches to avoid blocking
            const batchSize = 20;
            for (let i = 0; i < validFiles.length; i += batchSize) {
                const batch = validFiles.slice(i, i + batchSize);
                
                // Process batch
                for (const file of batch) {
                    try {
                        await this.processFileForIndexing(file);
                    } catch (error) {
                        console.error(`Error processing file ${file.path}:`, error);
                    }
                }
                
                // Yield control after each batch to prevent blocking
                await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            const endTime = performance.now();
            this.stats.fileProcessingTime = endTime - startTime;
            
            // Emit completion event
            this.trigger('indexes-built', this.getStats());
            
        } catch (error) {
            console.error('Error building indexes in background:', error);
        }
    }
    
    /**
     * Process a file for indexing using native metadata cache
     */
    private async processFileForIndexing(file: TFile): Promise<void> {
        try {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata?.frontmatter) {
                return;
            }
            
            const frontmatter = metadata.frontmatter;
            const isTask = frontmatter.tags?.includes(this.taskTag);
            
            if (isTask) {
                await this.indexTask(file, frontmatter);
            } else if (!this.disableNoteIndexing) {
                await this.indexNote(file, frontmatter);
            }
            
        } catch (error) {
            console.error(`Error processing file ${file.path} for indexing:`, error);
        }
    }
    
    /**
     * Index a task file using native metadata
     */
    private async indexTask(file: TFile, frontmatter: any): Promise<void> {
        try {
            const taskInfo = this.extractTaskInfoFromMetadata(file.path, frontmatter);
            if (!taskInfo) return;
            
            // Update date indexes
            this.updateTaskDateIndexes(file.path, taskInfo);
            
            // Update status index
            this.updateStatusIndex(file.path, taskInfo.status);
            
            // Update priority index  
            this.updatePriorityIndex(file.path, taskInfo.priority);
            
            // Update overdue index
            this.updateOverdueIndex(file.path, taskInfo);
            
            // Update tags and contexts
            this.updateTagsAndContexts(taskInfo);
            
        } catch (error) {
            console.error(`Error indexing task ${file.path}:`, error);
        }
    }
    
    /**
     * Index a note file using native metadata
     */
    private async indexNote(file: TFile, frontmatter: any): Promise<void> {
        try {
            const noteInfo = this.extractNoteInfoFromMetadata(file.path, frontmatter, file);
            if (!noteInfo) return;
            
            // Update note date index
            if (noteInfo.createdDate) {
                const dateKey = getDatePart(noteInfo.createdDate);
                if (!this.notesByDate.has(dateKey)) {
                    this.notesByDate.set(dateKey, new Set());
                }
                this.notesByDate.get(dateKey)!.add(file.path);
            }
            
        } catch (error) {
            console.error(`Error indexing note ${file.path}:`, error);
        }
    }
    
    /**
     * Extract TaskInfo from native metadata cache data
     */
    private extractTaskInfoFromMetadata(path: string, frontmatter: any): TaskInfo | null {
        try {
            if (!this.fieldMapper) {
                return null;
            }
            
            const mappedTask = this.fieldMapper.mapFromFrontmatter(frontmatter, path);
            
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
            console.error(`Error extracting task info from metadata for ${path}:`, error);
            return null;
        }
    }
    
    /**
     * Extract NoteInfo from native metadata cache data
     */
    private extractNoteInfoFromMetadata(path: string, frontmatter: any, file: TFile): NoteInfo | null {
        try {
            const title = frontmatter.title || path.split('/').pop()?.replace('.md', '') || 'Untitled';
            const tags = frontmatter.tags || [];
            const createdDate = frontmatter.dateCreated || frontmatter.date;
            
            return {
                title,
                tags,
                path,
                createdDate,
                lastModified: file.stat.mtime
            };
        } catch (error) {
            console.error(`Error extracting note info from metadata for ${path}:`, error);
            return null;
        }
    }
    
    // ========================================
    // PUBLIC API METHODS
    // ========================================
    
    /**
     * Get task info for a specific file using native metadata cache
     */
    async getTaskInfo(path: string): Promise<TaskInfo | null> {
        this.stats.nativeCacheHits++;
        
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            return null;
        }
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter) {
            return null;
        }
        
        return this.extractTaskInfoFromMetadata(path, metadata.frontmatter);
    }
    
    /**
     * Get all tasks for a specific date
     */
    getTasksForDate(date: string): string[] {
        this.ensureIndexesBuilt();
        this.stats.computedIndexHits++;
        const taskPaths = this.tasksByDate.get(date) || new Set();
        return Array.from(taskPaths);
    }
    
    /**
     * Get calendar data for a month using native metadata + computed indexes
     */
    async getCalendarData(year: number, month: number): Promise<any> {
        const taskData = new Map();
        const noteData = new Map();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // Get tasks for this date from computed index
            const taskPaths = this.getTasksForDate(dateKey);
            const tasks = await Promise.all(
                taskPaths.map(path => this.getTaskInfo(path))
            );
            const validTasks = tasks.filter(task => task !== null) as TaskInfo[];
            
            // Get notes for this date from computed index  
            const notePaths = this.notesByDate.get(dateKey) || new Set();
            const notes = await Promise.all(
                Array.from(notePaths).map(path => this.getNoteInfo(path))
            );
            const validNotes = notes.filter(note => note !== null) as NoteInfo[];
            
            if (validTasks.length > 0) {
                taskData.set(dateKey, validTasks);
            }
            if (validNotes.length > 0) {
                noteData.set(dateKey, validNotes);
            }
        }
        
        return {
            tasks: taskData,
            notes: noteData,
            dailyNotes: noteData
        };
    }
    
    /**
     * Get note info using native metadata cache
     */
    async getNoteInfo(path: string): Promise<NoteInfo | null> {
        this.stats.nativeCacheHits++;
        
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            return null;
        }
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter) {
            return null;
        }
        
        return this.extractNoteInfoFromMetadata(path, metadata.frontmatter, file);
    }
    
    /**
     * Get all tasks using native metadata cache
     */
    async getAllTasks(): Promise<TaskInfo[]> {
        const markdownFiles = this.app.vault.getMarkdownFiles().filter(file => 
            this.isValidFile(file.path)
        );
        
        const tasks = await Promise.all(
            markdownFiles.map(async file => {
                const metadata = this.app.metadataCache.getFileCache(file);
                if (!metadata?.frontmatter?.tags?.includes(this.taskTag)) {
                    return null;
                }
                return this.extractTaskInfoFromMetadata(file.path, metadata.frontmatter);
            })
        );
        
        return tasks.filter(task => task !== null) as TaskInfo[];
    }
    
    // ========================================
    // INDEX MANAGEMENT METHODS  
    // ========================================
    
    private updateTaskDateIndexes(path: string, taskInfo: TaskInfo): void {
        // Remove from existing date indexes
        this.removeFromDateIndexes(path);
        
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
    
    private updatePriorityIndex(path: string, priority: string): void {
        // Remove from all priority indexes
        for (const prioritySet of this.tasksByPriority.values()) {
            prioritySet.delete(path);
        }
        
        // Add to new priority index
        if (!this.tasksByPriority.has(priority)) {
            this.tasksByPriority.set(priority, new Set());
        }
        this.tasksByPriority.get(priority)!.add(path);
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
    
    private updateTagsAndContexts(taskInfo: TaskInfo): void {
        if (taskInfo.tags) {
            taskInfo.tags.forEach(tag => this.allTags.add(tag));
        }
        if (taskInfo.contexts) {
            taskInfo.contexts.forEach(context => this.allContexts.add(context));
        }
    }
    
    // ========================================
    // EVENT HANDLERS
    // ========================================
    
    private handleFileChanged(file: TFile, cache: any): void {
        if (!this.initialized || !this.isValidFile(file.path)) {
            return;
        }
        
        // Clear existing indexes for this file
        this.clearFileFromIndexes(file.path);
        
        // Re-index the file
        this.processFileForIndexing(file);
        
        // Emit change event
        this.trigger('file-updated', { path: file.path, file });
    }
    
    private handleFileDeleted(path: string): void {
        if (!this.initialized) {
            return;
        }
        
        this.clearFileFromIndexes(path);
        this.trigger('file-deleted', { path });
    }
    
    private handleFileRenamed(file: TFile, oldPath: string): void {
        if (!this.initialized) {
            return;
        }
        
        // Clear old path from indexes
        this.clearFileFromIndexes(oldPath);
        
        // Re-index with new path
        this.processFileForIndexing(file);
        
        this.trigger('file-renamed', { oldPath, newPath: file.path, file });
    }
    
    // ========================================
    // UTILITY METHODS
    // ========================================
    
    private isValidFile(path: string): boolean {
        return !this.excludedFolders.some(folder => path.startsWith(folder));
    }
    
    private clearFileFromIndexes(path: string): void {
        // Remove from date indexes
        this.removeFromDateIndexes(path);
        
        // Remove from status indexes
        for (const statusSet of this.tasksByStatus.values()) {
            statusSet.delete(path);
        }
        
        // Remove from priority indexes
        for (const prioritySet of this.tasksByPriority.values()) {
            prioritySet.delete(path);
        }
        
        // Remove from overdue tasks
        this.overdueTasks.delete(path);
        
        // Remove from daily notes
        this.dailyNotes.delete(path);
        
        // Remove from note date indexes
        for (const noteSet of this.notesByDate.values()) {
            noteSet.delete(path);
        }
    }
    
    private removeFromDateIndexes(path: string): void {
        for (const taskSet of this.tasksByDate.values()) {
            taskSet.delete(path);
        }
    }
    
    private clearAllIndexes(): void {
        this.tasksByDate.clear();
        this.notesByDate.clear();
        this.tasksByStatus.clear();
        this.tasksByPriority.clear();
        this.overdueTasks.clear();
        this.dailyNotes.clear();
        this.allTags.clear();
        this.allContexts.clear();
    }
    
    /**
     * Get performance statistics
     */
    getStats() {
        return {
            ...this.stats,
            indexSizes: {
                tasksByDate: this.tasksByDate.size,
                notesByDate: this.notesByDate.size,
                tasksByStatus: this.tasksByStatus.size,
                tasksByPriority: this.tasksByPriority.size,
                overdueTasks: this.overdueTasks.size,
                allTags: this.allTags.size,
                allContexts: this.allContexts.size
            }
        };
    }
    
    /**
     * Check if cache is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
    
    
    
    /**
     * Update configuration and reinitialize if needed
     */
    updateConfig(
        taskTag: string,
        excludedFolders: string,
        fieldMapper?: FieldMapper,
        disableNoteIndexing: boolean = false
    ): void {
        this.taskTag = taskTag;
        this.excludedFolders = excludedFolders 
            ? excludedFolders.split(',').map(folder => folder.trim())
            : [];
        this.fieldMapper = fieldMapper;
        this.disableNoteIndexing = disableNoteIndexing;
        
        // Clear indexes and mark for rebuild with new configuration
        if (this.initialized) {
            this.clearAllIndexes();
            this.indexesBuilt = false;
        }
    }
    
    // ========================================
    // ADDITIONAL API METHODS
    // ========================================
    
    /**
     * Get task paths by status using computed index
     */
    getTaskPathsByStatus(status: string): string[] {
        this.ensureIndexesBuilt();
        this.stats.computedIndexHits++;
        const taskPaths = this.tasksByStatus.get(status) || new Set();
        return Array.from(taskPaths);
    }
    
    /**
     * Get task paths by priority using computed index
     */
    getTaskPathsByPriority(priority: string): string[] {
        this.ensureIndexesBuilt();
        this.stats.computedIndexHits++;
        const taskPaths = this.tasksByPriority.get(priority) || new Set();
        return Array.from(taskPaths);
    }
    
    /**
     * Get all available statuses
     */
    getAllStatuses(): string[] {
        this.ensureIndexesBuilt();
        return Array.from(this.tasksByStatus.keys()).sort();
    }
    
    /**
     * Get all available priorities
     */
    getAllPriorities(): string[] {
        this.ensureIndexesBuilt();
        return Array.from(this.tasksByPriority.keys()).sort();
    }
    
    /**
     * Get all tags from tasks
     */
    getAllTags(): string[] {
        this.ensureIndexesBuilt();
        return Array.from(this.allTags).sort();
    }
    
    /**
     * Get all contexts from tasks
     */
    getAllContexts(): string[] {
        this.ensureIndexesBuilt();
        return Array.from(this.allContexts).sort();
    }
    
    /**
     * Get all task paths
     */
    getAllTaskPaths(): Set<string> {
        this.ensureIndexesBuilt();
        const taskPaths = new Set<string>();
        // Collect all paths from task indexes
        for (const statusSet of this.tasksByStatus.values()) {
            statusSet.forEach(path => taskPaths.add(path));
        }
        return taskPaths;
    }
    
    /**
     * Get task paths by date
     */
    getTaskPathsByDate(dateStr: string): Set<string> {
        this.ensureIndexesBuilt();
        return this.tasksByDate.get(dateStr) || new Set();
    }
    
    /**
     * Get overdue task paths
     */
    getOverdueTaskPaths(): Set<string> {
        this.ensureIndexesBuilt();
        return new Set(this.overdueTasks);
    }
    

    /**
     * Get cached task info synchronously using native metadata cache
     * This is for use in synchronous contexts like State Fields
     */
    getCachedTaskInfoSync(path: string): TaskInfo | null {
        this.stats.nativeCacheHits++;
        
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            return null;
        }
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter) {
            return null;
        }
        
        return this.extractTaskInfoFromMetadata(path, metadata.frontmatter);
    }
    
    
    
    
    
    /**
     * Destroy and cleanup
     */
    destroy(): void {
        // Clear all indexes
        this.clearAllIndexes();
        // Reset initialization state
        this.initialized = false;
    }
    
    /**
     * Subscribe to events
     */
    subscribe(eventName: string, callback: (data: any) => void): () => void {
        this.on(eventName, callback);
        return () => this.off(eventName, callback);
    }
    
    /**
     * Update task info in cache (no-op in native implementation)
     * Native cache handles this automatically via metadata cache events
     */
    updateTaskInfoInCache(path: string, taskInfo: TaskInfo): void {
        // Native implementation automatically updates via metadata cache events
        // No manual cache updates needed
    }
    
    /**
     * Get task info with caching (alias for getTaskInfo)
     */
    async getCachedTaskInfo(path: string): Promise<TaskInfo | null> {
        return this.getTaskInfo(path);
    }
    
    /**
     * Get notes for a specific date
     */
    async getNotesForDate(date: Date): Promise<any[]> {
        const dateStr = date.toISOString().split('T')[0];
        const notePaths = this.notesByDate.get(dateStr) || new Set();
        const notes = await Promise.all(
            Array.from(notePaths).map(path => this.getNoteInfo(path))
        );
        return notes.filter(note => note !== null);
    }
    
    /**
     * Get task info for a specific date
     */
    async getTaskInfoForDate(date: Date): Promise<TaskInfo[]> {
        const dateStr = date.toISOString().split('T')[0];
        const taskPaths = this.getTasksForDate(dateStr);
        const tasks = await Promise.all(
            taskPaths.map(path => this.getTaskInfo(path))
        );
        return tasks.filter(task => task !== null) as TaskInfo[];
    }
    
    /**
     * Get task by path (alias for getTaskInfo)
     */
    async getTaskByPath(path: string): Promise<TaskInfo | null> {
        return this.getTaskInfo(path);
    }
    
    /**
     * Rebuild daily notes cache (no-op in native implementation)
     * Native implementation handles this automatically via metadata cache events
     */
    async rebuildDailyNotesCache(year: number, month: number): Promise<void> {
        // Native implementation doesn't need manual cache rebuilding
        // This is handled automatically by metadata cache events
    }
    
    /**
     * Clear cache entry and re-index file
     */
    clearCacheEntry(path: string): void {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            this.processFileForIndexing(file);
        }
    }
    
    /**
     * Clear all caches and mark for lazy rebuild
     */
    async clearAllCaches(): Promise<void> {
        this.clearAllIndexes();
        this.indexesBuilt = false;
        // Indexes will be rebuilt lazily when next accessed
    }
}