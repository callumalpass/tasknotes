import { ItemView, WorkspaceLeaf, Setting, TFile } from 'obsidian';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, subDays, subWeeks, subMonths } from 'date-fns';
import TaskNotesPlugin from '../main';
import { 
    STATS_VIEW_TYPE,
    TaskInfo
} from '../types';
import { calculateTotalTimeSpent, filterEmptyProjects } from '../utils/helpers';
import { createTaskCard } from '../ui/TaskCard';

interface ProjectStats {
    projectName: string;
    totalTimeSpent: number;
    taskCount: number;
    completedTaskCount: number;
    avgTimePerTask: number;
    lastActivity?: string;
}

interface OverallStats {
    totalTimeSpent: number;
    totalTasks: number;
    completedTasks: number;
    activeProjects: number;
    completionRate: number;
    avgTimePerTask: number;
    totalTasksThisWeek?: number;
    completedTasksThisWeek?: number;
    timeSpentThisWeek?: number;
}


interface TimeRangeStats {
    overall: OverallStats;
    projects: ProjectStats[];
}

interface StatsFilters {
    dateRange: 'all' | '7days' | '30days' | '90days' | 'custom';
    customStartDate?: string;
    customEndDate?: string;
    selectedProjects: string[];
    minTimeSpent: number; // in minutes
}

interface ProjectDrilldownData {
    projectName: string;
    tasks: TaskInfo[];
    totalTimeSpent: number;
    completionRate: number;
    timeByDay: TimeByDay[];
    recentActivity: TaskInfo[];
}

interface TimeByDay {
    date: string; // YYYY-MM-DD
    timeSpent: number; // minutes
    taskCount: number;
    completedTasks: number;
}

interface TrendDataPoint {
    date: string;
    value: number;
}

export class StatsView extends ItemView {
    plugin: TaskNotesPlugin;
    
    // UI elements
    private overviewStatsEl: HTMLElement | null = null;
    private todayStatsEl: HTMLElement | null = null;
    private weekStatsEl: HTMLElement | null = null;
    private monthStatsEl: HTMLElement | null = null;
    private projectsStatsEl: HTMLElement | null = null;
    private filtersEl: HTMLElement | null = null;
    
    // State
    private currentFilters: StatsFilters = {
        dateRange: 'all',
        selectedProjects: [],
        minTimeSpent: 0
    };
    private drilldownModal: HTMLElement | null = null;
    
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    
    getViewType(): string {
        return STATS_VIEW_TYPE;
    }
    
    getDisplayText(): string {
        return 'Statistics';
    }
    
    getIcon(): string {
        return 'bar-chart-4';
    }

    async onOpen() {
        await this.plugin.onReady();
        await this.render();
    }
    
    async onClose() {
        this.contentEl.empty();
    }
    
    async render() {
        const container = this.contentEl.createDiv({ cls: 'tasknotes-plugin tasknotes-container stats-container stats-view' });
        
        // Header
        const header = container.createDiv({ cls: 'stats-header stats-view__header' });
        new Setting(header)
            .setName('Task & Project Statistics')
            .setHeading();
        
        // Refresh button
        const refreshButton = header.createEl('button', { 
            cls: 'stats-refresh-button stats-view__refresh-button',
            text: 'Refresh'
        });
        this.registerDomEvent(refreshButton, 'click', () => {
            this.refreshStats();
        });
        
        // Filters section
        const filtersSection = container.createDiv({ cls: 'stats-section stats-view__section' });
        new Setting(filtersSection)
            .setName('Filters')
            .setHeading();
        this.filtersEl = filtersSection.createDiv({ cls: 'stats-filters stats-view__filters' });
        this.renderFilters();
        
        // Overview section
        const overviewSection = container.createDiv({ cls: 'stats-section stats-view__section' });
        new Setting(overviewSection)
            .setName('Overview')
            .setHeading();
        this.overviewStatsEl = overviewSection.createDiv({ cls: 'stats-overview-grid stats-view__overview-grid' });
        
        // Today's stats
        const todaySection = container.createDiv({ cls: 'stats-section stats-view__section' });
        new Setting(todaySection)
            .setName('Today')
            .setHeading();
        this.todayStatsEl = todaySection.createDiv({ cls: 'stats-grid stats-view__stats-grid' });
        
        // This week's stats
        const weekSection = container.createDiv({ cls: 'stats-section stats-view__section' });
        new Setting(weekSection)
            .setName('This Week')
            .setHeading();
        this.weekStatsEl = weekSection.createDiv({ cls: 'stats-grid stats-view__stats-grid' });
        
        // This month's stats
        const monthSection = container.createDiv({ cls: 'stats-section stats-view__section' });
        new Setting(monthSection)
            .setName('This Month')
            .setHeading();
        this.monthStatsEl = monthSection.createDiv({ cls: 'stats-grid stats-view__stats-grid' });
        
        // Project breakdown
        const projectsSection = container.createDiv({ cls: 'stats-section stats-view__section' });
        new Setting(projectsSection)
            .setName('Project Breakdown')
            .setHeading();
        this.projectsStatsEl = projectsSection.createDiv({ cls: 'stats-projects stats-view__projects' });
        
        // Initial load
        await this.refreshStats();
    }
    
    private async refreshStats() {
        try {
            await Promise.all([
                this.updateOverviewStats(),
                this.updateTodayStats(),
                this.updateWeekStats(),
                this.updateMonthStats(),
                this.updateProjectStats()
            ]);
        } catch (error) {
            console.error('Failed to refresh stats:', error);
        }
    }
    
    private async getAllTasks(): Promise<TaskInfo[]> {
        // Get all tasks from the cache
        const allTaskPaths = await this.plugin.cacheManager.getAllTaskPaths();
        let tasks: TaskInfo[] = [];
        
        for (const path of allTaskPaths) {
            try {
                const task = await this.plugin.cacheManager.getTaskInfo(path);
                if (task) {
                    tasks.push(task);
                }
            } catch (error) {
                console.error(`Failed to get task info for ${path}:`, error);
            }
        }
        
        // Apply filters
        tasks = this.applyTaskFilters(tasks);
        
        return tasks;
    }
    
    /**
     * Apply current filters to task list
     */
    private applyTaskFilters(tasks: TaskInfo[]): TaskInfo[] {
        let filteredTasks = tasks;
        
        // Apply date range filter
        const dateRange = this.getFilterDateRange();
        if (dateRange.start || dateRange.end) {
            filteredTasks = filteredTasks.filter(task => {
                // Check if task has activity in the range based on time entries
                if (task.timeEntries && task.timeEntries.length > 0) {
                    return task.timeEntries.some(entry => {
                        if (!entry.startTime) return false;
                        const entryDate = new Date(entry.startTime);
                        
                        if (dateRange.start && entryDate < dateRange.start) return false;
                        if (dateRange.end && entryDate > dateRange.end) return false;
                        
                        return true;
                    });
                }
                
                // Also check completion date
                if (task.completedDate) {
                    const completedDate = new Date(task.completedDate);
                    if (dateRange.start && completedDate < dateRange.start) return false;
                    if (dateRange.end && completedDate > dateRange.end) return false;
                    return true;
                }
                
                // Check creation date as fallback
                if (task.dateCreated) {
                    const createdDate = new Date(task.dateCreated);
                    if (dateRange.start && createdDate < dateRange.start) return false;
                    if (dateRange.end && createdDate > dateRange.end) return false;
                    return true;
                }
                
                // If no date information and we have date filters, exclude
                return !(dateRange.start || dateRange.end);
            });
        }
        
        // Apply minimum time filter
        if (this.currentFilters.minTimeSpent > 0) {
            filteredTasks = filteredTasks.filter(task => {
                const totalTime = calculateTotalTimeSpent(task.timeEntries || []);
                return totalTime >= this.currentFilters.minTimeSpent;
            });
        }
        
        return filteredTasks;
    }
    
    private async updateOverviewStats() {
        if (!this.overviewStatsEl) return;
        
        const allTasks = await this.getAllTasks();
        const overallStats = this.calculateOverallStats(allTasks);
        
        this.renderOverviewStats(this.overviewStatsEl, overallStats);
    }
    
    private async updateTodayStats() {
        if (!this.todayStatsEl) return;
        
        const today = new Date();
        const startOfToday = startOfDay(today);
        const stats = await this.calculateStatsForRange(startOfToday, today);
        
        this.renderTimeRangeStats(this.todayStatsEl, stats);
    }
    
    private async updateWeekStats() {
        if (!this.weekStatsEl) return;
        
        const today = new Date();
        const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
        const weekStartOptions = { weekStartsOn: firstDaySetting as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
        const weekStart = startOfWeek(today, weekStartOptions);
        const weekEnd = endOfWeek(today, weekStartOptions);
        
        const stats = await this.calculateStatsForRange(weekStart, weekEnd);
        this.renderTimeRangeStats(this.weekStatsEl, stats);
    }
    
    private async updateMonthStats() {
        if (!this.monthStatsEl) return;
        
        const today = new Date();
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        
        const stats = await this.calculateStatsForRange(monthStart, monthEnd);
        this.renderTimeRangeStats(this.monthStatsEl, stats);
    }
    
    private async updateProjectStats() {
        if (!this.projectsStatsEl) return;
        
        const allTasks = await this.getAllTasks();
        const projectStats = this.calculateProjectStats(allTasks);
        
        await this.renderProjectStats(this.projectsStatsEl, projectStats);
    }
    
    /**
     * Consolidate project names that point to the same file.
     * Returns a canonical project name that represents all variations.
     * Based on the implementation from PR #486
     */
    private consolidateProjectName(projectValue: string): string {
        if (!projectValue || typeof projectValue !== 'string') {
            return projectValue;
        }

        // For wikilink format, try to resolve to actual file
        if (projectValue.startsWith('[[') && projectValue.endsWith(']]')) {
            const linkPath = this.extractWikilinkPath(projectValue);
            if (linkPath && this.plugin?.app) {
                const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, '');
                if (resolvedFile) {
                    // Return the file basename as the canonical name
                    return resolvedFile.basename;
                }

                // If file doesn't exist, extract clean name from path
                const cleanName = this.extractProjectName(projectValue);
                if (cleanName) {
                    return cleanName;
                }
            }
        }

        // Handle pipe syntax like "../projects/Genealogy|Genealogy"
        if (projectValue.includes('|')) {
            const parts = projectValue.split('|');
            // Return the display name (after the pipe)
            return parts[parts.length - 1] || projectValue;
        }

        // Handle path-like strings (extract final segment)
        if (projectValue.includes('/')) {
            const parts = projectValue.split('/');
            return parts[parts.length - 1] || projectValue;
        }

        // For plain text projects, return as-is
        return projectValue;
    }

    /**
     * Extract wikilink path from [[...]] format, handling alias syntax
     */
    private extractWikilinkPath(projectValue: string): string | null {
        if (!projectValue.startsWith('[[') || !projectValue.endsWith(']]')) {
            return null;
        }

        const linkContent = projectValue.slice(2, -2);
        
        // Handle alias syntax: [[path|alias]]
        const pipeIndex = linkContent.indexOf('|');
        if (pipeIndex !== -1) {
            return linkContent.substring(0, pipeIndex).trim();
        }
        
        return linkContent;
    }

    /**
     * Extract clean project name from various formats
     */
    private extractProjectName(projectValue: string): string | null {
        if (!projectValue) return null;

        // For wikilinks, extract the link content
        if (projectValue.startsWith('[[') && projectValue.endsWith(']]')) {
            const linkPath = this.extractWikilinkPath(projectValue);
            if (!linkPath) return null;
            
            // Extract basename from path
            const parts = linkPath.split('/');
            return parts[parts.length - 1] || linkPath;
        }

        // For pipe syntax, get the display name
        if (projectValue.includes('|')) {
            const parts = projectValue.split('|');
            return parts[parts.length - 1] || projectValue;
        }

        // For paths, get the final segment
        if (projectValue.includes('/')) {
            const parts = projectValue.split('/');
            return parts[parts.length - 1] || projectValue;
        }

        return projectValue;
    }
    
    private calculateOverallStats(tasks: TaskInfo[]): OverallStats {
        let totalTimeSpent = 0;
        let completedTasks = 0;
        const uniqueProjects = new Set<string>();
        
        for (const task of tasks) {
            totalTimeSpent += calculateTotalTimeSpent(task.timeEntries || []);
            
            if (this.plugin.statusManager.isCompletedStatus(task.status)) {
                completedTasks++;
            }
            
            // Add projects to the set - follow FilterService pattern from PR #486
            const filteredProjects = filterEmptyProjects(task.projects || []);
            if (filteredProjects.length > 0) {
                // Add task to each project group, consolidating names that point to same file
                for (const project of filteredProjects) {
                    const consolidatedProject = this.consolidateProjectName(project);
                    uniqueProjects.add(consolidatedProject);
                }
            } else {
                // Task has no projects - count as "No Project"
                uniqueProjects.add('No Project');
            }
        }
        
        return {
            totalTimeSpent,
            totalTasks: tasks.length,
            completedTasks,
            activeProjects: uniqueProjects.size,
            completionRate: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
            avgTimePerTask: tasks.length > 0 ? totalTimeSpent / tasks.length : 0
        };
    }
    
    private async calculateStatsForRange(startDate: Date, endDate: Date): Promise<TimeRangeStats> {
        const allTasks = await this.getAllTasks();
        
        // Filter tasks that have activity in the range
        const tasksInRange = allTasks.filter(task => {
            // Check if task has time entries in the range
            if (task.timeEntries && task.timeEntries.length > 0) {
                return task.timeEntries.some(entry => {
                    if (!entry.startTime) return false;
                    const entryDate = new Date(entry.startTime);
                    return entryDate >= startDate && entryDate <= endDate;
                });
            }
            
            // Also include tasks completed in this range
            if (task.completedDate) {
                const completedDate = new Date(task.completedDate);
                return completedDate >= startDate && completedDate <= endDate;
            }
            
            // Include tasks created in this range
            if (task.dateCreated) {
                const createdDate = new Date(task.dateCreated);
                return createdDate >= startDate && createdDate <= endDate;
            }
            
            return false;
        });
        
        const overall = this.calculateOverallStats(tasksInRange);
        const projects = this.calculateProjectStats(tasksInRange);
        
        return { overall, projects };
    }
    
    private calculateProjectStats(tasks: TaskInfo[]): ProjectStats[] {
        const projectMap = new Map<string, {
            tasks: TaskInfo[];
            totalTime: number;
            completedCount: number;
            lastActivity: string | undefined;
        }>();
        
        // Group tasks by project - follow FilterService pattern exactly
        for (const task of tasks) {
            const timeSpent = calculateTotalTimeSpent(task.timeEntries || []);
            const isCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
            
            // Get last activity date
            let lastActivity: string | undefined;
            if (task.timeEntries && task.timeEntries.length > 0) {
                const sortedEntries = [...task.timeEntries].sort((a, b) => 
                    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
                );
                lastActivity = sortedEntries[0].startTime;
            } else if (task.completedDate) {
                lastActivity = task.completedDate;
            } else if (task.dateModified) {
                lastActivity = task.dateModified;
            }
            
            // Handle projects exactly like FilterService does in PR #486
            const filteredProjects = filterEmptyProjects(task.projects || []);
            if (filteredProjects.length > 0) {
                // Add task to each project group, consolidating names that point to same file
                for (const project of filteredProjects) {
                    const consolidatedProject = this.consolidateProjectName(project);
                    
                    if (!projectMap.has(consolidatedProject)) {
                        projectMap.set(consolidatedProject, {
                            tasks: [],
                            totalTime: 0,
                            completedCount: 0,
                            lastActivity: undefined
                        });
                    }
                    
                    const projectData = projectMap.get(consolidatedProject)!;
                    projectData.tasks.push(task);
                    projectData.totalTime += timeSpent;
                    if (isCompleted) projectData.completedCount++;
                    
                    // Update last activity if this is more recent
                    if (lastActivity && (!projectData.lastActivity || new Date(lastActivity) > new Date(projectData.lastActivity))) {
                        projectData.lastActivity = lastActivity;
                    }
                }
            } else {
                // Task has no projects - add to "No Project" group (same key as FilterService)
                const noProjectGroup = 'No Project';
                if (!projectMap.has(noProjectGroup)) {
                    projectMap.set(noProjectGroup, {
                        tasks: [],
                        totalTime: 0,
                        completedCount: 0,
                        lastActivity: undefined
                    });
                }
                
                const projectData = projectMap.get(noProjectGroup)!;
                projectData.tasks.push(task);
                projectData.totalTime += timeSpent;
                if (isCompleted) projectData.completedCount++;
                
                if (lastActivity && (!projectData.lastActivity || new Date(lastActivity) > new Date(projectData.lastActivity))) {
                    projectData.lastActivity = lastActivity;
                }
            }
        }
        
        // Convert to ProjectStats array
        const projectStats: ProjectStats[] = [];
        for (const [consolidatedProjectName, data] of projectMap.entries()) {
            projectStats.push({
                projectName: consolidatedProjectName,
                totalTimeSpent: data.totalTime,
                taskCount: data.tasks.length,
                completedTaskCount: data.completedCount,
                avgTimePerTask: data.tasks.length > 0 ? data.totalTime / data.tasks.length : 0,
                lastActivity: data.lastActivity
            });
        }
        
        // Sort by total time spent descending, with "No Project" at the end (like FilterService)
        projectStats.sort((a, b) => {
            if (a.projectName === 'No Project') return 1;
            if (b.projectName === 'No Project') return -1;
            return b.totalTimeSpent - a.totalTimeSpent;
        });
        
        return projectStats;
    }
    
    /**
     * Render filter controls
     */
    private renderFilters() {
        if (!this.filtersEl) return;
        
        this.filtersEl.empty();
        
        // Create filter container with grid layout
        const filterGrid = this.filtersEl.createDiv({ cls: 'stats-view__filter-grid' });
        
        // Date range filter
        const dateRangeContainer = filterGrid.createDiv({ cls: 'stats-view__filter-item' });
        const dateRangeLabel = dateRangeContainer.createDiv({ cls: 'stats-view__filter-label' });
        dateRangeLabel.textContent = 'Date Range';
        
        const dateRangeSelect = dateRangeContainer.createEl('select', { cls: 'stats-view__filter-select' });
        const dateOptions = [
            { value: 'all', text: 'All Time' },
            { value: '7days', text: 'Last 7 Days' },
            { value: '30days', text: 'Last 30 Days' },
            { value: '90days', text: 'Last 90 Days' },
            { value: 'custom', text: 'Custom Range' }
        ];
        
        for (const option of dateOptions) {
            const optionEl = dateRangeSelect.createEl('option', { 
                value: option.value, 
                text: option.text 
            });
            if (option.value === this.currentFilters.dateRange) {
                optionEl.selected = true;
            }
        }
        
        this.registerDomEvent(dateRangeSelect, 'change', () => {
            this.currentFilters.dateRange = dateRangeSelect.value as StatsFilters['dateRange'];
            this.renderCustomDateInputs();
            this.applyFilters();
        });
        
        // Custom date inputs container
        const customDatesContainer = filterGrid.createDiv({ cls: 'stats-view__custom-dates' });
        if (this.currentFilters.dateRange === 'custom') {
            this.renderCustomDateInputs(customDatesContainer);
        }
        
        // Minimum time filter
        const minTimeContainer = filterGrid.createDiv({ cls: 'stats-view__filter-item' });
        const minTimeLabel = minTimeContainer.createDiv({ cls: 'stats-view__filter-label' });
        minTimeLabel.textContent = 'Min Time (minutes)';
        
        const minTimeInput = minTimeContainer.createEl('input', { 
            cls: 'stats-view__filter-input',
            type: 'number',
            value: this.currentFilters.minTimeSpent.toString(),
            placeholder: '0'
        });
        
        this.registerDomEvent(minTimeInput, 'input', () => {
            this.currentFilters.minTimeSpent = parseInt(minTimeInput.value) || 0;
            this.applyFilters();
        });
        
        // Apply/Reset buttons
        const buttonsContainer = filterGrid.createDiv({ cls: 'stats-view__filter-buttons' });
        
        const resetButton = buttonsContainer.createEl('button', {
            cls: 'stats-view__filter-button stats-view__filter-button--reset',
            text: 'Reset Filters'
        });
        
        this.registerDomEvent(resetButton, 'click', () => {
            this.currentFilters = {
                dateRange: 'all',
                selectedProjects: [],
                minTimeSpent: 0
            };
            this.renderFilters();
            this.applyFilters();
        });
    }
    
    /**
     * Render custom date inputs when needed
     */
    private renderCustomDateInputs(container?: HTMLElement) {
        const customDatesContainer = container || this.filtersEl?.querySelector('.stats-view__custom-dates') as HTMLElement;
        if (!customDatesContainer) return;
        
        customDatesContainer.empty();
        
        if (this.currentFilters.dateRange === 'custom') {
            const startDateContainer = customDatesContainer.createDiv({ cls: 'stats-view__date-input-container' });
            const startLabel = startDateContainer.createDiv({ cls: 'stats-view__date-label', text: 'From' });
            const startInput = startDateContainer.createEl('input', {
                cls: 'stats-view__date-input',
                type: 'date',
                value: this.currentFilters.customStartDate || ''
            });
            
            const endDateContainer = customDatesContainer.createDiv({ cls: 'stats-view__date-input-container' });
            const endLabel = endDateContainer.createDiv({ cls: 'stats-view__date-label', text: 'To' });
            const endInput = endDateContainer.createEl('input', {
                cls: 'stats-view__date-input',
                type: 'date',
                value: this.currentFilters.customEndDate || ''
            });
            
            this.registerDomEvent(startInput, 'change', () => {
                this.currentFilters.customStartDate = startInput.value;
                this.applyFilters();
            });
            
            this.registerDomEvent(endInput, 'change', () => {
                this.currentFilters.customEndDate = endInput.value;
                this.applyFilters();
            });
        }
    }
    
    /**
     * Apply current filters and refresh statistics
     */
    private async applyFilters() {
        await this.refreshStats();
    }
    
    /**
     * Get date range based on current filters
     */
    private getFilterDateRange(): { start?: Date; end?: Date } {
        const now = new Date();
        
        switch (this.currentFilters.dateRange) {
            case '7days':
                return {
                    start: subDays(now, 7),
                    end: now
                };
            case '30days':
                return {
                    start: subDays(now, 30),
                    end: now
                };
            case '90days':
                return {
                    start: subDays(now, 90),
                    end: now
                };
            case 'custom':
                return {
                    start: this.currentFilters.customStartDate ? new Date(this.currentFilters.customStartDate) : undefined,
                    end: this.currentFilters.customEndDate ? new Date(this.currentFilters.customEndDate) : undefined
                };
            case 'all':
            default:
                return {};
        }
    }
    
    
    private renderOverviewStats(container: HTMLElement, stats: OverallStats) {
        container.empty();
        
        // Format time duration in hours and minutes
        const formatTime = (minutes: number): string => {
            if (minutes < 60) return `${Math.round(minutes)}m`;
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        };
        
        // Total Time
        const totalTimeCard = container.createDiv({ cls: 'stats-overview-card stats-view__overview-card' });
        const totalTimeValue = totalTimeCard.createDiv({ cls: 'overview-value stats-view__overview-value' });
        totalTimeValue.textContent = formatTime(stats.totalTimeSpent);
        totalTimeCard.createDiv({ cls: 'overview-label stats-view__overview-label', text: 'Total Time Tracked' });
        
        // Total Tasks
        const totalTasksCard = container.createDiv({ cls: 'stats-overview-card stats-view__overview-card' });
        const totalTasksValue = totalTasksCard.createDiv({ cls: 'overview-value stats-view__overview-value' });
        totalTasksValue.textContent = stats.totalTasks.toString();
        totalTasksCard.createDiv({ cls: 'overview-label stats-view__overview-label', text: 'Total Tasks' });
        
        // Completion Rate
        const completionCard = container.createDiv({ cls: 'stats-overview-card stats-view__overview-card' });
        const completionValue = completionCard.createDiv({ cls: 'overview-value stats-view__overview-value' });
        completionValue.textContent = `${Math.round(stats.completionRate)}%`;
        completionCard.createDiv({ cls: 'overview-label stats-view__overview-label', text: 'Completion Rate' });
        
        // Active Projects
        const projectsCard = container.createDiv({ cls: 'stats-overview-card stats-view__overview-card' });
        const projectsValue = projectsCard.createDiv({ cls: 'overview-value stats-view__overview-value' });
        projectsValue.textContent = stats.activeProjects.toString();
        projectsCard.createDiv({ cls: 'overview-label stats-view__overview-label', text: 'Active Projects' });
        
        // Average Time per Task
        const avgTimeCard = container.createDiv({ cls: 'stats-overview-card stats-view__overview-card' });
        const avgTimeValue = avgTimeCard.createDiv({ cls: 'overview-value stats-view__overview-value' });
        avgTimeValue.textContent = formatTime(stats.avgTimePerTask);
        avgTimeCard.createDiv({ cls: 'overview-label stats-view__overview-label', text: 'Avg Time per Task' });
    }
    
    private renderTimeRangeStats(container: HTMLElement, stats: TimeRangeStats) {
        container.empty();
        
        const formatTime = (minutes: number): string => {
            if (minutes < 60) return `${Math.round(minutes)}m`;
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        };
        
        // Time Tracked
        const timeCard = container.createDiv({ cls: 'stats-stat-card stats-view__stat-card' });
        timeCard.createDiv({ cls: 'stat-value stats-view__stat-value', text: formatTime(stats.overall.totalTimeSpent) });
        timeCard.createDiv({ cls: 'stat-label stats-view__stat-label', text: 'Time Tracked' });
        
        // Tasks
        const tasksCard = container.createDiv({ cls: 'stats-stat-card stats-view__stat-card' });
        tasksCard.createDiv({ cls: 'stat-value stats-view__stat-value', text: stats.overall.totalTasks.toString() });
        tasksCard.createDiv({ cls: 'stat-label stats-view__stat-label', text: 'Tasks' });
        
        // Completed
        const completedCard = container.createDiv({ cls: 'stats-stat-card stats-view__stat-card' });
        completedCard.createDiv({ cls: 'stat-value stats-view__stat-value', text: stats.overall.completedTasks.toString() });
        completedCard.createDiv({ cls: 'stat-label stats-view__stat-label', text: 'Completed' });
        
        // Projects
        const projectsCard = container.createDiv({ cls: 'stats-stat-card stats-view__stat-card' });
        projectsCard.createDiv({ cls: 'stat-value stats-view__stat-value', text: stats.overall.activeProjects.toString() });
        projectsCard.createDiv({ cls: 'stat-label stats-view__stat-label', text: 'Projects' });
    }
    
    private async renderProjectStats(container: HTMLElement, projects: ProjectStats[]) {
        container.empty();
        
        if (projects.length === 0) {
            container.createDiv({ 
                cls: 'stats-no-data stats-view__no-data',
                text: 'No project data available'
            });
            return;
        }
        
        const formatTime = (minutes: number): string => {
            if (minutes < 60) return `${Math.round(minutes)}m`;
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        };
        
        const formatDate = (dateString?: string): string => {
            if (!dateString) return 'N/A';
            try {
                const date = new Date(dateString);
                return format(date, 'MMM d, yyyy');
            } catch {
                return 'N/A';
            }
        };
        
        // Calculate max time for relative bar sizing
        const maxTime = Math.max(...projects.map(p => p.totalTimeSpent));
        
        for (const project of projects) {
            const projectClasses = ['stats-project-item', 'stats-view__project-item', 'stats-view__project-item--clickable'];
            
            // Add special class for "No Project" items
            if (project.projectName === 'No Project') {
                projectClasses.push('stats-view__project-item--no-project');
            }
            
            const projectEl = container.createDiv({ 
                cls: projectClasses.join(' ')
            });
            
            // Make project clickable for drill-down
            this.registerDomEvent(projectEl, 'click', () => {
                console.log('Project clicked:', project.projectName);
                this.openProjectDrilldown(project.projectName);
            });
            
            // Project header with name and completion rate
            const headerEl = projectEl.createDiv({ cls: 'stats-view__project-header' });
            
            const nameEl = headerEl.createDiv({ cls: 'project-name stats-view__project-name' });
            nameEl.textContent = project.projectName;
            
            // Add click indicator
            const clickIndicator = headerEl.createDiv({ 
                cls: 'stats-view__click-indicator',
                text: '→'
            });
            
            const completionRate = project.taskCount > 0 ? (project.completedTaskCount / project.taskCount) * 100 : 0;
            
            // Main content grid
            const contentGrid = projectEl.createDiv({ cls: 'stats-view__project-content-grid' });

            // Left side: Progress circle and details
            const progressContainer = contentGrid.createDiv({ cls: 'stats-view__progress-container' });
            this.renderProgressCircle(progressContainer, completionRate, project.completedTaskCount, project.taskCount);

            // Right side: Stats and trend
            const statsContainer = contentGrid.createDiv({ cls: 'stats-view__stats-container' });

            // Time visualization bar
            if (project.totalTimeSpent > 0) {
                const timeBar = statsContainer.createDiv({ cls: 'stats-view__time-bar' });
                const timeBarVisual = timeBar.createDiv({ cls: 'stats-view__time-bar-visual' });
                const timeBarFill = timeBarVisual.createDiv({ cls: 'stats-view__time-bar-fill' });
                const timePercentage = maxTime > 0 ? (project.totalTimeSpent / maxTime) * 100 : 0;
                timeBarFill.style.width = `${timePercentage}%`;
                
                const timeLabel = timeBar.createDiv({ cls: 'stats-view__time-bar-label' });
                timeLabel.textContent = formatTime(project.totalTimeSpent);
            }

            // Additional stats
            const statsEl = statsContainer.createDiv({ cls: 'project-stats stats-view__project-stats' });
            
            if (project.lastActivity) {
                const activityEl = statsEl.createDiv({ cls: 'project-stat stats-view__project-stat' });
                activityEl.textContent = `Last activity: ${formatDate(project.lastActivity)}`;
            }
            
            if (project.avgTimePerTask > 0) {
                const avgEl = statsEl.createDiv({ cls: 'project-stat stats-view__project-stat' });
                avgEl.textContent = `Avg: ${formatTime(project.avgTimePerTask)}/task`;
            }

            // Add sparkline trend (load asynchronously)
            const trendContainer = statsContainer.createDiv({ cls: 'stats-view__trend-container' });
            const sparklineEl = trendContainer.createDiv({ cls: 'stats-view__sparkline' });
            
            // Load trend data synchronously for now - we can optimize later
            try {
                const trendData = await this.calculateProjectTrend(project.projectName);
                if (trendData.length > 0 && trendData.some(d => d.value > 0)) {
                    this.renderSparkline(sparklineEl, trendData);
                } else {
                    trendContainer.remove();
                }
            } catch (error) {
                console.error('Error loading trend data:', error);
                trendContainer.remove();
            }
        }
    }

    private renderProgressCircle(container: HTMLElement, percentage: number, completed: number, total: number) {
        const size = 60;
        const strokeWidth = 5;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size.toString());
        svg.setAttribute('height', size.toString());
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.classList.add('stats-view__progress-circle-svg');

        const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        backgroundCircle.setAttribute('cx', (size / 2).toString());
        backgroundCircle.setAttribute('cy', (size / 2).toString());
        backgroundCircle.setAttribute('r', radius.toString());
        backgroundCircle.classList.add('stats-view__progress-circle-bg');

        const foregroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        foregroundCircle.setAttribute('cx', (size / 2).toString());
        foregroundCircle.setAttribute('cy', (size / 2).toString());
        foregroundCircle.setAttribute('r', radius.toString());
        foregroundCircle.setAttribute('stroke-dasharray', `${circumference} ${circumference}`);
        foregroundCircle.setAttribute('stroke-dashoffset', offset.toString());
        foregroundCircle.classList.add('stats-view__progress-circle-fg');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '50%');
        text.setAttribute('y', '50%');
        text.setAttribute('dy', '0.3em');
        text.setAttribute('text-anchor', 'middle');
        text.classList.add('stats-view__progress-circle-text');
        text.textContent = `${Math.round(percentage)}%`;

        svg.appendChild(backgroundCircle);
        svg.appendChild(foregroundCircle);
        svg.appendChild(text);

        container.appendChild(svg);

        const label = container.createDiv({ cls: 'stats-view__progress-label' });
        label.textContent = `${completed}/${total} tasks`;
    }
    
    /**
     * Calculate trend data for a project over the last 30 days
     */
    private async calculateProjectTrend(projectName: string): Promise<TrendDataPoint[]> {
        try {
            const allTasks = await this.plugin.cacheManager.getAllTaskPaths();
            const projectTasks: TaskInfo[] = [];
            
            // Get all tasks for this project
            for (const path of allTasks) {
                try {
                    const task = await this.plugin.cacheManager.getTaskInfo(path);
                    if (task) {
                        const filteredProjects = filterEmptyProjects(task.projects || []);
                        for (const project of filteredProjects) {
                            const consolidatedProject = this.consolidateProjectName(project);
                            if (consolidatedProject === projectName) {
                                projectTasks.push(task);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Failed to get task info for trend: ${path}`, error);
                }
            }
            
            // Calculate daily time spent over last 30 days
            const trendData: TrendDataPoint[] = [];
            const today = new Date();
            
            for (let i = 29; i >= 0; i--) {
                const date = subDays(today, i);
                const dateStr = format(date, 'yyyy-MM-dd');
                let dailyTime = 0;
                
                for (const task of projectTasks) {
                    if (task.timeEntries) {
                        for (const entry of task.timeEntries) {
                            if (entry.startTime) {
                                const entryDate = format(new Date(entry.startTime), 'yyyy-MM-dd');
                                if (entryDate === dateStr) {
                                    dailyTime += calculateTotalTimeSpent([entry]);
                                }
                            }
                        }
                    }
                }
                
                trendData.push({
                    date: dateStr,
                    value: dailyTime
                });
            }
            
            return trendData;
        } catch (error) {
            console.error('Error calculating project trend:', error);
            return [];
        }
    }
    
    /**
     * Render SVG sparkline
     */
    private renderSparkline(container: HTMLElement, data: TrendDataPoint[]) {
        console.log('Rendering sparkline with data:', data.length, 'points');
        container.empty();
        
        if (data.length === 0) {
            console.log('No data for sparkline');
            return;
        }
        
        const width = 100;
        const height = 20;
        const maxValue = Math.max(...data.map(d => d.value));
        
        console.log('Sparkline max value:', maxValue);
        if (maxValue === 0) {
            console.log('Max value is 0, not rendering sparkline');
            return;
        }
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width.toString());
        svg.setAttribute('height', height.toString());
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.classList.add('stats-view__sparkline-svg');
        
        // Create path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        let pathD = '';
        data.forEach((point, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - (point.value / maxValue) * height;
            
            if (index === 0) {
                pathD += `M ${x} ${y}`;
            } else {
                pathD += ` L ${x} ${y}`;
            }
        });
        
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('opacity', '0.7');
        
        svg.appendChild(path);
        container.appendChild(svg);
    }
    
    /**
     * Open project drill-down modal
     */
    private async openProjectDrilldown(projectName: string) {
        console.log('Opening drill-down for project:', projectName);
        
        // Remove any existing modal
        this.closeDrilldownModal();
        
        // Create modal backdrop
        const backdrop = document.body.createDiv({ cls: 'stats-view__modal-backdrop' });
        this.drilldownModal = backdrop;
        
        console.log('Modal backdrop created:', backdrop);
        console.log('Modal backdrop classes:', backdrop.className);
        console.log('Modal backdrop style display:', window.getComputedStyle(backdrop).display);
        console.log('Modal backdrop style position:', window.getComputedStyle(backdrop).position);
        console.log('Modal backdrop style z-index:', window.getComputedStyle(backdrop).zIndex);
        
        // Create modal content with proper CSS scope for TaskCard components
        const modal = backdrop.createDiv({ cls: 'stats-view__modal tasknotes-plugin' });
        console.log('Modal created:', modal);
        
        // Modal header
        const header = modal.createDiv({ cls: 'stats-view__modal-header' });
        const title = header.createDiv({ cls: 'stats-view__modal-title' });
        title.textContent = `${projectName} - Detailed View`;
        
        const closeBtn = header.createEl('button', { 
            cls: 'stats-view__modal-close',
            text: '×'
        });
        
        // Modal content
        const content = modal.createDiv({ cls: 'stats-view__modal-content' });
        content.textContent = 'Loading...';
        
        // Event handlers
        this.registerDomEvent(closeBtn, 'click', () => this.closeDrilldownModal());
        this.registerDomEvent(backdrop, 'click', (e) => {
            if (e.target === backdrop) this.closeDrilldownModal();
        });
        
        // ESC key handler
        const escHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeDrilldownModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Load and render drill-down data
        try {
            const drilldownData = await this.getProjectDrilldownData(projectName);
            this.renderDrilldownContent(content, drilldownData);
        } catch (error) {
            console.error('Error loading drill-down data:', error);
            content.textContent = 'Error loading project details.';
        }
    }
    
    /**
     * Close drill-down modal
     */
    private closeDrilldownModal() {
        if (this.drilldownModal) {
            this.drilldownModal.remove();
            this.drilldownModal = null;
        }
    }
    
    /**
     * Get detailed data for project drill-down
     */
    private async getProjectDrilldownData(projectName: string): Promise<ProjectDrilldownData> {
        const allTasks = await this.plugin.cacheManager.getAllTaskPaths();
        const projectTasks: TaskInfo[] = [];
        
        // Get all tasks for this project
        for (const path of allTasks) {
            try {
                const task = await this.plugin.cacheManager.getTaskInfo(path);
                if (task) {
                    const filteredProjects = filterEmptyProjects(task.projects || []);
                    for (const project of filteredProjects) {
                        const consolidatedProject = this.consolidateProjectName(project);
                        if (consolidatedProject === projectName) {
                            projectTasks.push(task);
                            break;
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to get task for drill-down: ${path}`, error);
            }
        }
        
        // Calculate stats
        const totalTimeSpent = projectTasks.reduce((sum, task) => 
            sum + calculateTotalTimeSpent(task.timeEntries || []), 0);
        
        const completedTasks = projectTasks.filter(task => 
            this.plugin.statusManager.isCompletedStatus(task.status)).length;
        
        const completionRate = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;
        
        // Get recent activity (last 10 tasks with time entries or recent completion)
        const recentActivity = projectTasks
            .filter(task => task.timeEntries?.length || task.completedDate)
            .sort((a, b) => {
                const aTime = a.timeEntries?.length ? 
                    Math.max(...a.timeEntries.map(e => new Date(e.startTime).getTime())) :
                    (a.completedDate ? new Date(a.completedDate).getTime() : 0);
                const bTime = b.timeEntries?.length ? 
                    Math.max(...b.timeEntries.map(e => new Date(e.startTime).getTime())) :
                    (b.completedDate ? new Date(b.completedDate).getTime() : 0);
                return bTime - aTime;
            })
            .slice(0, 10);
        
        // Calculate time by day for the last 30 days
        const timeByDay: TimeByDay[] = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = subDays(today, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            let dayTime = 0;
            let dayTasks = 0;
            let dayCompleted = 0;
            
            for (const task of projectTasks) {
                // Check time entries
                if (task.timeEntries) {
                    const dayEntries = task.timeEntries.filter(entry => 
                        format(new Date(entry.startTime), 'yyyy-MM-dd') === dateStr);
                    if (dayEntries.length > 0) {
                        dayTime += calculateTotalTimeSpent(dayEntries);
                        dayTasks++;
                    }
                }
                
                // Check completion date
                if (task.completedDate && format(new Date(task.completedDate), 'yyyy-MM-dd') === dateStr) {
                    dayCompleted++;
                    if (!task.timeEntries?.some(entry => 
                        format(new Date(entry.startTime), 'yyyy-MM-dd') === dateStr)) {
                        dayTasks++;
                    }
                }
            }
            
            timeByDay.push({
                date: dateStr,
                timeSpent: dayTime,
                taskCount: dayTasks,
                completedTasks: dayCompleted
            });
        }
        
        return {
            projectName,
            tasks: projectTasks,
            totalTimeSpent,
            completionRate,
            timeByDay,
            recentActivity
        };
    }
    
    /**
     * Render drill-down modal content
     */
    private renderDrilldownContent(container: HTMLElement, data: ProjectDrilldownData) {
        container.empty();
        
        const formatTime = (minutes: number): string => {
            if (minutes < 60) return `${Math.round(minutes)}m`;
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        };
        
        // Overview stats with enhanced metrics
        const overviewEl = container.createDiv({ cls: 'stats-view__drilldown-overview' });
        
        const statsGrid = overviewEl.createDiv({ cls: 'stats-view__drilldown-stats' });
        
        const totalTimeCard = statsGrid.createDiv({ cls: 'stats-view__drilldown-card' });
        totalTimeCard.createDiv({ cls: 'stats-view__drilldown-value', text: formatTime(data.totalTimeSpent) });
        totalTimeCard.createDiv({ cls: 'stats-view__drilldown-label', text: 'Total Time' });
        
        const tasksCard = statsGrid.createDiv({ cls: 'stats-view__drilldown-card' });
        tasksCard.createDiv({ cls: 'stats-view__drilldown-value', text: data.tasks.length.toString() });
        tasksCard.createDiv({ cls: 'stats-view__drilldown-label', text: 'Total Tasks' });
        
        const completionCard = statsGrid.createDiv({ cls: 'stats-view__drilldown-card' });
        completionCard.createDiv({ cls: 'stats-view__drilldown-value', text: `${Math.round(data.completionRate)}%` });
        completionCard.createDiv({ cls: 'stats-view__drilldown-label', text: 'Completed' });
        
        // Add average time per task
        const avgTimeCard = statsGrid.createDiv({ cls: 'stats-view__drilldown-card' });
        const avgTime = data.tasks.length > 0 ? data.totalTimeSpent / data.tasks.length : 0;
        avgTimeCard.createDiv({ cls: 'stats-view__drilldown-value', text: formatTime(avgTime) });
        avgTimeCard.createDiv({ cls: 'stats-view__drilldown-label', text: 'Avg per Task' });
        
        // Activity chart
        const chartSection = container.createDiv({ cls: 'stats-view__drilldown-section' });
        chartSection.createDiv({ cls: 'stats-view__drilldown-heading', text: 'Activity Over Time (Last 30 Days)' });
        const chartEl = chartSection.createDiv({ cls: 'stats-view__activity-chart' });
        this.renderActivityChart(chartEl, data.timeByDay);
        
        // All project tasks section (improved from just recent activity)
        const tasksSection = container.createDiv({ cls: 'stats-view__drilldown-section' });
        const tasksHeaderContainer = tasksSection.createDiv({ cls: 'stats-view__section-header' });
        tasksHeaderContainer.createDiv({ cls: 'stats-view__drilldown-heading', text: 'All Project Tasks' });
        
        // Add filter controls for tasks
        const taskFilters = tasksHeaderContainer.createDiv({ cls: 'stats-view__task-filters' });
        const statusFilter = taskFilters.createEl('select', { cls: 'stats-view__filter-select' });
        statusFilter.createEl('option', { value: 'all', text: 'All Tasks' });
        statusFilter.createEl('option', { value: 'active', text: 'Active Only' });
        statusFilter.createEl('option', { value: 'completed', text: 'Completed Only' });
        
        const taskList = tasksSection.createDiv({ cls: 'stats-view__task-list' });
        
        // Function to render filtered tasks
        const renderTasks = (filterStatus: string = 'all') => {
            taskList.empty();
            
            let filteredTasks = data.tasks;
            if (filterStatus === 'active') {
                filteredTasks = data.tasks.filter(task => !this.plugin.statusManager.isCompletedStatus(task.status));
            } else if (filterStatus === 'completed') {
                filteredTasks = data.tasks.filter(task => this.plugin.statusManager.isCompletedStatus(task.status));
            }
            
            // Sort tasks: incomplete first, then by last activity
            filteredTasks.sort((a, b) => {
                const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
                const bCompleted = this.plugin.statusManager.isCompletedStatus(b.status);
                
                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1; // Incomplete tasks first
                }
                
                // Sort by last activity (time entries or modification date)
                const getLastActivity = (task: TaskInfo): number => {
                    if (task.timeEntries?.length) {
                        return Math.max(...task.timeEntries.map(e => new Date(e.startTime).getTime()));
                    }
                    return task.dateModified ? new Date(task.dateModified).getTime() : 0;
                };
                
                return getLastActivity(b) - getLastActivity(a);
            });
            
            if (filteredTasks.length === 0) {
                taskList.createDiv({ cls: 'stats-view__no-data', text: 'No tasks found' });
                return;
            }
            
            // Show task count
            const countEl = taskList.createDiv({ cls: 'stats-view__task-count' });
            countEl.textContent = `Showing ${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`;
            
            for (const task of filteredTasks) {
                // Create TaskCard with checkbox disabled as requested
                const taskCard = createTaskCard(task, this.plugin, {
                    showDueDate: true,
                    showCheckbox: false,
                    showArchiveButton: false,
                    showTimeTracking: true,
                    showRecurringControls: true,
                    groupByDate: false
                });
                
                taskList.appendChild(taskCard);
            }
        };
        
        // Initial render
        renderTasks('all');
        
        // Add filter event listener
        this.registerDomEvent(statusFilter, 'change', () => {
            renderTasks(statusFilter.value);
        });
    }
    
    /**
     * Render activity chart using simple bars
     */
    private renderActivityChart(container: HTMLElement, timeByDay: TimeByDay[]) {
        container.empty();
        
        if (timeByDay.length === 0) return;
        
        const maxTime = Math.max(...timeByDay.map(d => d.timeSpent));
        if (maxTime === 0) {
            container.createDiv({ cls: 'stats-view__no-data', text: 'No time tracking data' });
            return;
        }
        
        const chartContainer = container.createDiv({ cls: 'stats-view__bar-chart' });
        
        for (const day of timeByDay) {
            const barContainer = chartContainer.createDiv({ cls: 'stats-view__bar-container' });
            
            const bar = barContainer.createDiv({ cls: 'stats-view__bar' });
            const height = (day.timeSpent / maxTime) * 40; // Max 40px height
            bar.style.height = `${height}px`;
            
            // Tooltip
            const tooltip = `${format(new Date(day.date), 'MMM d')}: ${Math.round(day.timeSpent)}m`;
            bar.setAttribute('title', tooltip);
        }
    }
}