import { TFile, App, Events, EventRef, parseLinktext } from 'obsidian';
import { TaskInfo, NoteInfo } from '../types';
import { FieldMapper } from '../services/FieldMapper';
import { 
    getTodayString, 
    isBeforeDateSafe, 
    getDatePart,
    parseDateToUTC,
    formatDateForStorage
} from './dateUtils';
import { filterEmptyProjects } from './helpers';
import { TaskNotesSettings } from '../types/settings';

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
    private settings: TaskNotesSettings;
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
    
    // Event listeners for cleanup
    private eventListeners: EventRef[] = [];
    
    // Debouncing for file changes to prevent excessive updates during typing
    private debouncedHandlers: Map<string, number> = new Map();
    private readonly DEBOUNCE_DELAY = 300; // 300ms delay after user stops typing
    
    // Cache of last known task info for comparison to detect actual changes
    private lastKnownTaskInfo: Map<string, TaskInfo | null> = new Map();
    
    // Cache of last known frontmatter to detect frontmatter-specific changes
    private lastKnownFrontmatter: Map<string, any> = new Map();
    
    constructor(
        app: App,
        settings: TaskNotesSettings,
        fieldMapper?: FieldMapper
    ) {
        super();
        this.app = app;
        this.settings = settings;
        this.taskTag = settings.taskTag;
        this.excludedFolders = settings.excludedFolders
            ? settings.excludedFolders.split(',').map(folder => folder.trim())
            : [];
        this.fieldMapper = fieldMapper;
        this.disableNoteIndexing = settings.disableNoteIndexing;
        this.storeTitleInFilename = settings.storeTitleInFilename;
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
     * Get the Obsidian app instance
     * Needed for external services to access app APIs
     */
    getApp(): App {
        return this.app;
    }

    /**
     * Check if a file is a task based on current settings
     */
    private isTaskFile(frontmatter: any): boolean {
        if (!frontmatter) return false;

        if (this.settings.taskIdentificationMethod === 'property') {
            const propName = this.settings.taskPropertyName;
            const propValue = this.settings.taskPropertyValue;
            if (!propName || !propValue) return false; // Not configured

            const frontmatterValue = frontmatter[propName];
            if (frontmatterValue === undefined) return false;

            // Handle both single and multi-value properties
            if (Array.isArray(frontmatterValue)) {
                return frontmatterValue.some((val: any) => this.comparePropertyValues(val, propValue));
            }
            return this.comparePropertyValues(frontmatterValue, propValue);
        } else {
            // Fallback to legacy tag-based method
            return Array.isArray(frontmatter.tags) && frontmatter.tags.includes(this.taskTag);
        }
    }

    /**
     * Compare frontmatter property values with settings value, with boolean coercion support.
     */
    private comparePropertyValues(frontmatterValue: any, settingValue: string): boolean {
        // Handle boolean frontmatter values compared to string settings (e.g., true vs "true")
        if (typeof frontmatterValue === 'boolean' && typeof settingValue === 'string') {
            const lower = settingValue.toLowerCase();
            if (lower === 'true' || lower === 'false') {
                return frontmatterValue === (lower === 'true');
            }
        }

        // Fallback to strict equality for other types (strings, numbers, etc.)
        return frontmatterValue === settingValue;
    }
    
    /**
     * Set up native event listeners for real-time updates
     */
    private setupNativeEventListeners(): void {
        // Store event listeners for proper cleanup
        this.eventListeners.push(
            this.app.metadataCache.on('changed', (file, data, cache) => {
                if (file instanceof TFile && file.extension === 'md' && this.isValidFile(file.path)) {
                    this.handleFileChangedDebounced(file, cache);
                }
            })
        );
        
        this.eventListeners.push(
            this.app.metadataCache.on('deleted', (file, prevCache) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.handleFileDeleted(file.path);
                }
            })
        );
        
        this.eventListeners.push(
            this.app.vault.on('rename', (file, oldPath) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.handleFileRenamed(file, oldPath);
                }
            })
        );
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
                        if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
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
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
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
            const isTask = this.isTaskFile(frontmatter);
            
            if (!isTask && !this.disableNoteIndexing) {
                // This is a note - extract date information
                let noteDate: string | null = null;

                // Try to extract date from frontmatter using field mapper
                if (this.fieldMapper) {
                    const dateCreatedField = this.fieldMapper.toUserField('dateCreated');
                    if (frontmatter[dateCreatedField]) {
                        const dateValue = frontmatter[dateCreatedField];
                        try {
                            const parsed = new Date(dateValue);
                            if (!isNaN(parsed.getTime())) {
                                noteDate = parsed.toISOString().split('T')[0];
                            }
                        } catch (e) {
                            // Ignore invalid dates
                        }
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
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
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
        
        // If indexes aren't built yet, try to get statuses synchronously
        if (this.tasksByStatus.size === 0 && this.indexesBuilt) {
            console.debug('MinimalNativeCache: Indexes marked as built but tasksByStatus is empty, computing statuses synchronously');
            const statuses = new Set<string>();
            const markdownFiles = this.app.vault.getMarkdownFiles()
                .filter(file => this.isValidFile(file.path));
            
            for (const file of markdownFiles) {
                const metadata = this.app.metadataCache.getFileCache(file);
                if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
                    const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                    if (taskInfo?.status) {
                        statuses.add(taskInfo.status);
                    }
                }
            }
            
            return Array.from(statuses).sort();
        }
        
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
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
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
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo?.tags && Array.isArray(taskInfo.tags)) {
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
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo?.contexts && Array.isArray(taskInfo.contexts)) {
                    taskInfo.contexts.forEach(context => contexts.add(context));
                }
            }
        }
        
        return Array.from(contexts).sort();
    }
    
    /**
     * Get all projects by computing on-demand
     * Extracts project names from [[Note Name]] links in task project fields
     * Returns actual project note names/paths that exist as links in tasks
     */
    getAllProjects(): string[] {
        const projects = new Set<string>();
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo && taskInfo.projects) {
                    const filteredProjects = filterEmptyProjects(taskInfo.projects);
                    if (filteredProjects.length > 0) {
                        filteredProjects.forEach(project => {
                            const extractedProjects = this.extractProjectNamesFromValue(project, file.path);
                            extractedProjects.forEach(projectName => {
                                // Trim and validate project names to avoid empty entries
                                const cleanName = projectName.trim();
                                if (cleanName.length > 0) {
                                    projects.add(cleanName);
                                }
                            });
                        });
                    }
                }
            }
        }
        
        return Array.from(projects).sort();
    }
    
    /**
     * Get detailed project information including file paths and existence status
     * Returns an object with project metadata for more advanced use cases
     */
    getAllProjectsWithDetails(): Array<{
        name: string;
        isLinkedNote: boolean;
        filePath?: string;
        exists: boolean;
        usageCount: number;
    }> {
        const projectMap = new Map<string, {
            name: string;
            isLinkedNote: boolean;
            filePath?: string;
            exists: boolean;
            usageCount: number;
        }>();
        
        const markdownFiles = this.app.vault.getMarkdownFiles()
            .filter(file => this.isValidFile(file.path));
        
        for (const file of markdownFiles) {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                const filteredProjects = filterEmptyProjects(taskInfo?.projects || []);
                if (filteredProjects.length > 0) {
                    filteredProjects.forEach(project => {
                        const projectDetails = this.extractProjectDetailsFromValue(project, file.path);
                        projectDetails.forEach(detail => {
                            const existing = projectMap.get(detail.name);
                            if (existing) {
                                existing.usageCount++;
                            } else {
                                projectMap.set(detail.name, { ...detail, usageCount: 1 });
                            }
                        });
                    });
                }
            }
        }
        
        return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    /**
     * Get all project notes that exist as files in the vault
     * This returns only projects that are linked notes and actually exist as files
     */
    getAllProjectFiles(): Array<{
        name: string;
        path: string;
        usageCount: number;
    }> {
        const projectDetails = this.getAllProjectsWithDetails();
        return projectDetails
            .filter(project => project.isLinkedNote && project.exists && project.filePath)
            .map(project => ({
                name: project.name,
                path: project.filePath!,
                usageCount: project.usageCount
            }));
    }
    
    /**
     * Extract project names from a project field value
     * Handles both [[Note Name]] links and plain strings
     * Returns an array of project names that should be included in the project list
     */
    private extractProjectNamesFromValue(projectValue: string, sourcePath: string): string[] {
        if (!projectValue) return [];
        
        const projects: string[] = [];
        
        // Check if this is a [[link]] format
        if (projectValue.startsWith('[[') && projectValue.endsWith(']]')) {
            const linkContent = projectValue.slice(2, -2);
            const parsed = parseLinktext(linkContent);
            const linkPath = parsed.path;
            
            // Handle both relative and absolute link paths
            let resolvedFile;
            
            // First try to resolve as-is (handles absolute paths and relative paths from vault root)
            resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, '');
            
            // If not found, try resolving relative to the source file's directory
            if (!resolvedFile) {
                const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
                resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourceDir);
            }
            
            if (resolvedFile) {
                // Return the actual note name (basename without extension)
                projects.push(resolvedFile.basename);
            } else {
                // If the linked file doesn't exist, still include the link text
                // This handles cases where the project note hasn't been created yet
                // but the link exists in the project field
                const noteName = linkPath.split('/').pop()?.replace(/\.md$/, '') || linkPath;
                projects.push(noteName);
            }
        } else {
            // This is a plain string project name
            // Only include it if it's not empty and not just whitespace
            const trimmed = projectValue.trim();
            if (trimmed) {
                projects.push(trimmed);
            }
        }
        
        return projects;
    }
    
    /**
     * Extract detailed project information from a project field value
     * Returns project metadata including file paths and existence status
     */
    private extractProjectDetailsFromValue(projectValue: string, sourcePath: string): Array<{
        name: string;
        isLinkedNote: boolean;
        filePath?: string;
        exists: boolean;
    }> {
        if (!projectValue) return [];
        
        const projects: Array<{
            name: string;
            isLinkedNote: boolean;
            filePath?: string;
            exists: boolean;
        }> = [];
        
        // Check if this is a [[link]] format
        if (projectValue.startsWith('[[') && projectValue.endsWith(']]')) {
            const linkContent = projectValue.slice(2, -2);
            const parsed = parseLinktext(linkContent);
            const linkPath = parsed.path;
            
            // Handle both relative and absolute link paths
            let resolvedFile;
            
            // First try to resolve as-is (handles absolute paths and relative paths from vault root)
            resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, '');
            
            // If not found, try resolving relative to the source file's directory
            if (!resolvedFile) {
                const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
                resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourceDir);
            }
            
            if (resolvedFile) {
                // Return the actual note name and file path
                projects.push({
                    name: resolvedFile.basename,
                    isLinkedNote: true,
                    filePath: resolvedFile.path,
                    exists: true
                });
            } else {
                // If the linked file doesn't exist, still include the link info
                const noteName = linkPath.split('/').pop()?.replace(/\.md$/, '') || linkPath;
                projects.push({
                    name: noteName,
                    isLinkedNote: true,
                    filePath: undefined,
                    exists: false
                });
            }
        } else {
            // This is a plain string project name
            const trimmed = projectValue.trim();
            if (trimmed) {
                projects.push({
                    name: trimmed,
                    isLinkedNote: false,
                    filePath: undefined,
                    exists: false
                });
            }
        }
        
        return projects;
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
        if (!this.isTaskFile(metadata.frontmatter)) return null;
        
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
            const isTask = this.isTaskFile(frontmatter);
            
            // Skip task files - we only want notes
            if (isTask) continue;
            
            let noteDate: string | null = null;
            
            // Try to extract date from frontmatter using field mapper
            if (this.fieldMapper) {
                const dateCreatedField = this.fieldMapper.toUserField('dateCreated');
                if (frontmatter[dateCreatedField]) {
                    const dateValue = frontmatter[dateCreatedField];

                    // Pre-validate the date value to avoid console warnings
                    if (typeof dateValue === 'string' && dateValue.trim()) {
                        const trimmed = dateValue.trim();

                        // Skip invalid time-only formats like "T00:00" that would cause console warnings
                        if (trimmed.startsWith('T') && /^T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
                            console.debug('Skipping invalid time-only date in note frontmatter:', {
                                path: file.path,
                                dateValue: trimmed
                            });
                            // Continue to filename parsing
                        } else {
                            try {
                                const parsed = parseDateToUTC(dateValue);
                                noteDate = formatDateForStorage(parsed);
                            } catch (e) {
                                // Ignore invalid dates or parsing errors
                                console.debug('Failed to parse date from note frontmatter:', {
                                    path: file.path,
                                    dateValue,
                                    error: e instanceof Error ? e.message : String(e)
                                });
                            }
                        }
                    }
                }
            }
            
            // If not found in frontmatter, try to extract from filename using parseDate
            if (!noteDate) {
                const fileName = file.basename;
                const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    try {
                        const parsed = parseDateToUTC(dateMatch[1]);
                        noteDate = formatDateForStorage(parsed);
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
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
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
    
    /**
     * Debounced version of handleFileChanged to prevent excessive updates during typing
     */
    private handleFileChangedDebounced(file: TFile, cache: any): void {
        // Early exit: Only process files that are potentially task files
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata?.frontmatter || !this.isTaskFile(metadata.frontmatter)) {
            return;
        }
        
        // Check if frontmatter actually changed by comparing raw frontmatter objects
        const currentFrontmatter = metadata.frontmatter;
        const lastKnownFrontmatter = this.lastKnownFrontmatter.get(file.path);
        
        if (this.frontmatterEquals(currentFrontmatter, lastKnownFrontmatter)) {
            // Frontmatter hasn't changed - this was likely just a content change or mtime update
            return;
        }
        
        // Store the current frontmatter for future comparisons
        this.lastKnownFrontmatter.set(file.path, this.deepClone(currentFrontmatter));
        
        // Extract task info for view update comparison
        const currentTaskInfo = this.extractTaskInfoFromNative(file.path, currentFrontmatter);
        const lastKnownTaskInfo = this.getLastKnownTaskInfo(file.path);
        
        // Even if frontmatter changed, check if it affects task rendering
        if (this.taskInfoEquals(currentTaskInfo, lastKnownTaskInfo)) {
            // Update our cached task info but don't trigger view updates
            this.setLastKnownTaskInfo(file.path, currentTaskInfo);
            return;
        }
        
        // Store the current task info for future comparisons
        this.setLastKnownTaskInfo(file.path, currentTaskInfo);
        
        // Clear any existing timeout for this file
        const existingTimeout = this.debouncedHandlers.get(file.path);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        // Set up new debounced handler
        const timeout = setTimeout(() => {
            this.handleFileChanged(file, cache);
            this.debouncedHandlers.delete(file.path);
        }, this.DEBOUNCE_DELAY) as unknown as number;
        
        this.debouncedHandlers.set(file.path, timeout);
    }
    
    private async handleFileChanged(file: TFile, cache: any): Promise<void> {
        if (!this.initialized) return;
        
        this.clearFileFromIndexes(file.path);
        
        // Wait for fresh data to be available before proceeding
        await this.waitForFreshData(file);
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
            await this.indexTaskFile(file, metadata.frontmatter);
        }
        
        this.trigger('file-updated', { path: file.path, file });
    }
    
    private handleFileDeleted(path: string): void {
        if (!this.initialized) return;
        
        this.clearFileFromIndexes(path);
        this.lastKnownTaskInfo.delete(path); // Clean up cached task info
        this.lastKnownFrontmatter.delete(path); // Clean up cached frontmatter
        this.trigger('file-deleted', { path });
    }
    
    private async handleFileRenamed(file: TFile, oldPath: string): Promise<void> {
        if (!this.initialized) return;
        
        this.clearFileFromIndexes(oldPath);
        this.lastKnownTaskInfo.delete(oldPath); // Clean up old path cached task info
        this.lastKnownFrontmatter.delete(oldPath); // Clean up old path cached frontmatter
        
        // Wait for fresh data to be available before proceeding
        await this.waitForFreshData(file);
        
        const metadata = this.app.metadataCache.getFileCache(file);
        if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
            await this.indexTaskFile(file, metadata.frontmatter);
            // Store the task info and frontmatter for the new path
            const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
            this.setLastKnownTaskInfo(file.path, taskInfo);
            this.lastKnownFrontmatter.set(file.path, this.deepClone(metadata.frontmatter));
        }
        
        this.trigger('file-renamed', { oldPath, newPath: file.path, file });
    }
    
    /**
     * Wait for fresh data to be available in Obsidian's metadata cache
     * This ensures we don't emit events before the data is actually updated
     */
    private async waitForFreshData(file: TFile, maxAttempts = 10): Promise<void> {
        const startTime = Date.now();
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // Try to get file stats and metadata
                const fileStat = await this.app.vault.adapter.stat(file.path);
                if (!fileStat) break;
                
                const metadata = this.app.metadataCache.getFileCache(file);
                
                // If metadata exists and we can extract task info, data is ready
                if (metadata?.frontmatter) {
                    const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                    if (taskInfo || !this.isTaskFile(metadata.frontmatter)) {
                        // Data is available (either valid task info or confirmed non-task)
                        return;
                    }
                }
                
                // Data not ready yet, wait with exponential backoff
                const delay = Math.min(50 * Math.pow(1.5, attempt), 200);
                await new Promise(resolve => setTimeout(resolve, delay));
                
            } catch (error) {
                // If we can't check file stats, just wait briefly and continue
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // Log if we timed out (for debugging slow systems)
        const elapsed = Date.now() - startTime;
        if (elapsed > 500) {
            console.debug(`MinimalNativeCache: Waited ${elapsed}ms for fresh data on ${file.path}`);
        }
    }
    
    /**
     * Wait for fresh task data with specific expected changes
     * This can be called from TaskService to verify specific updates are reflected
     */
    async waitForFreshTaskData(file: TFile, expectedChanges?: Partial<TaskInfo>, maxAttempts = 10): Promise<void> {
        const startTime = Date.now();
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const metadata = this.app.metadataCache.getFileCache(file);
                if (!metadata?.frontmatter) {
                    const delay = Math.min(50 * Math.pow(1.5, attempt), 200);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // Try to extract task info
                const taskInfo = this.extractTaskInfoFromNative(file.path, metadata.frontmatter);
                if (taskInfo) {
                    // If we have expected changes, verify they're present
                    if (expectedChanges) {
                        let dataIsUpdated = true;
                        for (const [key, expectedValue] of Object.entries(expectedChanges)) {
                            const actualValue = taskInfo[key as keyof TaskInfo];
                            if (actualValue !== expectedValue) {
                                dataIsUpdated = false;
                                break;
                            }
                        }
                        if (dataIsUpdated) {
                            return; // Data matches expectations
                        }
                    } else {
                        return; // Data is available
                    }
                }
                
                // Data not ready yet, wait with exponential backoff
                const delay = Math.min(50 * Math.pow(1.5, attempt), 200);
                await new Promise(resolve => setTimeout(resolve, delay));
                
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        // Log if we timed out (for debugging)
        const elapsed = Date.now() - startTime;
        if (elapsed > 500) {
            console.debug(`MinimalNativeCache: Waited ${elapsed}ms for fresh task data on ${file.path}`, expectedChanges);
        }
    }
    
    // ========================================
    // UTILITY METHODS
    // ========================================
    
    /**
     * Get the last known task info for a file path
     */
    private getLastKnownTaskInfo(path: string): TaskInfo | null {
        return this.lastKnownTaskInfo.get(path) || null;
    }
    
    /**
     * Store the last known task info for a file path
     */
    private setLastKnownTaskInfo(path: string, taskInfo: TaskInfo | null): void {
        this.lastKnownTaskInfo.set(path, taskInfo);
    }
    
    /**
     * Compare two TaskInfo objects to see if they're functionally equivalent
     * Only compares fields that would affect view rendering
     */
    private taskInfoEquals(current: TaskInfo | null, previous: TaskInfo | null): boolean {
        if (current === null && previous === null) return true;
        if (current === null || previous === null) return false;
        
        // Compare scalar fields
        const scalarFieldsEqual = (
            current.title === previous.title &&
            current.status === previous.status &&
            current.priority === previous.priority &&
            current.due === previous.due &&
            current.scheduled === previous.scheduled &&
            current.archived === previous.archived &&
            current.completedDate === previous.completedDate &&
            current.recurrence === previous.recurrence &&
            current.timeEstimate === previous.timeEstimate
        );
        
        if (!scalarFieldsEqual) return false;
        
        // Compare array fields more efficiently
        return (
            this.arraysEqual(current.tags, previous.tags) &&
            this.arraysEqual(current.contexts, previous.contexts) &&
            this.arraysEqual(current.projects, previous.projects) &&
            this.objectsEqual(current.timeEntries, previous.timeEntries) &&
            this.objectsEqual(current.reminders, previous.reminders) &&
            this.objectsEqual(current.complete_instances, previous.complete_instances)
        );
    }
    
    /**
     * Compare two arrays for equality (order-independent for string arrays)
     */
    private arraysEqual(a: any[] | undefined, b: any[] | undefined): boolean {
        if (a === b) return true;
        if (!a || !b) return a === b;
        if (a.length !== b.length) return false;
        
        // For string arrays, sort and compare
        if (a.length === 0) return true;
        if (typeof a[0] === 'string') {
            const sortedA = [...a].sort();
            const sortedB = [...b].sort();
            return sortedA.every((val, i) => val === sortedB[i]);
        }
        
        // For object arrays, fall back to JSON comparison (less common case)
        return JSON.stringify(a) === JSON.stringify(b);
    }
    
    /**
     * Compare two objects for deep equality
     */
    private objectsEqual(a: any, b: any): boolean {
        if (a === b) return true;
        if (!a || !b) return a === b;
        return JSON.stringify(a) === JSON.stringify(b);
    }
    
    /**
     * Compare two frontmatter objects for equality
     */
    private frontmatterEquals(current: any, previous: any): boolean {
        if (current === previous) return true;
        if (!current || !previous) return current === previous;
        
        // Use JSON comparison for frontmatter since it's typically small
        return JSON.stringify(current) === JSON.stringify(previous);
    }
    
    /**
     * Deep clone an object (for caching frontmatter)
     */
    private deepClone(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        return JSON.parse(JSON.stringify(obj));
    }
    
    private extractTaskInfoFromNative(path: string, frontmatter: any): TaskInfo | null {
        if (!this.fieldMapper) return null;
        
        try {
            const mappedTask = this.fieldMapper.mapFromFrontmatter(frontmatter, path, this.storeTitleInFilename);
            
            return {
                id: path, // Add id field for API consistency
                title: mappedTask.title || 'Untitled task',
                status: mappedTask.status || 'open',
                priority: mappedTask.priority || 'normal',
                due: mappedTask.due,
                scheduled: mappedTask.scheduled,
                path,
                archived: mappedTask.archived || false,
                tags: Array.isArray(mappedTask.tags) ? mappedTask.tags : [],
                contexts: Array.isArray(mappedTask.contexts) ? mappedTask.contexts : [],
                projects: Array.isArray(mappedTask.projects) ? mappedTask.projects : [],
                recurrence: mappedTask.recurrence,
                complete_instances: mappedTask.complete_instances,
                completedDate: mappedTask.completedDate,
                timeEstimate: mappedTask.timeEstimate,
                timeEntries: mappedTask.timeEntries,
                dateCreated: mappedTask.dateCreated,
                dateModified: mappedTask.dateModified,
                reminders: mappedTask.reminders
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
            if (metadata?.frontmatter && this.isTaskFile(metadata.frontmatter)) {
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
        // Clean up event listeners
        this.eventListeners.forEach(listener => {
            this.app.metadataCache.offref(listener);
        });
        this.eventListeners = [];
        
        // Clean up any pending debounced handlers
        this.debouncedHandlers.forEach(timeout => clearTimeout(timeout));
        this.debouncedHandlers.clear();
        
        // Clean up task info cache
        this.lastKnownTaskInfo.clear();
        this.lastKnownFrontmatter.clear();
        
        this.clearAllIndexes();
        this.initialized = false;
        this.indexesBuilt = false;
    }
}
