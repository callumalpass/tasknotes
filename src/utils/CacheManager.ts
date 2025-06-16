import { TFile, Vault, normalizePath } from 'obsidian';
import { TaskInfo, NoteInfo, IndexedFile, FileEventHandlers } from '../types';
import { extractNoteInfo, extractTaskInfo, debounce } from './helpers';
import { FieldMapper } from '../services/FieldMapper';
import { YAMLCache } from './YAMLCache';
import * as YAML from 'yaml';
import { format } from 'date-fns';
import { 
    getAllDailyNotes, 
    getDailyNote 
} from 'obsidian-daily-notes-interface';
import { 
    parseDate, 
    getTodayString, 
    isBeforeDateSafe, 
    createSafeDate, 
    getCurrentTimestamp, 
    parseTimestamp,
    isOverdueTimeAware,
    getDatePart,
    hasTimeComponent
} from './dateUtils';

/**
 * Unified cache manager that provides centralized data access and caching
 * for all file operations in the TaskNotes plugin. This eliminates redundant
 * file reads and provides instant data access for UI components.
 */
export class CacheManager {
    private vault: Vault;
    
    // Core cache structures
    private fileContentCache: Map<string, { content: string; mtime: number; }> = new Map();
    private yamlCache: Map<string, { data: any; timestamp: number; }> = new Map();
    private taskInfoCache: Map<string, TaskInfo> = new Map();
    private noteInfoCache: Map<string, NoteInfo> = new Map();
    private indexedFilesCache: Map<string, IndexedFile> = new Map();
    
    // Index caches for fast lookups
    private tasksByDate: Map<string, Set<string>> = new Map(); // date -> task paths (due OR scheduled dates)
    private notesByDate: Map<string, Set<string>> = new Map(); // date -> note paths
    private tasksByStatus: Map<string, Set<string>> = new Map(); // status -> task paths
    private tasksByPriority: Map<string, Set<string>> = new Map(); // priority -> task paths
    private overdueTasks: Set<string> = new Set(); // paths of tasks that are overdue as of last cache update
    private dailyNotes: Set<string> = new Set(); // daily note paths in YYYY-MM-DD format
    
    // Canonical sets for tags and contexts
    private allTags: Set<string> = new Set(); // all unique tags across all tasks
    private allContexts: Set<string> = new Set(); // all unique contexts across all tasks
    
    // Configuration
    private taskTag: string;
    private excludedFolders: string[];
    private fieldMapper: FieldMapper | null = null;
    
    // Cache settings
    private static readonly FILE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
    private static readonly YAML_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private static readonly MAX_CACHE_SIZE = 500; // files
    private static readonly MAX_TASK_CACHE_SIZE = 1000; // tasks
    private static readonly MAX_NOTE_CACHE_SIZE = 2000; // notes
    private static readonly MAX_INDEX_SIZE = 10000; // index entries
    private static readonly MEMORY_WARNING_THRESHOLD = 100 * 1024 * 1024; // 100MB
    private static readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    // Performance tracking
    private stats = {
        cacheHits: 0,
        cacheMisses: 0,
        fileReads: 0,
        yamlParses: 0,
        memoryUsage: 0,
        cacheEvictions: 0,
        lastMemoryCheck: 0
    };
    
    // Event handlers for cleanup
    private eventHandlers: FileEventHandlers = {};
    private subscribers: Map<string, Set<(data: any) => void>> = new Map();
    
    // Track recent programmatic updates to prevent file event interference
    private recentUpdates: Map<string, number> = new Map(); // path -> timestamp
    private static readonly RECENT_UPDATE_WINDOW = 1000; // 1 second
    
    // Cleanup and monitoring
    private lastCacheCleanup: number = Date.now();
    private memoryCheckInterval: number | null = null;
    
    private delayedInitTimeout: NodeJS.Timeout | null = null;
    
    // Initialization state
    private initializationPromise: Promise<void> | null = null;
    private initialized: boolean = false;
    private delayedInitializationScheduled: boolean = false;
    
    constructor(
        vault: Vault, 
        taskTag: string, 
        excludedFolders: string = '', 
        fieldMapper?: FieldMapper
    ) {
        this.vault = vault;
        this.taskTag = taskTag;
        this.excludedFolders = excludedFolders 
            ? excludedFolders.split(',').map(folder => folder.trim())
            : [];
        this.fieldMapper = fieldMapper || null;
        
        // Don't register file events in constructor - they will be registered during initialization
    }
    
    /**
     * Check if the cache has been initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
    
    /**
     * Subscribe to data changes for specific data types
     */
    subscribe(dataType: string, callback: (data: any) => void): () => void {
        if (!this.subscribers.has(dataType)) {
            this.subscribers.set(dataType, new Set());
        }
        this.subscribers.get(dataType)!.add(callback);
        
        // Return unsubscribe function
        return () => {
            const subscribers = this.subscribers.get(dataType);
            if (subscribers) {
                subscribers.delete(callback);
                if (subscribers.size === 0) {
                    this.subscribers.delete(dataType);
                }
            }
        };
    }
    
    /**
     * Notify subscribers of data changes
     */
    private notifySubscribers(dataType: string, data: any): void {
        const subscribers = this.subscribers.get(dataType);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in cache subscriber for ${dataType}:`, error);
                }
            });
        }
    }
    
    /**
     * Get cached file content or read from disk if not cached
     */
    async getFileContent(path: string, forceRefresh = false): Promise<string | null> {
        const file = this.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile) || file.extension !== 'md') {
            return null;
        }
        
        const cached = this.fileContentCache.get(path);
        const now = Date.now();
        
        // Use cache if available, not expired, and not forcing refresh
        if (!forceRefresh && cached && (now - cached.mtime < CacheManager.FILE_CACHE_TTL)) {
            this.stats.cacheHits++;
            return cached.content;
        }
        
        try {
            const content = await this.vault.cachedRead(file);
            this.stats.fileReads++;
            
            // Update cache
            this.fileContentCache.set(path, {
                content,
                mtime: now
            });
            
            // Evict old entries if cache is too large
            this.evictFileCache();
            
            return content;
        } catch (error) {
            console.error(`Error reading file ${path}:`, error);
            return null;
        }
    }
    
    /**
     * Parse YAML content with caching
     */
    parseYAML(content: string, cacheKey: string): any {
        const cached = this.yamlCache.get(cacheKey);
        const now = Date.now();
        
        // Use cached value if available and not expired
        if (cached && now - cached.timestamp < CacheManager.YAML_CACHE_TTL) {
            return cached.data;
        }
        
        try {
            const result = YAML.parse(content);
            this.stats.yamlParses++;
            
            this.yamlCache.set(cacheKey, {
                data: result,
                timestamp: now
            });
            
            // Cleanup expired entries
            this.cleanupYAMLCache();
            
            return result;
        } catch (error) {
            console.error('Error parsing YAML content:', error);
            return null;
        }
    }
    
    /**
     * Extract and parse frontmatter from markdown content
     */
    extractFrontmatter(content: string, cacheKey: string): any {
        if (!content.startsWith('---')) {
            return null;
        }
        
        const endOfFrontmatter = content.indexOf('---', 3);
        if (endOfFrontmatter === -1) {
            return null;
        }
        
        const frontmatter = content.substring(3, endOfFrontmatter);
        return this.parseYAML(frontmatter, cacheKey);
    }
    
    /**
     * Get task info for a specific file
     */
    async getTaskInfo(path: string, forceRefresh = false): Promise<TaskInfo | null> {
        // Check cache first
        if (!forceRefresh && this.taskInfoCache.has(path)) {
            const cachedTask = this.taskInfoCache.get(path)!;
            this.stats.cacheHits++;
            return cachedTask;
        }
        
        // If forcing refresh, clear related caches
        if (forceRefresh) {
            this.taskInfoCache.delete(path);
            this.yamlCache.delete(path);
            YAMLCache.clearCacheEntry(path);
        }
        
        const content = await this.getFileContent(path, forceRefresh);
        if (!content) {
            return null;
        }
        try {
            const taskInfo = extractTaskInfo(content, path, this.fieldMapper || undefined);
            
            if (taskInfo) {
                this.taskInfoCache.set(path, taskInfo);
                this.updateTaskIndexes(path, taskInfo);
                this.stats.cacheMisses++;
                return taskInfo;
            }
        } catch (error) {
            console.error(`Error extracting task info from ${path}:`, error);
        }
        
        return null;
    }
    
    /**
     * Get note info for a specific file
     */
    async getNoteInfo(path: string, forceRefresh = false): Promise<NoteInfo | null> {
        // Check cache first
        if (!forceRefresh && this.noteInfoCache.has(path)) {
            this.stats.cacheHits++;
            return this.noteInfoCache.get(path)!;
        }
        
        const content = await this.getFileContent(path, forceRefresh);
        if (!content) {
            return null;
        }
        
        const file = this.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            return null;
        }
        
        try {
            const noteInfo = extractNoteInfo(content, path, file);
            
            if (noteInfo) {
                this.noteInfoCache.set(path, noteInfo);
                this.updateNoteIndexes(path, noteInfo);
                this.stats.cacheMisses++;
                return noteInfo;
            }
        } catch (error) {
            console.error(`Error extracting note info from ${path}:`, error);
        }
        
        return null;
    }
    
    /**
     * Get all tasks
     * The date parameter is kept for compatibility but filtering should happen in the view layer
     */
    async getTasksForDate(date: Date, forceRefresh = false): Promise<TaskInfo[]> {
        // Ensure cache is initialized first
        await this.ensureInitialized();
        
        // Return ALL tasks, not filtered by date - let the view layer handle filtering
        // Return all tasks for flexible filtering in views
        const results: TaskInfo[] = [];
        
        // If forcing refresh, clear caches first
        if (forceRefresh) {
            this.clearAllCaches();
            await this.performInitialization();
            this.initialized = true;
        }
        
        // Get all task paths from the indexed files cache
        const allTaskPaths = Array.from(this.taskInfoCache.keys());
        
        // If we don't have cached tasks, try to load them from indexed files
        if (allTaskPaths.length === 0) {
            const allIndexedPaths = Array.from(this.indexedFilesCache.keys())
                .filter(path => {
                    const indexed = this.indexedFilesCache.get(path);
                    return indexed?.isTask;
                });
            
            // If we have no indexed task files either, rebuild the cache
            if (allIndexedPaths.length === 0 && !forceRefresh) {
                await this.initializeCache();
                
                // Try again after rebuild
                const rebuiltIndexedPaths = Array.from(this.indexedFilesCache.keys())
                    .filter(path => {
                        const indexed = this.indexedFilesCache.get(path);
                        return indexed?.isTask;
                    });
                
                // Process rebuilt indexed files
                const rebuiltPromises = rebuiltIndexedPaths.map(path => this.getTaskInfo(path, true));
                const rebuiltResults = await Promise.all(rebuiltPromises);
                rebuiltResults.forEach(task => {
                    if (task) results.push(task);
                });
            } else {
                // Process existing indexed files
                const existingPromises = allIndexedPaths.map(path => this.getTaskInfo(path, forceRefresh));
                const existingResults = await Promise.all(existingPromises);
                existingResults.forEach(task => {
                    if (task) results.push(task);
                });
            }
        } else {
            // Use cached task info
            const taskInfos = Array.from(this.taskInfoCache.values());
            results.push(...taskInfos);
        }
        
        return results;
    }
    
    /**
     * Get tasks that are due or scheduled on a specific date (for calendar highlighting)
     */
    async getTasksDueOnDate(date: Date): Promise<TaskInfo[]> {
        // Ensure cache is initialized first
        await this.ensureInitialized();
        const dateStr = format(date, 'yyyy-MM-dd'); // CORRECT: Uses local timezone
        const taskPaths = this.tasksByDate.get(dateStr) || new Set();
        const results: TaskInfo[] = [];
        
        // Process all at once for simplicity and reliability
        const pathArray = Array.from(taskPaths);
        const batchPromises = pathArray.map(path => this.getTaskInfo(path, false));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(task => {
            if (task) results.push(task);
        });
        
        return results;
    }
    
    /**
     * Get notes for a specific date
     */
    async getNotesForDate(date: Date, forceRefresh = false): Promise<NoteInfo[]> {
        // Ensure cache is initialized first
        await this.ensureInitialized();
        const dateStr = format(date, 'yyyy-MM-dd'); // CORRECT: Uses local timezone
        const notePaths = this.notesByDate.get(dateStr) || new Set();
        const results: NoteInfo[] = [];
        
        // Process all at once for simplicity and reliability
        const pathArray = Array.from(notePaths);
        const batchPromises = pathArray.map(path => this.getNoteInfo(path, forceRefresh));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(note => {
            if (note) results.push(note);
        });
        
        return results;
    }
    
    /**
     * Get calendar data for a specific month
     */
    async getCalendarData(year: number, month: number, forceRefresh = false): Promise<{
        notes: Map<string, number>,
        tasks: Map<string, {
            count: number,
            hasDue: boolean,
            hasScheduled: boolean,
            hasCompleted: boolean,
            hasArchived: boolean
        }>,
        dailyNotes: Set<string>
    }> {
        // This method aggregates data from the indexes
        const startOfMonth = createSafeDate(year, month, 1);
        const endOfMonth = createSafeDate(year, month + 1, 0);
        
        const notesMap = new Map<string, number>();
        const tasksMap = new Map<string, {
            count: number,
            hasDue: boolean,
            hasScheduled: boolean,
            hasCompleted: boolean,
            hasArchived: boolean
        }>();
        
        // Aggregate notes by date
        for (const [dateStr, notePaths] of this.notesByDate) {
            const date = parseDate(dateStr);
            if (date >= startOfMonth && date <= endOfMonth) {
                notesMap.set(dateStr, notePaths.size);
            }
        }
        
        // Aggregate tasks by date
        for (const [dateStr, taskPaths] of this.tasksByDate) {
            const date = parseDate(dateStr);
            if (date >= startOfMonth && date <= endOfMonth) {
                const taskInfos = await Promise.all(
                    Array.from(taskPaths).map(path => this.getTaskInfo(path))
                );
                
                const validTasks = taskInfos.filter(Boolean) as TaskInfo[];
                if (validTasks.length > 0) {
                    // Check if any tasks have due dates or scheduled dates for this date
                    // Use date part comparison to handle both date-only and datetime formats
                    const hasDue = validTasks.some(t => t.due && getDatePart(t.due) === dateStr);
                    const hasScheduled = validTasks.some(t => t.scheduled && getDatePart(t.scheduled) === dateStr);
                    
                    tasksMap.set(dateStr, {
                        count: validTasks.length,
                        hasDue: hasDue,
                        hasScheduled: hasScheduled,
                        hasCompleted: validTasks.some(t => t.status === 'done'),
                        hasArchived: validTasks.some(t => t.archived)
                    });
                }
            }
        }
        
        // Filter daily notes for the month
        const monthlyDailyNotes = new Set<string>();
        this.dailyNotes.forEach(noteDate => {
            const date = new Date(noteDate);
            if (date.getFullYear() === year && date.getMonth() === month) {
                monthlyDailyNotes.add(noteDate);
            }
        });
        
        return {
            notes: notesMap,
            tasks: tasksMap,
            dailyNotes: monthlyDailyNotes
        };
    }
    
    /**
     * Initialize the cache by scanning all markdown files
     */
    async initializeCache(): Promise<void> {
        // If already initialized, return immediately
        if (this.initialized) {
            return;
        }
        
        // If initialization is already in progress, return the existing promise
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        // Create and store the initialization promise
        this.initializationPromise = this.performInitialization();
        
        try {
            await this.initializationPromise;
            this.initialized = true;
        } catch (error) {
            console.error('CacheManager: Initialization failed:', error);
            // Reset the promise so it can be retried
            this.initializationPromise = null;
            throw error;
        }
    }
    
    private async performInitialization(): Promise<void> {
        const start = performance.now();
        
        // Register file events first
        this.registerFileEvents();
        
        // Clear existing caches
        this.clearAllCaches();
        
        // Initialize daily notes cache from core plugin
        this.initializeDailyNotesCache();
        
        // Get all markdown files
        const files = this.vault.getMarkdownFiles();
        
        if (files.length === 0) {
            // Schedule a delayed re-initialization when vault is ready
            this.scheduleDelayedInitialization();
            return;
        }
        
        // Process files synchronously for reliability
        await Promise.all(files.map(file => this.indexFile(file)));
        
        // Rebuild overdue tasks index for all cached tasks
        this.rebuildOverdueTasksIndex();
        
        const end = performance.now();
        
        // Notify subscribers
        this.notifySubscribers('cache-initialized', {
            taskCount: this.taskInfoCache.size,
            noteCount: this.noteInfoCache.size,
            duration: end - start
        });
    }
    
    /**
     * Initialize daily notes cache from core plugin
     */
    private initializeDailyNotesCache(): void {
        try {
            // Get all daily notes from the core plugin
            const allDailyNotes = getAllDailyNotes();
            
            // Clear existing daily notes cache
            this.dailyNotes.clear();
            
            // Populate daily notes cache
            for (const [dateUID, file] of Object.entries(allDailyNotes)) {
                // The dateUID format can be:
                // - "YYYY-MM-DD" 
                // - "day-YYYY-MM-DD"
                // - "day-YYYY-MM-DDTHH:mm:ss+TZ" (ISO datetime)
                let dateStr = dateUID;
                if (dateUID.startsWith('day-')) {
                    dateStr = dateUID.replace('day-', '');
                }
                
                // Extract just the date part if it's an ISO datetime
                if (dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                }
                
                this.dailyNotes.add(dateStr);
            }
            
        } catch (error) {
            // Daily Notes interface not available, skip initialization
            console.warn('Daily Notes interface not available, skipping daily notes cache initialization:', error);
        }
    }
    
    /**
     * Schedule delayed initialization when vault becomes ready
     */
    private scheduleDelayedInitialization(): void {
        if (this.delayedInitializationScheduled) {
            return;
        }
        
        this.delayedInitializationScheduled = true;
        
        // Try again in a few seconds
        this.delayedInitTimeout = setTimeout(async () => {
            this.delayedInitTimeout = null;
            
            try {
                const files = this.vault.getMarkdownFiles();
                
                if (files.length > 0) {
                    this.initialized = false;
                    this.initializationPromise = null;
                    await this.initializeCache();
                } else {
                    this.delayedInitializationScheduled = false;
                    this.scheduleDelayedInitialization();
                }
            } catch (error) {
                console.error('Delayed initialization failed:', error);
                this.delayedInitializationScheduled = false;
            }
        }, 2000); // Wait 2 seconds before retry
    }
    
    /**
     * Ensure cache is initialized before proceeding with operations
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initialized) {
            return;
        }
        
        if (this.initializationPromise) {
            await this.initializationPromise;
        } else {
            // If no initialization is in progress, start it
            await this.initializeCache();
        }
    }
    
    /**
     * Index a single file and update caches
     */
    async indexFile(file: TFile): Promise<void> {
        if (file.extension !== 'md' || this.isExcluded(file.path)) {
            return;
        }
        
        try {
            const content = await this.getFileContent(file.path, true);
            if (!content) return;
            
            // Check if this is a task file
            const frontmatter = this.extractFrontmatter(content, file.path);
            const isTask = frontmatter?.tags?.includes(this.taskTag);
            
            
            // Create indexed file entry
            const indexedFile: IndexedFile = {
                path: file.path,
                mtime: file.stat.mtime,
                ctime: file.stat.ctime,
                tags: frontmatter?.tags || [],
                isTask
            };
            
            this.indexedFilesCache.set(file.path, indexedFile);
            
            // Process as task or note
            if (isTask) {
                await this.getTaskInfo(file.path, true);
            } else {
                await this.getNoteInfo(file.path, true);
            }
            
            // Check if it's a daily note
            this.updateDailyNotesIndex(file.path);
            
        } catch (error) {
            console.error(`Error indexing file ${file.path}:`, error);
        }
    }
    
    /**
     * Update task indexes when task info changes
     */
    private updateTaskIndexes(path: string, taskInfo: TaskInfo): void {
        // Get old task info for targeted removal
        const oldTaskInfo = this.taskInfoCache.get(path);
        
        // Remove from old indexes using targeted removal
        this.removeFromIndexes(path, 'task', oldTaskInfo);
        
        // Add to new indexes
        if (taskInfo.due) {
            const dateStr = taskInfo.due;
            if (!this.tasksByDate.has(dateStr)) {
                this.tasksByDate.set(dateStr, new Set());
            }
            this.tasksByDate.get(dateStr)!.add(path);
        }
        
        // Add scheduled date to the same index
        if (taskInfo.scheduled) {
            const dateStr = taskInfo.scheduled;
            if (!this.tasksByDate.has(dateStr)) {
                this.tasksByDate.set(dateStr, new Set());
            }
            this.tasksByDate.get(dateStr)!.add(path);
        }
        
        if (taskInfo.status) {
            if (!this.tasksByStatus.has(taskInfo.status)) {
                this.tasksByStatus.set(taskInfo.status, new Set());
            }
            this.tasksByStatus.get(taskInfo.status)!.add(path);
        }
        
        if (taskInfo.priority) {
            if (!this.tasksByPriority.has(taskInfo.priority)) {
                this.tasksByPriority.set(taskInfo.priority, new Set());
            }
            this.tasksByPriority.get(taskInfo.priority)!.add(path);
        }
        
        // Update overdue tasks index
        this.updateOverdueTaskIndex(path, taskInfo);
        
        // Update canonical sets for tags and contexts
        if (taskInfo.tags && Array.isArray(taskInfo.tags)) {
            taskInfo.tags.forEach(tag => {
                if (tag && typeof tag === 'string') {
                    this.allTags.add(tag);
                }
            });
        }
        
        if (taskInfo.contexts && Array.isArray(taskInfo.contexts)) {
            taskInfo.contexts.forEach(context => {
                if (context && typeof context === 'string') {
                    this.allContexts.add(context);
                }
            });
        }
    }
    
    /**
     * Update note indexes when note info changes
     */
    private updateNoteIndexes(path: string, noteInfo: NoteInfo): void {
        // Get old note info for targeted removal
        const oldNoteInfo = this.noteInfoCache.get(path);
        
        // Remove from old indexes using targeted removal
        this.removeFromIndexes(path, 'note', oldNoteInfo);
        
        // Add to new indexes
        if (noteInfo.createdDate) {
            // Extract just the date part - handle both YYYY-MM-DD and full ISO timestamps
            const dateStr = noteInfo.createdDate.includes('T') 
                ? noteInfo.createdDate.split('T')[0] 
                : noteInfo.createdDate;
            if (!this.notesByDate.has(dateStr)) {
                this.notesByDate.set(dateStr, new Set());
            }
            this.notesByDate.get(dateStr)!.add(path);
        }
    }
    
    /**
     * Update daily notes index
     */
    private updateDailyNotesIndex(path: string): void {
        try {
            // Get all daily notes from the core plugin
            const allDailyNotes = getAllDailyNotes();
            
            // Check if this file path is one of the daily notes
            for (const [dateUID, file] of Object.entries(allDailyNotes)) {
                if (file.path === path) {
                    // Extract date from dateUID
                    let dateStr = dateUID;
                    if (dateUID.startsWith('day-')) {
                        dateStr = dateUID.replace('day-', '');
                    }
                    
                    // Extract just the date part if it's an ISO datetime
                    if (dateStr.includes('T')) {
                        dateStr = dateStr.split('T')[0];
                    }
                    
                    this.dailyNotes.add(dateStr);
                    break;
                }
            }
        } catch (error) {
            // Fallback: if daily notes interface fails, skip daily notes detection
            console.warn('Daily Notes interface not available, skipping daily notes indexing for', path);
        }
    }
    
    /**
     * Remove file from indexes using targeted removal when old data is available
     */
    private removeFromIndexes(path: string, type?: 'task' | 'note', oldData?: TaskInfo | NoteInfo): void {
        if (oldData && type === 'task') {
            // Targeted removal for tasks using old task data
            const oldTask = oldData as TaskInfo;
            
            // Remove from specific date index (due date)
            if (oldTask.due) {
                const dateStr = oldTask.due;
                const pathSet = this.tasksByDate.get(dateStr);
                if (pathSet) {
                    pathSet.delete(path);
                    if (pathSet.size === 0) {
                        this.tasksByDate.delete(dateStr);
                    }
                }
            }
            
            // Remove from specific date index (scheduled date)
            if (oldTask.scheduled) {
                const dateStr = oldTask.scheduled;
                const pathSet = this.tasksByDate.get(dateStr);
                if (pathSet) {
                    pathSet.delete(path);
                    if (pathSet.size === 0) {
                        this.tasksByDate.delete(dateStr);
                    }
                }
            }
            
            // Remove from specific status index
            if (oldTask.status) {
                const pathSet = this.tasksByStatus.get(oldTask.status);
                if (pathSet) {
                    pathSet.delete(path);
                    if (pathSet.size === 0) {
                        this.tasksByStatus.delete(oldTask.status);
                    }
                }
            }
            
            // Remove from specific priority index
            if (oldTask.priority) {
                const pathSet = this.tasksByPriority.get(oldTask.priority);
                if (pathSet) {
                    pathSet.delete(path);
                    if (pathSet.size === 0) {
                        this.tasksByPriority.delete(oldTask.priority);
                    }
                }
            }
            
            // Remove from overdue tasks index (targeted removal)
            if (oldTask.due && !oldTask.recurrence) {
                const today = getTodayString();
                
                if (isBeforeDateSafe(oldTask.due, today)) {
                    this.overdueTasks.delete(path);
                }
            }
            
            // Rebuild canonical sets to ensure consistency
            this.rebuildCanonicalSets();
            
        } else if (oldData && type === 'note') {
            // Targeted removal for notes using old note data
            const oldNote = oldData as NoteInfo;
            
            if (oldNote.createdDate) {
                // Extract just the date part - handle both YYYY-MM-DD and full ISO timestamps
                const dateStr = oldNote.createdDate.includes('T') 
                    ? oldNote.createdDate.split('T')[0] 
                    : oldNote.createdDate;
                const pathSet = this.notesByDate.get(dateStr);
                if (pathSet) {
                    pathSet.delete(path);
                    if (pathSet.size === 0) {
                        this.notesByDate.delete(dateStr);
                    }
                }
            }
            
        } else {
            // Fallback to full scan when old data is not available
            // This maintains backward compatibility for cases where old data isn't known
            
            // Remove from all date indexes
            for (const [dateStr, paths] of this.tasksByDate) {
                paths.delete(path);
                if (paths.size === 0) {
                    this.tasksByDate.delete(dateStr);
                }
            }
            
            for (const [dateStr, paths] of this.notesByDate) {
                paths.delete(path);
                if (paths.size === 0) {
                    this.notesByDate.delete(dateStr);
                }
            }
            
            // Remove from other task indexes
            for (const [status, paths] of this.tasksByStatus) {
                paths.delete(path);
                if (paths.size === 0) {
                    this.tasksByStatus.delete(status);
                }
            }
            
            for (const [priority, paths] of this.tasksByPriority) {
                paths.delete(path);
                if (paths.size === 0) {
                    this.tasksByPriority.delete(priority);
                }
            }
            
            // Remove from overdue tasks index (fallback removal)
            this.overdueTasks.delete(path);
            
            // For canonical sets, rebuild when a task is removed
            if (type === 'task') {
                this.rebuildCanonicalSets();
            }
        }
        
        // Remove from daily notes if applicable (this doesn't need old data)
        try {
            const allDailyNotes = getAllDailyNotes();
            for (const [dateUID, file] of Object.entries(allDailyNotes)) {
                if (file.path === path) {
                    // Extract date from dateUID
                    let dateStr = dateUID;
                    if (dateUID.startsWith('day-')) {
                        dateStr = dateUID.replace('day-', '');
                    }
                    
                    // Extract just the date part if it's an ISO datetime
                    if (dateStr.includes('T')) {
                        dateStr = dateStr.split('T')[0];
                    }
                    
                    this.dailyNotes.delete(dateStr);
                    break;
                }
            }
        } catch (error) {
            // Fallback: try to detect if it was a daily note by filename pattern
            const fileName = path.split('/').pop() || '';
            if (/^\d{4}-\d{2}-\d{2}\.md$/.test(fileName)) {
                const dateStr = fileName.replace('.md', '');
                this.dailyNotes.delete(dateStr);
            }
        }
    }
    
    /**
     * Rebuild canonical sets for tags and contexts from current task cache
     */
    private rebuildCanonicalSets(): void {
        this.allTags.clear();
        this.allContexts.clear();
        
        for (const taskInfo of this.taskInfoCache.values()) {
            if (taskInfo.tags && Array.isArray(taskInfo.tags)) {
                taskInfo.tags.forEach(tag => {
                    if (tag && typeof tag === 'string') {
                        this.allTags.add(tag);
                    }
                });
            }
            
            if (taskInfo.contexts && Array.isArray(taskInfo.contexts)) {
                taskInfo.contexts.forEach(context => {
                    if (context && typeof context === 'string') {
                        this.allContexts.add(context);
                    }
                });
            }
        }
    }
    
    /**
     * Register file system event handlers
     */
    private registerFileEvents(): void {
        const debouncedUpdate = debounce((file: TFile) => {
            this.handleFileUpdate(file);
        }, 300);
        
        const debouncedAdd = debounce((file: TFile) => {
            this.handleFileAdd(file);
        }, 300);
        
        this.eventHandlers.modify = (file) => {
            if (file instanceof TFile) {
                debouncedUpdate(file);
            }
        };
        
        this.eventHandlers.delete = (file) => {
            if (file instanceof TFile) {
                this.handleFileDelete(file);
            }
        };
        
        this.eventHandlers.rename = (file, oldPath) => {
            if (file instanceof TFile) {
                this.handleFileRename(file, oldPath);
            }
        };
        
        this.eventHandlers.create = (file) => {
            if (file instanceof TFile) {
                debouncedAdd(file);
            }
        };
        
        // Register the events
        this.vault.on('modify', this.eventHandlers.modify);
        this.vault.on('delete', this.eventHandlers.delete);
        this.vault.on('rename', this.eventHandlers.rename);
        this.vault.on('create', this.eventHandlers.create);
    }
    
    /**
     * Handle file update events
     */
    private async handleFileUpdate(file: TFile): Promise<void> {
        // Check if this file was recently updated programmatically
        const recentUpdateTime = this.recentUpdates.get(file.path);
        const now = Date.now();
        
        if (recentUpdateTime && (now - recentUpdateTime) < CacheManager.RECENT_UPDATE_WINDOW) {
            // Skip cache clearing for recent programmatic updates to prevent race conditions
            // Clean up old tracking entries
            this.recentUpdates.delete(file.path);
            
            // Still notify subscribers but don't clear cache
            this.notifySubscribers('file-updated', { path: file.path });
            return;
        }
        
        // Clear caches for this file
        this.clearCacheEntry(file.path);
        
        // Re-index the file
        await this.indexFile(file);
        
        // Notify subscribers
        this.notifySubscribers('file-updated', { path: file.path });
    }
    
    /**
     * Handle file addition events
     */
    private async handleFileAdd(file: TFile): Promise<void> {
        await this.indexFile(file);
        this.notifySubscribers('file-added', { path: file.path });
    }
    
    /**
     * Handle file deletion events
     */
    private handleFileDelete(file: TFile): void {
        this.clearCacheEntry(file.path);
        this.removeFromIndexes(file.path);
        this.notifySubscribers('file-deleted', { path: file.path });
    }
    
    /**
     * Handle file rename events
     */
    private async handleFileRename(file: TFile, oldPath: string): Promise<void> {
        // Clear old caches
        this.clearCacheEntry(oldPath);
        this.removeFromIndexes(oldPath);
        
        // Index with new path
        await this.indexFile(file);
        
        this.notifySubscribers('file-renamed', { 
            oldPath, 
            newPath: file.path 
        });
    }
    
    /**
     * Clear cache entry for a specific file
     */
    clearCacheEntry(path: string): void {
        this.fileContentCache.delete(path);
        this.yamlCache.delete(path);
        this.taskInfoCache.delete(path);
        this.noteInfoCache.delete(path);
        this.indexedFilesCache.delete(path);
        // Also clear the YAMLCache static cache
        YAMLCache.clearCacheEntry(path);
    }
    
    /**
     * Clear all caches
     */
    clearAllCaches(): void {
        this.fileContentCache.clear();
        this.yamlCache.clear();
        this.taskInfoCache.clear();
        this.noteInfoCache.clear();
        this.indexedFilesCache.clear();
        this.tasksByDate.clear();
        this.notesByDate.clear();
        this.tasksByStatus.clear();
        this.tasksByPriority.clear();
        this.overdueTasks.clear();
        this.dailyNotes.clear();
        this.allTags.clear();
        this.allContexts.clear();
        
        // Reset initialization state
        this.initialized = false;
        this.initializationPromise = null;
    }
    
    /**
     * Evict old entries from file cache
     */
    private evictFileCache(): void {
        if (this.fileContentCache.size <= CacheManager.MAX_CACHE_SIZE) {
            return;
        }
        
        // Sort by mtime and remove oldest entries
        const entries = Array.from(this.fileContentCache.entries())
            .sort((a, b) => a[1].mtime - b[1].mtime);
        
        const toRemove = entries.slice(0, entries.length - CacheManager.MAX_CACHE_SIZE);
        toRemove.forEach(([path]) => {
            this.fileContentCache.delete(path);
        });
        
        this.stats.cacheEvictions += toRemove.length;
    }
    
    /**
     * Evict old entries from task cache
     */
    private evictTaskCache(): void {
        if (this.taskInfoCache.size <= CacheManager.MAX_TASK_CACHE_SIZE) {
            return;
        }
        
        // Sort by last access time (using dateModified as proxy)
        const entries = Array.from(this.taskInfoCache.entries())
            .sort((a, b) => {
                try {
                    const timeA = a[1].dateModified ? parseTimestamp(a[1].dateModified).getTime() : 0;
                    const timeB = b[1].dateModified ? parseTimestamp(b[1].dateModified).getTime() : 0;
                    return timeA - timeB;
                } catch (error) {
                    // Fallback to string comparison if parsing fails
                    return (a[1].dateModified || '').localeCompare(b[1].dateModified || '');
                }
            });
        
        const toRemove = entries.slice(0, entries.length - CacheManager.MAX_TASK_CACHE_SIZE);
        toRemove.forEach(([path, taskInfo]) => {
            this.taskInfoCache.delete(path);
            this.removeFromIndexes(path, 'task', taskInfo);
        });
        
        this.stats.cacheEvictions += toRemove.length;
    }
    
    /**
     * Evict old entries from note cache
     */
    private evictNoteCache(): void {
        if (this.noteInfoCache.size <= CacheManager.MAX_NOTE_CACHE_SIZE) {
            return;
        }
        
        // Sort by creation date
        const entries = Array.from(this.noteInfoCache.entries())
            .sort((a, b) => {
                try {
                    const timeA = a[1].createdDate ? parseTimestamp(a[1].createdDate).getTime() : 0;
                    const timeB = b[1].createdDate ? parseTimestamp(b[1].createdDate).getTime() : 0;
                    return timeA - timeB;
                } catch (error) {
                    // Fallback to string comparison if parsing fails
                    return (a[1].createdDate || '').localeCompare(b[1].createdDate || '');
                }
            });
        
        const toRemove = entries.slice(0, entries.length - CacheManager.MAX_NOTE_CACHE_SIZE);
        toRemove.forEach(([path, noteInfo]) => {
            this.noteInfoCache.delete(path);
            this.removeFromIndexes(path, 'note', noteInfo);
        });
        
        this.stats.cacheEvictions += toRemove.length;
    }
    
    /**
     * Clean up expired YAML cache entries
     */
    private cleanupYAMLCache(): void {
        const now = Date.now();
        let removedCount = 0;
        
        for (const [key, entry] of this.yamlCache.entries()) {
            if (now - entry.timestamp > CacheManager.YAML_CACHE_TTL) {
                this.yamlCache.delete(key);
                removedCount++;
            }
        }
        
        this.stats.cacheEvictions += removedCount;
    }
    
    
    /**
     * Check if a file path is excluded
     */
    private isExcluded(path: string): boolean {
        return this.excludedFolders.some(folder => 
            folder && path.startsWith(folder)
        );
    }
    
    /**
     * Update configuration
     */
    updateConfig(
        taskTag?: string,
        excludedFolders?: string,
        fieldMapper?: FieldMapper
    ): void {
        if (taskTag !== undefined) this.taskTag = taskTag;
        if (excludedFolders !== undefined) {
            this.excludedFolders = excludedFolders 
                ? excludedFolders.split(',').map(folder => folder.trim())
                : [];
        }
        if (fieldMapper !== undefined) {
            this.fieldMapper = fieldMapper;
        }
    }
    
    /**
     * Update daily note template path (for backward compatibility)
     * Note: This method is now deprecated since we use core daily notes plugin
     */
    updateDailyNoteTemplatePath(newPath: string): void {
        // No-op since we no longer manage daily note templates
        console.warn('updateDailyNoteTemplatePath is deprecated - daily notes now use core plugin templates');
    }
    
    /**
     * Update field mapper (for backward compatibility)
     */
    updateFieldMapper(fieldMapper: FieldMapper): void {
        this.updateConfig(undefined, undefined, fieldMapper);
    }
    
    /**
     * Clear cached info for a specific file (for backward compatibility)
     */
    clearCachedInfo(path: string): void {
        this.clearCacheEntry(path);
    }
    
    /**
     * Update task info in cache proactively (without reading from file system)
     * This method provides atomic cache updates and should be called immediately
     * after successful file writes to ensure the cache reflects the new state.
     */
    async updateTaskInfoInCache(path: string, taskInfo: TaskInfo | null): Promise<void> {
        const maxRetries = 3;
        let attempts = 0;
        
        while (attempts < maxRetries) {
            try {
                // Track this as a recent programmatic update
                this.recentUpdates.set(path, Date.now());
                
                if (taskInfo) {
                    // Get old task info for atomic scheduled date index updates
                    const oldTaskInfo = this.taskInfoCache.get(path);
                    
                    // Validate taskInfo has required fields
                    if (!taskInfo.path || !taskInfo.title) {
                        throw new Error('Invalid task info: missing required fields');
                    }
                    
                    // Update the dateModified timestamp to reflect the current time
                    const updatedTaskInfo: TaskInfo = {
                        ...taskInfo,
                        dateModified: getCurrentTimestamp()
                    };
                    
                    // Update the task info cache with the new authoritative data
                    this.taskInfoCache.set(path, updatedTaskInfo);
                    
                    // Update the indexed files cache
                    this.indexedFilesCache.set(path, {
                        path,
                        mtime: Date.now(),
                        ctime: Date.now(),
                        isTask: true,
                        tags: updatedTaskInfo.tags || [],
                        cachedInfo: updatedTaskInfo
                    });
                    
                    // Update all indexes including canonical sets (with old task info for atomic updates)
                    try {
                        this.updateTaskIndexes(path, updatedTaskInfo);
                    } catch (indexError) {
                        console.warn(`Error updating task indexes for ${path}:`, indexError);
                        // Don't fail the entire operation for index errors
                    }
                } else {
                    // Get old task info for proper cleanup
                    const oldTaskInfo = this.taskInfoCache.get(path);
                    
                    // Remove from all caches and indexes
                    this.taskInfoCache.delete(path);
                    this.indexedFilesCache.delete(path);
                    
                    try {
                        this.removeFromIndexes(path, 'task', oldTaskInfo);
                    } catch (indexError) {
                        console.warn(`Error removing from indexes for ${path}:`, indexError);
                        // Don't fail the entire operation for index errors
                    }
                }
                
                // Success - break out of retry loop
                return;
                
            } catch (error) {
                attempts++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                
                if (attempts >= maxRetries) {
                    console.error(`Failed to update task info in cache for ${path} after ${maxRetries} attempts:`, {
                        error: errorMessage,
                        stack: error instanceof Error ? error.stack : undefined,
                        taskInfo: taskInfo ? { path: taskInfo.path, title: taskInfo.title } : null
                    });
                    throw new Error(`Cache update failed after ${maxRetries} attempts: ${errorMessage}`);
                } else {
                    console.warn(`Cache update attempt ${attempts} failed for ${path}, retrying:`, errorMessage);
                    // Wait briefly before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
                }
            }
        }
    }
    
    /**
     * Rebuild daily notes cache for a specific month
     */
    async rebuildDailyNotesCache(year: number, month: number): Promise<Set<string>> {
        const dailyNotesForMonth = new Set<string>();
        
        try {
            // Refresh the entire daily notes cache first
            this.initializeDailyNotesCache();
            
            // Filter for the specific month
            this.dailyNotes.forEach(dateStr => {
                const dateParts = dateStr.split('-');
                if (dateParts.length === 3) {
                    const fileYear = parseInt(dateParts[0]);
                    const fileMonth = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
                    
                    if (fileYear === year && fileMonth === month) {
                        dailyNotesForMonth.add(dateStr);
                    }
                }
            });
            
        } catch (error) {
            console.warn('Daily Notes interface not available, skipping daily notes cache rebuild');
        }
        
        return dailyNotesForMonth;
    }
    
    /**
     * Rebuild the entire cache index
     */
    async rebuildIndex(): Promise<void> {
        // Clear all cached data but keep configuration
        this.clearAllCaches();
        
        // Rebuild from scratch
        await this.initializeCache();
    }
    
    /**
     * Get task info for a specific date (alias for getTasksForDate for backwards compatibility)
     */
    async getTaskInfoForDate(date: Date, forceRefresh = false): Promise<TaskInfo[]> {
        return this.getTasksForDate(date, forceRefresh);
    }
    
    /**
     * Get all unique contexts across all tasks (sorted)
     */
    async getAllContexts(): Promise<string[]> {
        try {
            await this.ensureInitialized();
            return Array.from(this.allContexts).sort();
        } catch (error) {
            console.error('Error getting all contexts:', error);
            return [];
        }
    }
    
    /**
     * Get all unique tags across all tasks (sorted)
     */
    async getAllTags(): Promise<string[]> {
        try {
            await this.ensureInitialized();
            return Array.from(this.allTags).sort();
        } catch (error) {
            console.error('Error getting all tags:', error);
            return [];
        }
    }
    
    /**
     * Get all notes (for AgendaView optimization)
     */
    async getAllNotes(): Promise<NoteInfo[]> {
        try {
            await this.ensureInitialized();
            return Array.from(this.noteInfoCache.values());
        } catch (error) {
            console.error('Error getting all notes:', error);
            return [];
        }
    }
    
    /**
     * Get task info by path (for PomodoroView optimization)
     */
    async getTaskByPath(path: string): Promise<TaskInfo | null> {
        await this.ensureInitialized();
        
        // Check cache first
        if (this.taskInfoCache.has(path)) {
            this.stats.cacheHits++;
            return this.taskInfoCache.get(path)!;
        }
        
        // If not in cache, try to load it
        return this.getTaskInfo(path, false);
    }
    
    /**
     * Get task paths by status for FilterService optimization
     */
    getTaskPathsByStatus(status: string): Set<string> {
        return this.tasksByStatus.get(status) || new Set();
    }
    
    /**
     * Get task paths by priority for FilterService optimization
     */
    getTaskPathsByPriority(priority: string): Set<string> {
        return this.tasksByPriority.get(priority) || new Set();
    }
    
    /**
     * Get task paths by date for FilterService optimization (includes both due and scheduled dates)
     */
    getTaskPathsByDate(date: string): Set<string> {
        return this.tasksByDate.get(date) || new Set();
    }
    
    /**
     * Get task paths that have due dates on a specific date
     */
    getTaskPathsByDueDate(date: string): Set<string> {
        const allPaths = this.tasksByDate.get(date) || new Set();
        const duePaths = new Set<string>();
        
        for (const path of allPaths) {
            const taskInfo = this.taskInfoCache.get(path);
            if (taskInfo?.due === date) {
                duePaths.add(path);
            }
        }
        
        return duePaths;
    }
    
    /**
     * Get task paths that have scheduled dates on a specific date
     */
    getTaskPathsByScheduledDate(date: string): Set<string> {
        const allPaths = this.tasksByDate.get(date) || new Set();
        const scheduledPaths = new Set<string>();
        
        for (const path of allPaths) {
            const taskInfo = this.taskInfoCache.get(path);
            if (taskInfo?.scheduled === date) {
                scheduledPaths.add(path);
            }
        }
        
        return scheduledPaths;
    }
    
    /**
     * Get all task paths for FilterService fallback
     */
    getAllTaskPaths(): Set<string> {
        return new Set(this.taskInfoCache.keys());
    }
    
    /**
     * Get all available statuses for FilterService
     */
    getAllStatuses(): string[] {
        return Array.from(this.tasksByStatus.keys()).sort();
    }
    
    /**
     * Get all available priorities for FilterService
     */
    getAllPriorities(): string[] {
        return Array.from(this.tasksByPriority.keys()).sort();
    }
    
    /**
     * Get overdue task paths (cached)
     */
    getOverdueTaskPaths(): Set<string> {
        return new Set(this.overdueTasks);
    }
    
    /**
     * Update overdue task index for a specific task
     */
    private updateOverdueTaskIndex(path: string, taskInfo: TaskInfo): void {
        // Remove from overdue index first
        this.overdueTasks.delete(path);
        
        // Add to overdue index if task is overdue (check both due and scheduled dates)
        if (!taskInfo.recurrence) {
            const today = getTodayString();
            
            let isOverdue = false;
            
            // Check due date
            if (taskInfo.due) {
                if (isBeforeDateSafe(taskInfo.due, today)) {
                    isOverdue = true;
                }
            }
            
            // Check scheduled date
            if (!isOverdue && taskInfo.scheduled) {
                if (isBeforeDateSafe(taskInfo.scheduled, today)) {
                    isOverdue = true;
                }
            }
            
            if (isOverdue) {
                this.overdueTasks.add(path);
            }
        }
    }
    
    /**
     * Rebuild overdue tasks index for all cached tasks
     */
    private rebuildOverdueTasksIndex(): void {
        this.overdueTasks.clear();
        
        for (const [path, taskInfo] of this.taskInfoCache) {
            this.updateOverdueTaskIndex(path, taskInfo);
        }
    }
    
    
    /**
     * Simple yield implementation (removed complex requestIdleCallback)
     */
    private async yieldToMainThread(): Promise<void> {
        return new Promise(resolve => {
            setTimeout(() => resolve(), 0);
        });
    }
    
    
    /**
     * Get task info from cache without file system access
     */
    getCachedTaskInfo(path: string): TaskInfo | null {
        return this.taskInfoCache.get(path) || null;
    }

    /**
     * Get all dates that have tasks (either due or scheduled)
     */
    getAllTaskDates(): string[] {
        return Array.from(this.tasksByDate.keys()).sort();
    }
    
    /**
     * Check if a specific date has any tasks (due or scheduled)
     */
    hasTasksOnDate(date: string): boolean {
        const paths = this.tasksByDate.get(date);
        return paths !== undefined && paths.size > 0;
    }
    
    /**
     * Get count of tasks on a specific date (due or scheduled)
     */
    getTaskCountOnDate(date: string): number {
        const paths = this.tasksByDate.get(date);
        return paths ? paths.size : 0;
    }
    
    /**
     * Clear scheduled date from task index when scheduled date changes
     */
    private clearScheduledDateFromIndex(path: string, oldScheduledDate: string): void {
        try {
            // Use date part for consistent indexing
            const dateStr = getDatePart(oldScheduledDate);
            const pathSet = this.tasksByDate.get(dateStr);
            if (pathSet) {
                pathSet.delete(path);
                if (pathSet.size === 0) {
                    this.tasksByDate.delete(dateStr);
                }
            }
        } catch (error) {
            console.error(`Error clearing scheduled date from index for ${path}:`, error);
        }
    }
    
    /**
     * Clear due date from task index when due date changes
     */
    private clearDueDateFromIndex(path: string, oldDueDate: string): void {
        try {
            // Use date part for consistent indexing
            const dateStr = getDatePart(oldDueDate);
            const pathSet = this.tasksByDate.get(dateStr);
            if (pathSet) {
                pathSet.delete(path);
                if (pathSet.size === 0) {
                    this.tasksByDate.delete(dateStr);
                }
            }
        } catch (error) {
            console.error(`Error clearing due date from index for ${path}:`, error);
        }
    }
    
    /**
     * Get cache statistics
     */
    getStats(): {
        cacheHits: number;
        cacheMisses: number;
        fileReads: number;
        yamlParses: number;
        hitRatio: number;
        tasksCached: number;
        notesCached: number;
        filesCached: number;
        datesWithTasks: number;
        memoryUsageMB: number;
        cacheEvictions: number;
        indexSize: number;
    } {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        return {
            ...this.stats,
            hitRatio: total > 0 ? this.stats.cacheHits / total : 0,
            tasksCached: this.taskInfoCache.size,
            notesCached: this.noteInfoCache.size,
            filesCached: this.fileContentCache.size,
            datesWithTasks: this.tasksByDate.size,
            memoryUsageMB: this.stats.memoryUsage / 1024 / 1024,
            cacheEvictions: this.stats.cacheEvictions,
            indexSize: this.tasksByDate.size + this.notesByDate.size + this.tasksByStatus.size + this.tasksByPriority.size
        };
    }
    
    /**
     * Clean up and unregister event handlers
     */
    destroy(): void {
        // Unregister all event handlers
        if (this.eventHandlers.modify) {
            this.vault.off('modify', this.eventHandlers.modify);
        }
        if (this.eventHandlers.delete) {
            this.vault.off('delete', this.eventHandlers.delete);
        }
        if (this.eventHandlers.rename) {
            this.vault.off('rename', this.eventHandlers.rename);
        }
        if (this.eventHandlers.create) {
            this.vault.off('create', this.eventHandlers.create);
        }
        
        // Clear all caches
        this.clearAllCaches();
        
        // Clear subscribers
        this.subscribers.clear();
        
        // Clear event handlers object
        this.eventHandlers = {};
        
        // Clear recent updates
        this.recentUpdates.clear();
        
        // Clear delayed initialization timeout
        if (this.delayedInitTimeout) {
            clearTimeout(this.delayedInitTimeout);
            this.delayedInitTimeout = null;
        }
    }
}