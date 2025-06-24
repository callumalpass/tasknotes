import { ItemView, WorkspaceLeaf, Notice, EventRef, Setting } from 'obsidian';
import TaskNotesPlugin from '../main';
import { 
    POMODORO_VIEW_TYPE,
    EVENT_POMODORO_START,
    EVENT_POMODORO_COMPLETE,
    EVENT_POMODORO_INTERRUPT,
    EVENT_POMODORO_TICK,
    PomodoroSession,
    PomodoroState,
    TaskInfo
} from '../types';
import { TaskSelectorModal } from '../modals/TaskSelectorModal';

export class PomodoroView extends ItemView {
    plugin: TaskNotesPlugin;
    
    // UI elements
    private timerDisplay: HTMLElement | null = null;
    private statusDisplay: HTMLElement | null = null;
    private progressCircle: SVGCircleElement | null = null;
    private progressContainer: HTMLElement | null = null;
    private startButton: HTMLButtonElement | null = null;
    private pauseButton: HTMLButtonElement | null = null;
    private stopButton: HTMLButtonElement | null = null;
    private taskDisplay: HTMLElement | null = null;
    private statsDisplay: HTMLElement | null = null;
    private taskSelectButton: HTMLButtonElement | null = null;
    private currentSelectedTask: TaskInfo | null = null;
    
    // Cache stat elements to avoid innerHTML
    private statElements: {
        pomodoros: HTMLElement | null;
        streak: HTMLElement | null; 
        minutes: HTMLElement | null;
    } = { pomodoros: null, streak: null, minutes: null };
    
    // Event listeners
    private listeners: EventRef[] = [];
    
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Register event listeners
        this.registerEvents();
    }
    
    getViewType(): string {
        return POMODORO_VIEW_TYPE;
    }
    
    getDisplayText(): string {
        return 'Pomodoro';
    }
    
    getIcon(): string {
        return 'clock';
    }
    
    registerEvents(): void {
        // Clean up any existing listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];
        
        // Listen for pomodoro events
        const startListener = this.plugin.emitter.on(EVENT_POMODORO_START, ({ session, task }) => {
            this.updateDisplay(session, task);
        });
        this.listeners.push(startListener);
        
        const completeListener = this.plugin.emitter.on(EVENT_POMODORO_COMPLETE, ({ session, nextType }) => {
            this.onPomodoroComplete(session, nextType);
        });
        this.listeners.push(completeListener);
        
        const interruptListener = this.plugin.emitter.on(EVENT_POMODORO_INTERRUPT, ({ session }) => {
            this.updateDisplay();
        });
        this.listeners.push(interruptListener);
        
        const tickListener = this.plugin.emitter.on(EVENT_POMODORO_TICK, ({ timeRemaining, session }) => {
            this.updateTimer(timeRemaining);
            this.updateDisplay(session);
        });
        this.listeners.push(tickListener);
    }
    
    async onOpen() {
        // Wait for the plugin to be fully initialized before proceeding
        await this.plugin.onReady();
        await this.render();
    }
    
    async onClose() {
        // Remove event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        
        // Clear cached references to prevent memory leaks
        this.timerDisplay = null;
        this.statusDisplay = null;
        this.progressCircle = null;
        this.progressContainer = null;
        this.startButton = null;
        this.pauseButton = null;
        this.stopButton = null;
        this.taskDisplay = null;
        this.statsDisplay = null;
        this.taskSelectButton = null;
        this.currentSelectedTask = null;
        this.statElements = { pomodoros: null, streak: null, minutes: null };
        
        this.contentEl.empty();
    }
    
    async render() {
        const container = this.contentEl.createDiv({ cls: 'tasknotes-plugin pomodoro-view' });
        
        
        // Timer display with progress circle
        const timerSection = container.createDiv({ cls: 'pomodoro-view__timer-section' });
        
        // Create progress circle container
        this.progressContainer = timerSection.createDiv({ cls: 'pomodoro-view__progress-container' });
        
        // Create SVG progress circle
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'pomodoro-view__progress-svg');
        svg.setAttribute('width', '240');
        svg.setAttribute('height', '240');
        svg.setAttribute('viewBox', '0 0 240 240');
        this.progressContainer.appendChild(svg);
        
        // Background circle
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttributeNS(null, 'cx', '120');
        bgCircle.setAttributeNS(null, 'cy', '120');
        bgCircle.setAttributeNS(null, 'r', '110');
        bgCircle.setAttributeNS(null, 'fill', 'none');
        bgCircle.setAttributeNS(null, 'stroke', 'var(--tn-border-color)');
        bgCircle.setAttributeNS(null, 'stroke-width', '4');
        svg.appendChild(bgCircle);
        
        // Progress circle
        this.progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle') as SVGCircleElement;
        this.progressCircle.setAttributeNS(null, 'cx', '120');
        this.progressCircle.setAttributeNS(null, 'cy', '120');
        this.progressCircle.setAttributeNS(null, 'r', '110');
        this.progressCircle.setAttributeNS(null, 'fill', 'none');
        this.progressCircle.setAttributeNS(null, 'stroke', 'var(--tn-interactive-accent)');
        this.progressCircle.setAttributeNS(null, 'stroke-width', '6');
        this.progressCircle.setAttributeNS(null, 'stroke-linecap', 'round');
        
        // Calculate circumference: 2 * π * radius
        const radius = 110;
        const circumference = 2 * Math.PI * radius; // ≈ 691.15
        
        this.progressCircle.setAttributeNS(null, 'stroke-dasharray', circumference.toString());
        this.progressCircle.setAttributeNS(null, 'stroke-dashoffset', circumference.toString());
        this.progressCircle.addClass('pomodoro-view__progress-circle');
        svg.appendChild(this.progressCircle);
        
        // Timer display overlay
        const timerOverlay = this.progressContainer.createDiv({ cls: 'pomodoro-view__timer-overlay' });
        
        // Timer display
        this.timerDisplay = timerOverlay.createDiv({ cls: 'pomodoro-view__timer-display', text: '25:00' });
        
        // Status display
        this.statusDisplay = timerSection.createDiv({ cls: 'pomodoro-view__status', text: 'Ready to start' });
        
        // Task display
        this.taskDisplay = container.createDiv({ cls: 'pomodoro-view__task-display' });
        
        // Task selector
        const taskSelectorSection = container.createDiv({ cls: 'pomodoro-view__task-selector' });
        taskSelectorSection.createEl('label', { cls: 'pomodoro-view__task-selector-label', text: 'Select task (optional):' });
        
        const taskSelectorContainer = taskSelectorSection.createDiv({ cls: 'pomodoro-view__task-selector-container' });
        
        this.taskSelectButton = taskSelectorContainer.createEl('button', { 
            cls: 'pomodoro-view__task-select-button',
            text: 'Choose task...'
        });
        
        // Add click handler for task selector button
        this.registerDomEvent(this.taskSelectButton, 'click', async () => {
            await this.openTaskSelector();
        });
        
        // Add clear button
        const clearButton = taskSelectorContainer.createEl('button', {
            cls: 'pomodoro-view__task-clear-button',
            text: 'Clear'
        });
        
        this.registerDomEvent(clearButton, 'click', async () => {
            await this.selectTask(null);
        });
        
        // Load and restore last selected task
        this.restoreLastSelectedTask();
        
        // Main control section
        const controlSection = container.createDiv({ cls: 'pomodoro-view__control-section' });
        
        // Primary controls (main timer controls)
        const primaryControls = controlSection.createDiv({ cls: 'pomodoro-view__primary-controls' });
        
        this.startButton = primaryControls.createEl('button', { 
            text: 'Start', 
            cls: 'pomodoro-view__start-button'
        });
        
        this.pauseButton = primaryControls.createEl('button', { 
            text: 'Pause', 
            cls: 'pomodoro-view__pause-button'
        });
        this.pauseButton.addClass('pomodoro-view__pause-button--hidden');
        
        this.stopButton = primaryControls.createEl('button', { 
            text: 'Stop', 
            cls: 'pomodoro-view__stop-button'
        });
        this.stopButton.addClass('pomodoro-view__stop-button--hidden');
        
        // Quick start actions (grouped together)
        const quickStartSection = controlSection.createDiv({ cls: 'pomodoro-view__quick-start-section' });
        quickStartSection.createDiv({ cls: 'pomodoro-view__section-label', text: 'Quick start' });
        
        const quickActions = quickStartSection.createDiv({ cls: 'pomodoro-view__quick-actions' });
        
        const workButton = quickActions.createEl('button', {
            text: 'Work session',
            cls: 'pomodoro-view__quick-button pomodoro-view__work-button'
        });
        
        const shortBreakButton = quickActions.createEl('button', {
            text: 'Short break',
            cls: 'pomodoro-view__quick-button pomodoro-view__short-break-button'
        });
        
        const longBreakButton = quickActions.createEl('button', {
            text: 'Long break',
            cls: 'pomodoro-view__quick-button pomodoro-view__long-break-button'
        });
        
        // Statistics
        const statsSection = container.createDiv({ cls: 'pomodoro-view__stats-section' });
        const statsHeader = statsSection.createDiv({ cls: 'pomodoro-view__stats-header' });
        new Setting(statsHeader)
            .setName('Today\'s progress')
            .setHeading();
        
        const viewStatsButton = statsHeader.createEl('button', {
            cls: 'pomodoro-view__view-stats-button',
            text: 'View all stats'
        });
        
        this.registerDomEvent(viewStatsButton, 'click', async () => {
            await this.plugin.activatePomodoroStatsView();
        });
        
        this.statsDisplay = statsSection.createDiv({ cls: 'pomodoro-view__stats' });
        
        // Create stat elements and cache references
        const pomodoroStat = this.statsDisplay.createDiv({ cls: 'pomodoro-view__stat' });
        this.statElements.pomodoros = pomodoroStat.createSpan({ cls: 'pomodoro-view__stat-value', text: '0' });
        pomodoroStat.createSpan({ cls: 'pomodoro-view__stat-label', text: 'Pomodoros completed' });
        
        const streakStat = this.statsDisplay.createDiv({ cls: 'pomodoro-view__stat' });
        this.statElements.streak = streakStat.createSpan({ cls: 'pomodoro-view__stat-value', text: '0' });
        streakStat.createSpan({ cls: 'pomodoro-view__stat-label', text: 'Current streak' });
        
        const minutesStat = this.statsDisplay.createDiv({ cls: 'pomodoro-view__stat' });
        this.statElements.minutes = minutesStat.createSpan({ cls: 'pomodoro-view__stat-value', text: '0' });
        minutesStat.createSpan({ cls: 'pomodoro-view__stat-label', text: 'Minutes focused' });
        
        // Add event listeners
        this.registerDomEvent(this.startButton, 'click', async () => {
            // Prevent double clicks
            if (this.startButton?.hasClass('is-loading')) return;
            this.startButton?.addClass('pomodoro-view__start-button--loading');
            
            try {
                const state = this.plugin.pomodoroService.getState();
                if (state.currentSession && !state.isRunning) {
                    await this.plugin.pomodoroService.resumePomodoro();
                } else {
                    await this.plugin.pomodoroService.startPomodoro(this.currentSelectedTask || undefined);
                }
            } finally {
                this.startButton?.removeClass('pomodoro-view__start-button--loading');
            }
        });
        
        this.registerDomEvent(this.pauseButton, 'click', () => {
            this.plugin.pomodoroService.pausePomodoro();
        });
        
        this.registerDomEvent(this.stopButton, 'click', () => {
            this.plugin.pomodoroService.stopPomodoro();
        });
        
        this.registerDomEvent(workButton, 'click', async () => {
            await this.plugin.pomodoroService.startPomodoro(this.currentSelectedTask || undefined);
        });
        
        this.registerDomEvent(shortBreakButton, 'click', () => {
            this.plugin.pomodoroService.startBreak(false);
        });
        
        this.registerDomEvent(longBreakButton, 'click', () => {
            this.plugin.pomodoroService.startBreak(true);
        });
        
        // Initial display update
        this.updateDisplay();
        this.updateStats().catch(error => {
            console.error('Failed to update initial stats:', error);
        });
        
        // Update initial timer based on current state
        const state = this.plugin.pomodoroService.getState();
        this.updateTimer(state.timeRemaining);
    }
    
    private async openTaskSelector() {
        try {
            // Get tasks for today and the next few days
            const today = new Date();
            const tasks: TaskInfo[] = [];
            
            // Get tasks from today and next 7 days
            for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                
                try {
                    const dayTasks = await this.plugin.cacheManager.getTaskInfoForDate(date);
                    tasks.push(...dayTasks);
                } catch (error) {
                    // Error getting tasks for date
                }
            }
            
            // Remove duplicates
            const uniqueTasks = tasks.filter((task, index, arr) => 
                arr.findIndex(t => t.path === task.path) === index
            );
            
            if (uniqueTasks.length === 0) {
                new Notice('No tasks found. Create some tasks first.');
                return;
            }
            
            // Open task selector modal
            const modal = new TaskSelectorModal(this.app, uniqueTasks, (selectedTask) => {
                this.selectTask(selectedTask);
            });
            
            modal.open();
            
        } catch (error) {
            console.error('Error opening task selector:', error);
            new Notice('Failed to load tasks');
        }
    }
    
    private async selectTask(task: TaskInfo | null) {
        this.currentSelectedTask = task;
        
        // Update button text
        if (this.taskSelectButton) {
            if (task) {
                const displayText = task.title.length > 30 
                    ? task.title.substring(0, 27) + '...' 
                    : task.title;
                this.taskSelectButton.textContent = displayText;
                this.taskSelectButton.title = task.title; // Full title in tooltip
                this.taskSelectButton.removeClass('pomodoro-view__task-select-button--no-task');
            } else {
                this.taskSelectButton.textContent = 'Choose task...';
                this.taskSelectButton.title = '';
                this.taskSelectButton.addClass('pomodoro-view__task-select-button--no-task');
            }
        }
        
        // Save selection for persistence
        await this.plugin.pomodoroService.saveLastSelectedTask(task?.path);
        
        // If there's a current work session, update its task assignment
        const state = this.plugin.pomodoroService.getState();
        if (state.currentSession && state.currentSession.type === 'work') {
            await this.plugin.pomodoroService.assignTaskToCurrentSession(task || undefined);
        }
    }
    
    private async restoreLastSelectedTask() {
        try {
            const lastTaskPath = await this.plugin.pomodoroService.getLastSelectedTaskPath();
            if (lastTaskPath) {
                // Use the optimized getTaskByPath method
                const task = await this.plugin.cacheManager.getTaskByPath(lastTaskPath);
                
                if (task && !this.plugin.statusManager.isCompletedStatus(task.status) && !task.archived) {
                    await this.selectTask(task);
                }
            }
        } catch (error) {
            console.error('Error restoring last selected task:', error);
        }
    }
    
    private async updateTaskButtonFromPath(taskPath: string) {
        try {
            // Use the cache manager as the single source of truth
            const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
            
            if (task) {
                this.currentSelectedTask = task;
                if (this.taskSelectButton) {
                    const displayText = task.title.length > 30 
                        ? task.title.substring(0, 27) + '...' 
                        : task.title;
                    this.taskSelectButton.textContent = displayText;
                    this.taskSelectButton.title = task.title;
                    this.taskSelectButton.removeClass('pomodoro-no-task');
                    this.taskSelectButton.removeClass('pomodoro-view__task-select-button--no-task');
                }
                return;
            }
            
            // Task not found - reset to no task selected
            this.currentSelectedTask = null;
            if (this.taskSelectButton) {
                this.taskSelectButton.textContent = 'Select Task';
                this.taskSelectButton.title = '';
                this.taskSelectButton.addClass('pomodoro-view__task-select-button--no-task');
            }
        } catch (error) {
            console.error('Error updating task button from path:', error);
        }
    }
    
    private updateDisplay(session?: PomodoroSession, task?: TaskInfo) {
        const state = this.plugin.pomodoroService.getState();
        
        // Update timer and progress
        this.updateTimer(state.timeRemaining);
        this.updateProgress(state);
        
        
        // Update status
        if (this.statusDisplay) {
            if (state.isRunning && state.currentSession) {
                const typeText = state.currentSession.type === 'work' ? 'Working' : 
                               state.currentSession.type === 'short-break' ? 'Short break' : 'Long break';
                this.statusDisplay.textContent = typeText;
                this.statusDisplay.className = `pomodoro-status pomodoro-view__status pomodoro-status-${state.currentSession.type} pomodoro-view__status--${state.currentSession.type}`;
            } else if (state.currentSession && !state.isRunning) {
                this.statusDisplay.textContent = 'Paused';
                this.statusDisplay.className = `pomodoro-status pomodoro-view__status pomodoro-status-paused pomodoro-view__status--paused`;
            } else {
                this.statusDisplay.textContent = 'Ready to start';
                this.statusDisplay.className = 'pomodoro-status pomodoro-view__status';
            }
        }
        
        // Update task display only if task info changed
        if (this.taskDisplay) {
            const currentTaskPath = state.currentSession?.taskPath;
            const currentDisplayPath = this.taskDisplay.dataset.currentTaskPath;
            
            if (currentTaskPath !== currentDisplayPath) {
                this.taskDisplay.empty();
                this.taskDisplay.dataset.currentTaskPath = currentTaskPath || '';
                
                if (session?.taskPath && task) {
                    const taskDiv = this.taskDisplay.createDiv({ cls: 'pomodoro-view__current-task' });
                    taskDiv.createSpan({ cls: 'pomodoro-view__task-label', text: 'Working on:' });
                    taskDiv.createSpan({ cls: 'pomodoro-view__task-title', text: task.title });
                } else if (state.currentSession?.taskPath) {
                    // Try to get task info from cache
                    const taskPath = state.currentSession.taskPath;
                    const taskDiv = this.taskDisplay.createDiv({ cls: 'pomodoro-view__current-task' });
                    taskDiv.createSpan({ cls: 'pomodoro-view__task-label', text: 'Working on:' });
                    taskDiv.createSpan({ cls: 'pomodoro-view__task-title', text: taskPath.split('/').pop()?.replace('.md', '') || '' });
                }
            }
        }
        
        // Update task selector button to reflect current session
        if (this.taskSelectButton) {
            if (state.currentSession?.taskPath && !this.currentSelectedTask) {
                // Try to get the task info for display
                this.updateTaskButtonFromPath(state.currentSession.taskPath);
            }
        }
        
        // Update button visibility
        if (this.startButton && this.pauseButton && this.stopButton) {
            if (state.isRunning) {
                this.startButton.addClass('pomodoro-view__start-button--hidden');
                this.pauseButton.removeClass('pomodoro-view__pause-button--hidden');
                this.stopButton.removeClass('pomodoro-view__stop-button--hidden');
            } else if (state.currentSession) {
                // Paused
                this.startButton.removeClass('pomodoro-view__start-button--hidden');
                this.startButton.textContent = 'Resume';
                this.pauseButton.addClass('pomodoro-view__pause-button--hidden');
                this.stopButton.removeClass('pomodoro-view__stop-button--hidden');
            } else {
                // Idle
                this.startButton.removeClass('pomodoro-view__start-button--hidden');
                this.startButton.textContent = 'Start';
                this.pauseButton.addClass('pomodoro-view__pause-button--hidden');
                this.stopButton.addClass('pomodoro-view__stop-button--hidden');
            }
        }
        
        this.updateStats().catch(error => {
            console.error('Failed to update stats:', error);
        });
    }
    
    private updateTimer(seconds: number) {
        if (this.timerDisplay) {
            // Ensure seconds is valid
            const validSeconds = Math.max(0, Math.floor(seconds));
            const minutes = Math.floor(validSeconds / 60);
            const secs = validSeconds % 60;
            this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            // Update timer color based on time remaining
            if (validSeconds <= 60 && validSeconds > 0) {
                this.timerDisplay.addClass('pomodoro-view__timer-display--warning');
            } else {
                this.timerDisplay.removeClass('pomodoro-view__timer-display--warning');
            }
        }
    }
    
    private updateProgress(state: PomodoroState) {
        if (!this.progressCircle || !state.currentSession) {
            // No session active, reset progress
            if (this.progressCircle) {
                const radius = 110;
                const circumference = 2 * Math.PI * radius;
                this.progressCircle.setAttributeNS(null, 'stroke-dashoffset', circumference.toString());
                // Legacy classes already removed during BEM cleanup
                this.progressCircle.removeClass('pomodoro-view__progress-circle--work');
                this.progressCircle.removeClass('pomodoro-view__progress-circle--short-break');
                this.progressCircle.removeClass('pomodoro-view__progress-circle--long-break');
            }
            return;
        }
        
        // Calculate progress
        const totalDuration = state.currentSession.duration * 60; // Convert to seconds
        const elapsed = totalDuration - state.timeRemaining;
        const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
        
        // Calculate stroke-dashoffset
        const radius = 110;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (progress * circumference);
        
        // Update progress circle
        this.progressCircle.setAttributeNS(null, 'stroke-dashoffset', offset.toString());
        
        // Update color based on session type
        this.progressCircle.removeClass('pomodoro-view__progress-circle--work');
        this.progressCircle.removeClass('pomodoro-view__progress-circle--short-break');
        this.progressCircle.removeClass('pomodoro-view__progress-circle--long-break');
        this.progressCircle.addClass(`pomodoro-view__progress-circle--${state.currentSession.type}`);
        
        // Add warning class for last minute
        if (state.timeRemaining <= 60 && state.timeRemaining > 0) {
            this.progressCircle.addClass('pomodoro-view__progress-circle--warning');
        } else {
            this.progressCircle.removeClass('pomodoro-view__progress-circle--warning');
        }
    }
    
    private async updateStats() {
        try {
            // Get reliable stats from session history
            const stats = await this.plugin.pomodoroService.getTodayStats();
            
            // Update only if values changed to avoid unnecessary DOM updates
            if (this.statElements.pomodoros && this.statElements.pomodoros.textContent !== stats.pomodorosCompleted.toString()) {
                this.statElements.pomodoros.textContent = stats.pomodorosCompleted.toString();
            }
            
            if (this.statElements.streak && this.statElements.streak.textContent !== stats.currentStreak.toString()) {
                this.statElements.streak.textContent = stats.currentStreak.toString();
            }
            
            if (this.statElements.minutes && this.statElements.minutes.textContent !== stats.totalMinutes.toString()) {
                this.statElements.minutes.textContent = stats.totalMinutes.toString();
            }
        } catch (error) {
            console.error('Failed to update stats:', error);
            // Fallback to show zeros if stats loading fails
            if (this.statElements.pomodoros) this.statElements.pomodoros.textContent = '0';
            if (this.statElements.streak) this.statElements.streak.textContent = '0';
            if (this.statElements.minutes) this.statElements.minutes.textContent = '0';
        }
    }
    
    private onPomodoroComplete(session: PomodoroSession, nextType: string) {
        this.updateDisplay();
        
        // Show completion message
        if (this.statusDisplay) {
            if (session.type === 'work') {
                const isLongBreak = nextType === 'long-break';
                this.statusDisplay.textContent = `Great work! Time for a ${isLongBreak ? 'long' : 'short'} break`;
            } else {
                this.statusDisplay.textContent = 'Break complete! Ready for the next pomodoro?';
            }
        }
    }
}
