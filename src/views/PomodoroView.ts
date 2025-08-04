import { ItemView, WorkspaceLeaf, Notice, EventRef, setTooltip } from 'obsidian';
import TaskNotesPlugin from '../main';
import { 
    POMODORO_VIEW_TYPE,
    EVENT_POMODORO_START,
    EVENT_POMODORO_COMPLETE,
    EVENT_POMODORO_INTERRUPT,
    EVENT_POMODORO_TICK,
    EVENT_TASK_UPDATED,
    PomodoroSession,
    PomodoroState,
    TaskInfo
} from '../types';
import { TaskSelectorModal } from '../modals/TaskSelectorModal';
import { createTaskCard } from '../ui/TaskCard';

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
    private taskClearButton: HTMLButtonElement | null = null;
    private currentSelectedTask: TaskInfo | null = null;
    private taskCardContainer: HTMLElement | null = null;
    private addTimeButton: HTMLButtonElement | null = null;
    private subtractTimeButton: HTMLButtonElement | null = null;
    private skipBreakButton: HTMLButtonElement | null = null;
    
    // Cache stat elements to avoid innerHTML
    private statElements: {
        pomodoros: HTMLElement | null;
    } = { pomodoros: null };
    
    // Resize handling
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: number | null = null;
    private functionListeners: (() => void)[] = [];
    private currentCircleSize: number = 300;
    private currentCircumference: number = 0;
    
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
        
        // Listen for task updates to refresh the selected task card
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async ({ path, originalTask, updatedTask }) => {
            if (!path || !updatedTask) return;
            
            // Check if this is the currently selected task in pomodoro view
            // We need to check both the new path and the original path in case of filename changes
            const isCurrentSelectedTask = this.currentSelectedTask && 
                (this.currentSelectedTask.path === path || 
                 (originalTask && this.currentSelectedTask.path === originalTask.path));
            
            if (isCurrentSelectedTask) {
                // Update the selected task and refresh the task card
                this.currentSelectedTask = updatedTask;
                this.updateTaskCardDisplay(updatedTask);
                
                // If there's a current pomodoro session and this task's path changed,
                // update the session's task path to the new path
                const state = this.plugin.pomodoroService.getState();
                if (state.currentSession && originalTask && 
                    originalTask.path !== updatedTask.path && 
                    state.currentSession.taskPath === originalTask.path) {
                    await this.plugin.pomodoroService.assignTaskToCurrentSession(updatedTask);
                }
            }
        });
        this.listeners.push(taskUpdateListener);
    }
    
    async onOpen() {
        // Wait for the plugin to be fully initialized before proceeding
        await this.plugin.onReady();
        await this.render();
        
        // Robust setup for cases where view was already open during reload
        this.ensureResizeHandlingSetup();
        
        // Also listen for workspace ready event as an additional safeguard
        if (this.plugin.app.workspace.layoutReady) {
            // Workspace is already ready
            setTimeout(() => this.ensureResizeHandlingSetup(), 50);
        } else {
            // Wait for workspace to be ready
            this.plugin.app.workspace.onLayoutReady(() => {
                this.ensureResizeHandlingSetup();
            });
        }
    }
    
    async onClose() {
        // Clean up resize handling
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        if (this.resizeTimeout) {
            window.clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        
        // Remove event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        
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
        this.taskClearButton = null;
        this.currentSelectedTask = null;
        this.taskCardContainer = null;
        this.statElements = { pomodoros: null };
        
        this.contentEl.empty();
    }
    
    async render() {
        const container = this.contentEl.createDiv({ cls: 'tasknotes-plugin pomodoro-view' });
        
        // Status display at the top
        this.statusDisplay = container.createDiv({ cls: 'pomodoro-view__status', text: 'Focus' });
        
        // Timer display with progress circle
        const timerSection = container.createDiv({ cls: 'pomodoro-view__timer-section' });
        
        // Create progress circle container
        this.progressContainer = timerSection.createDiv({ cls: 'pomodoro-view__progress-container' });
        
        // Create SVG progress circle
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'pomodoro-view__progress-svg');
        svg.setAttribute('width', '300');
        svg.setAttribute('height', '300');
        svg.setAttribute('viewBox', '0 0 300 300');
        this.progressContainer.appendChild(svg);
        
        // Background circle
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttributeNS(null, 'cx', '150');
        bgCircle.setAttributeNS(null, 'cy', '150');
        bgCircle.setAttributeNS(null, 'r', '140');
        bgCircle.setAttributeNS(null, 'fill', 'none');
        bgCircle.setAttributeNS(null, 'stroke', 'var(--tn-border-color)');
        bgCircle.setAttributeNS(null, 'stroke-width', '2');
        svg.appendChild(bgCircle);
        
        // Progress circle
        this.progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle') as SVGCircleElement;
        this.progressCircle.setAttributeNS(null, 'cx', '150');
        this.progressCircle.setAttributeNS(null, 'cy', '150');
        this.progressCircle.setAttributeNS(null, 'r', '140');
        this.progressCircle.setAttributeNS(null, 'fill', 'none');
        this.progressCircle.setAttributeNS(null, 'stroke', 'var(--tn-interactive-accent)');
        this.progressCircle.setAttributeNS(null, 'stroke-width', '4');
        this.progressCircle.setAttributeNS(null, 'stroke-linecap', 'round');
        
        // Calculate circumference: 2 * π * radius
        const radius = 140;
        const circumference = 2 * Math.PI * radius;
        
        this.progressCircle.setAttributeNS(null, 'stroke-dasharray', circumference.toString());
        this.progressCircle.setAttributeNS(null, 'stroke-dashoffset', circumference.toString());
        this.progressCircle.addClass('pomodoro-view__progress-circle');
        svg.appendChild(this.progressCircle);
        
        // Timer display overlay
        const timerOverlay = this.progressContainer.createDiv({ cls: 'pomodoro-view__timer-overlay' });
        
        // Timer display
        const defaultDuration = this.plugin.settings.pomodoroWorkDuration;
        const defaultTime = `${defaultDuration.toString().padStart(2, '0')}:00`;
        this.timerDisplay = timerOverlay.createDiv({ cls: 'pomodoro-view__timer-display', text: defaultTime });
        
        // Time adjustment controls
        const timeControls = timerOverlay.createDiv({ cls: 'pomodoro-view__time-controls' });
        
        this.subtractTimeButton = timeControls.createEl('button', {
            cls: 'pomodoro-view__time-adjust-button pomodoro-view__subtract-time',
            text: '-'
        });
        // Don't hide initially since we want them always visible
        
        this.addTimeButton = timeControls.createEl('button', {
            cls: 'pomodoro-view__time-adjust-button pomodoro-view__add-time',
            text: '+'
        });
        // Don't hide initially since we want them always visible
        
        // Task display (minimal)
        this.taskDisplay = container.createDiv({ cls: 'pomodoro-view__task-display' });
        
        // Task selector section
        const taskSelectorSection = container.createDiv({ cls: 'pomodoro-view__task-selector' });
        
        // Task selector buttons container
        const taskButtonsContainer = taskSelectorSection.createDiv({ cls: 'pomodoro-view__task-buttons' });
        
        this.taskSelectButton = taskButtonsContainer.createEl('button', { 
            cls: 'pomodoro-view__task-select-button',
            text: 'Choose task...'
        });
        
        this.taskClearButton = taskButtonsContainer.createEl('button', {
            cls: 'pomodoro-view__task-clear-button pomodoro-view__task-clear-button--hidden',
            text: 'Clear task'
        });
        
        // Task card container
        this.taskCardContainer = taskSelectorSection.createDiv({ cls: 'pomodoro-view__task-card-container' });
        
        // Main control section - simplified
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
        
        // Skip break button (only shown after sessions)
        this.skipBreakButton = controlSection.createEl('button', {
            cls: 'pomodoro-view__skip-break-button',
            text: 'Skip break'
        });
        this.skipBreakButton.addClass('pomodoro-view__skip-break-button--hidden');
        
        // Minimal stats at the bottom
        const statsSection = container.createDiv({ cls: 'pomodoro-view__stats-section' });
        
        this.statsDisplay = statsSection.createDiv({ cls: 'pomodoro-view__stats' });
        
        // Create minimal stat elements
        const pomodoroStat = this.statsDisplay.createDiv({ cls: 'pomodoro-view__stat pomodoro-view__stat--clickable' });
        this.statElements.pomodoros = pomodoroStat.createSpan({ cls: 'pomodoro-view__stat-value', text: '0' });
        pomodoroStat.createSpan({ cls: 'pomodoro-view__stat-label', text: 'completed today' });
        
        // Make the stat clickable to open stats view
        this.registerDomEvent(pomodoroStat, 'click', () => {
            this.plugin.activatePomodoroStatsView();
        });
        
        // Add event listeners
        this.registerDomEvent(this.startButton, 'click', async () => {
            if (this.startButton?.hasClass('is-loading')) return;
            this.startButton?.addClass('pomodoro-view__start-button--loading');
            
            try {
                const state = this.plugin.pomodoroService.getState();
                if (state.currentSession && !state.isRunning) {
                    await this.plugin.pomodoroService.resumePomodoro();
                } else {
                    // No active session - start the type indicated by nextSessionType
                    if (state.nextSessionType === 'short-break') {
                        await this.plugin.pomodoroService.startBreak(false);
                    } else if (state.nextSessionType === 'long-break') {
                        await this.plugin.pomodoroService.startBreak(true);
                    } else {
                        // Default to work session
                        await this.plugin.pomodoroService.startPomodoro(this.currentSelectedTask || undefined);
                    }
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
        
        this.registerDomEvent(this.skipBreakButton, 'click', () => {
            const state = this.plugin.pomodoroService.getState();
            if (state.currentSession) {
                // Currently in a break session, stop it
                this.plugin.pomodoroService.stopPomodoro();
            } else if (state.nextSessionType === 'short-break' || state.nextSessionType === 'long-break') {
                // Break is prepared but user wants to skip, clear the break and prepare work
                this.plugin.pomodoroService.startPomodoro(this.currentSelectedTask || undefined);
            }
        });
        
        this.registerDomEvent(this.addTimeButton, 'click', () => {
            this.adjustSessionTime(60);
        });
        
        this.registerDomEvent(this.subtractTimeButton, 'click', () => {
            this.adjustSessionTime(-60);
        });
        
        this.registerDomEvent(this.taskSelectButton, 'click', async () => {
            await this.openTaskSelector();
        });
        
        this.registerDomEvent(this.taskClearButton, 'click', async () => {
            await this.selectTask(null);
        });
        
        // Load and restore last selected task
        this.restoreLastSelectedTask();
        
        // Initial display update
        this.updateDisplay();
        this.updateStats().catch(error => {
            console.error('Failed to update initial stats:', error);
        });
        
        // Update initial timer based on current state
        if (this.plugin.pomodoroService) {
            const state = this.plugin.pomodoroService.getState();
            this.updateTimer(state.timeRemaining);
        }
    }
    
    private setupResizeHandling(): void {
        // Clean up previous resize handling
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.resizeTimeout) {
            window.clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        // Clean up previous listeners
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];
        
        // Use the correct window reference (supports popout windows)
        const win = this.contentEl.ownerDocument.defaultView || window;
        
        // Debounced resize handler
        const debouncedResize = () => {
            if (this.resizeTimeout) {
                win.clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = win.setTimeout(() => {
                this.updateResponsiveLayout();
            }, 150);
        };
        
        // Use ResizeObserver to detect container size changes
        if (win.ResizeObserver) {
            this.resizeObserver = new win.ResizeObserver(debouncedResize);
            const pomodoroContainer = this.contentEl.querySelector('.pomodoro-view');
            if (pomodoroContainer) {
                this.resizeObserver.observe(pomodoroContainer);
            }
        }
        
        // Listen for workspace layout changes (Obsidian-specific)
        const layoutChangeListener = this.plugin.app.workspace.on('layout-change', debouncedResize);
        this.listeners.push(layoutChangeListener);
        
        // Listen for window resize as fallback
        win.addEventListener('resize', debouncedResize);
        this.functionListeners.push(() => win.removeEventListener('resize', debouncedResize));
        
        // Listen for active leaf changes that might affect layout
        const activeLeafListener = this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
            if (leaf === this.leaf) {
                // Small delay to ensure layout has settled after leaf activation
                win.setTimeout(() => {
                    this.updateResponsiveLayout();
                }, 100);
            }
        });
        this.listeners.push(activeLeafListener);
        
        // Set initial responsive state
        this.updateResponsiveLayout();
    }
    
    private ensureResizeHandlingSetup(attempt: number = 0): void {
        const maxAttempts = 10;
        const delay = Math.min(100 * Math.pow(1.5, attempt), 1000); // Exponential backoff, max 1s
        
        setTimeout(() => {
            // Check if we need to set up resize handling
            if (!this.resizeObserver) {
                const pomodoroContainer = this.contentEl.querySelector('.pomodoro-view') as HTMLElement;
                if (pomodoroContainer) {
                    const width = pomodoroContainer.getBoundingClientRect().width;
                    
                    // Check if container has proper dimensions (not zero width)
                    if (width > 0) {
                        // DOM is ready with proper dimensions, set up resize handling
                        this.setupResizeHandling();
                    } else if (attempt < maxAttempts) {
                        // Container exists but no dimensions yet, try again
                        this.ensureResizeHandlingSetup(attempt + 1);
                    }
                } else if (attempt < maxAttempts) {
                    // DOM not ready yet, try again
                    this.ensureResizeHandlingSetup(attempt + 1);
                }
            }
        }, delay);
    }
    
    private updateResponsiveLayout(): void {
        const pomodoroContainer = this.contentEl.querySelector('.pomodoro-view') as HTMLElement;
        if (!pomodoroContainer) return;
        
        const containerWidth = pomodoroContainer.getBoundingClientRect().width;
        
        // Define breakpoints
        const isVeryNarrow = containerWidth <= 300;  // Very small panes
        const isNarrow = containerWidth <= 400;      // Small panes
        const isMedium = containerWidth <= 600;      // Medium panes
        
        // Remove all responsive classes first
        pomodoroContainer.classList.remove(
            'pomodoro-view--very-narrow',
            'pomodoro-view--narrow', 
            'pomodoro-view--medium'
        );
        
        // Apply appropriate responsive class
        if (isVeryNarrow) {
            pomodoroContainer.classList.add('pomodoro-view--very-narrow');
        } else if (isNarrow) {
            pomodoroContainer.classList.add('pomodoro-view--narrow');
        } else if (isMedium) {
            pomodoroContainer.classList.add('pomodoro-view--medium');
        }
        
        // Update progress circle size and timer font size based on available space
        this.updateProgressCircleSize(containerWidth);
        this.updateTimerFontSize(containerWidth);
    }
    
    private updateProgressCircleSize(containerWidth: number): void {
        if (!this.progressContainer) return;
        
        const svg = this.progressContainer.querySelector('.pomodoro-view__progress-svg') as SVGElement;
        if (!svg) return;
        
        // Calculate optimal size based on container width
        let size: number;
        if (containerWidth <= 300) {
            size = Math.max(200, containerWidth - 80); // Very narrow: smaller circle with margins
        } else if (containerWidth <= 400) {
            size = Math.max(250, containerWidth - 100); // Narrow: medium circle
        } else if (containerWidth <= 600) {
            size = 300; // Medium: standard size
        } else {
            size = 300; // Wide: standard size
        }
        
        // Only update if size has changed to prevent unnecessary DOM manipulation
        if (size === this.currentCircleSize) {
            return;
        }
        
        this.currentCircleSize = size;
        
        // Update SVG and container dimensions
        svg.setAttribute('width', size.toString());
        svg.setAttribute('height', size.toString());
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        
        this.progressContainer.style.width = `${size}px`;
        this.progressContainer.style.height = `${size}px`;
        
        // Update circle positions and radius
        const center = size / 2;
        const radius = center - 20; // Leave some margin for stroke
        
        const circles = svg.querySelectorAll('circle');
        circles.forEach(circle => {
            circle.setAttribute('cx', center.toString());
            circle.setAttribute('cy', center.toString());
            circle.setAttribute('r', radius.toString());
        });
        
        // Update stroke-dasharray for progress circle and store the new circumference
        if (this.progressCircle) {
            const circumference = 2 * Math.PI * radius;
            this.currentCircumference = circumference;
            this.progressCircle.setAttribute('stroke-dasharray', circumference.toString());
            // Reset stroke-dashoffset to full circumference (no progress)
            this.progressCircle.setAttribute('stroke-dashoffset', circumference.toString());
            
            // Re-apply current progress with new circumference
            if (this.plugin.pomodoroService) {
                const state = this.plugin.pomodoroService.getState();
                this.updateProgress(state);
            }
        }
    }
    
    private updateTimerFontSize(containerWidth: number): void {
        if (!this.timerDisplay) return;
        
        // Calculate font size based on container width and circle size
        let fontSize: string;
        if (containerWidth <= 300) {
            fontSize = '2.5rem'; // Very narrow: smaller font
        } else if (containerWidth <= 400) {
            fontSize = '3rem'; // Narrow: medium font  
        } else if (containerWidth <= 600) {
            fontSize = '3.5rem'; // Medium: larger font
        } else {
            fontSize = '4rem'; // Wide: full size font
        }
        
        // Apply the font size directly to the timer display
        this.timerDisplay.style.fontSize = fontSize;
        
        // Also update font weight for better readability at smaller sizes
        if (containerWidth <= 300) {
            this.timerDisplay.style.fontWeight = '600';
        } else {
            this.timerDisplay.style.fontWeight = '500';
        }
    }
    
    private async openTaskSelector() {
        try {
            const allTasks = await this.plugin.cacheManager.getAllTasks();
            const unarchivedTasks = allTasks.filter(task => !task.archived);

            if (unarchivedTasks.length === 0) {
                new Notice('No unarchived tasks found. Create some tasks first.');
                return;
            }

            // Open task selector modal
            const modal = new TaskSelectorModal(this.app, this.plugin, unarchivedTasks, (selectedTask) => {
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
        
        // Update button text - keep it simple since we have the task card
        if (this.taskSelectButton) {
            if (task) {
                this.taskSelectButton.textContent = 'Change task...';
                setTooltip(this.taskSelectButton, 'Select a different task', { placement: 'top' });
                this.taskSelectButton.removeClass('pomodoro-view__task-select-button--no-task');
            } else {
                this.taskSelectButton.textContent = 'Choose task...';
                // Remove tooltip for no-task state
                this.taskSelectButton.removeAttribute('title');
                this.taskSelectButton.addClass('pomodoro-view__task-select-button--no-task');
            }
        }
        
        // Update clear button visibility
        if (this.taskClearButton) {
            if (task) {
                this.taskClearButton.removeClass('pomodoro-view__task-clear-button--hidden');
            } else {
                this.taskClearButton.addClass('pomodoro-view__task-clear-button--hidden');
            }
        }
        
        // Update task card display
        this.updateTaskCardDisplay(task);
        
        // Save selection for persistence
        await this.plugin.pomodoroService.saveLastSelectedTask(task?.path);
        
        // If there's a current work session, update its task assignment
        const state = this.plugin.pomodoroService.getState();
        if (state.currentSession && state.currentSession.type === 'work') {
            await this.plugin.pomodoroService.assignTaskToCurrentSession(task || undefined);
        }
    }
    
    private updateTaskCardDisplay(task: TaskInfo | null) {
        if (!this.taskCardContainer) return;
        
        // Clear existing content
        this.taskCardContainer.empty();
        
        if (task) {
            // Create a task card with appropriate options for pomodoro view
            const taskCard = createTaskCard(task, this.plugin, {
                showDueDate: true,
                showCheckbox: false,
                showArchiveButton: false,
                showTimeTracking: true,
                showRecurringControls: false,
                groupByDate: false
            });
            
            // Add the task card to the container
            this.taskCardContainer.appendChild(taskCard);
            this.taskCardContainer.removeClass('pomodoro-view__task-card-container--empty');
        } else {
            this.taskCardContainer.addClass('pomodoro-view__task-card-container--empty');
        }
    }
    
    private async restoreLastSelectedTask() {
        try {
            // Check if pomodoroService is available
            if (!this.plugin.pomodoroService) {
                console.log('PomodoroView: pomodoroService not available, skipping restore');
                return;
            }
            
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
            // Don't let this error stop the render process
        }
    }
    
    private async updateTaskButtonFromPath(taskPath: string) {
        try {
            // Use the cache manager as the single source of truth
            const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
            
            if (task) {
                this.currentSelectedTask = task;
                if (this.taskSelectButton) {
                    this.taskSelectButton.textContent = 'Change task...';
                    setTooltip(this.taskSelectButton, 'Select a different task', { placement: 'top' });
                    this.taskSelectButton.removeClass('pomodoro-no-task');
                    this.taskSelectButton.removeClass('pomodoro-view__task-select-button--no-task');
                }
                
                // Update clear button and task card display
                if (this.taskClearButton) {
                    this.taskClearButton.removeClass('pomodoro-view__task-clear-button--hidden');
                }
                this.updateTaskCardDisplay(task);
                return;
            }
            
            // Task not found - reset to no task selected
            this.currentSelectedTask = null;
            if (this.taskSelectButton) {
                this.taskSelectButton.textContent = 'Choose task...';
                // Remove tooltip for no-task state
                this.taskSelectButton.removeAttribute('title');
                this.taskSelectButton.addClass('pomodoro-view__task-select-button--no-task');
            }
            if (this.taskClearButton) {
                this.taskClearButton.addClass('pomodoro-view__task-clear-button--hidden');
            }
            this.updateTaskCardDisplay(null);
        } catch (error) {
            console.error('Error updating task button from path:', error);
        }
    }
    
    private updateDisplay(session?: PomodoroSession, task?: TaskInfo) {
        // Check if pomodoroService is available
        if (!this.plugin.pomodoroService) {
            // Set default UI state when service is not available
            if (this.statusDisplay) {
                this.statusDisplay.textContent = 'Ready to start';
                this.statusDisplay.className = 'pomodoro-status pomodoro-view__status';
            }
            return;
        }
        
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
                
                // We now show task info in the task card instead of here
                // Keep this section minimal or remove content entirely since we have the task card
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
                // Idle - no active session
                this.startButton.removeClass('pomodoro-view__start-button--hidden');
                
                // Set button text based on next session type
                if (state.nextSessionType === 'short-break') {
                    this.startButton.textContent = 'Start Short Break';
                } else if (state.nextSessionType === 'long-break') {
                    this.startButton.textContent = 'Start Long Break';
                } else {
                    this.startButton.textContent = 'Start';
                }
                
                this.pauseButton.addClass('pomodoro-view__pause-button--hidden');
                this.stopButton.addClass('pomodoro-view__stop-button--hidden');
            }
        }
        
        // Update skip break button visibility
        if (this.skipBreakButton) {
            // Show skip break button when:
            // 1. There's an active break session, OR
            // 2. A break is prepared to start (nextSessionType is a break)
            const isActiveBreak = state.currentSession && (state.currentSession.type === 'short-break' || state.currentSession.type === 'long-break');
            const isBreakPrepared = !state.currentSession && (state.nextSessionType === 'short-break' || state.nextSessionType === 'long-break');
            
            if (isActiveBreak || isBreakPrepared) {
                this.skipBreakButton.removeClass('pomodoro-view__skip-break-button--hidden');
                this.skipBreakButton.textContent = 'Skip break';
            } else {
                this.skipBreakButton.addClass('pomodoro-view__skip-break-button--hidden');
            }
        }
        
        // Update time adjustment button visibility - always show them
        if (this.addTimeButton && this.subtractTimeButton) {
            this.addTimeButton.removeClass('pomodoro-view__time-adjust-button--hidden');
            this.subtractTimeButton.removeClass('pomodoro-view__time-adjust-button--hidden');
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
        if (!this.progressCircle) return;
        
        // Use current circumference if available, otherwise calculate from current attributes
        let circumference = this.currentCircumference;
        if (circumference === 0) {
            // Fallback: get current radius from the progress circle
            const radiusAttr = this.progressCircle.getAttribute('r');
            const radius = radiusAttr ? parseInt(radiusAttr) : 140;
            circumference = 2 * Math.PI * radius;
            this.currentCircumference = circumference;
        }
        
        if (!state.currentSession) {
            // No session active - show full circle (ready to start)
            this.progressCircle.setAttributeNS(null, 'stroke-dashoffset', circumference.toString());
            this.progressCircle.removeClass('pomodoro-view__progress-circle--work');
            this.progressCircle.removeClass('pomodoro-view__progress-circle--short-break');
            this.progressCircle.removeClass('pomodoro-view__progress-circle--long-break');
            this.progressCircle.removeClass('pomodoro-view__progress-circle--warning');
            return;
        }
        
        // Calculate progress based on actual active time (accounting for pauses)
        const activePeriods = state.currentSession.activePeriods || [];
        let totalActiveSeconds = 0;
        
        // Sum up all completed active periods
        for (const period of activePeriods) {
            if (period.endTime) {
                // Completed period
                const start = new Date(period.startTime).getTime();
                const end = new Date(period.endTime).getTime();
                totalActiveSeconds += Math.floor((end - start) / 1000);
            } else if (state.isRunning) {
                // Current running period
                const start = new Date(period.startTime).getTime();
                const now = Date.now();
                totalActiveSeconds += Math.floor((now - start) / 1000);
            }
        }
        
        // Use current planned duration (which gets updated when user adjusts time)
        const totalDuration = state.currentSession.plannedDuration * 60;
        
        // FIX: Add guard for division by zero
        const progress = totalDuration > 0
            ? Math.max(0, Math.min(1, totalActiveSeconds / totalDuration))
            : 0;
        
        // Calculate stroke-dashoffset (progress goes clockwise)
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
            if (!this.plugin.pomodoroService) {
                // Set default stats when service is not available
                if (this.statElements.pomodoros) {
                    this.statElements.pomodoros.textContent = '0';
                }
                return;
            }
            
            // Get reliable stats from session history
            const stats = await this.plugin.pomodoroService.getTodayStats();
            
            // Update only if values changed to avoid unnecessary DOM updates
            if (this.statElements.pomodoros && this.statElements.pomodoros.textContent !== stats.pomodorosCompleted.toString()) {
                this.statElements.pomodoros.textContent = stats.pomodorosCompleted.toString();
            }
            
        } catch (error) {
            console.error('Failed to update stats:', error);
            // Fallback to show zeros if stats loading fails
            if (this.statElements.pomodoros) this.statElements.pomodoros.textContent = '0';
        }
    }
    
    private adjustSessionTime(seconds: number) {
        if (!this.plugin.pomodoroService) {
            return;
        }
        
        const state = this.plugin.pomodoroService.getState();
        
        if (state.currentSession) {
            // Session exists (running or paused), pass the adjustment amount directly
            this.plugin.pomodoroService.adjustSessionTime(seconds);
        } else {
            // No session (ready to start), adjust the prepared timer with absolute value
            const newTime = Math.max(60, state.timeRemaining + seconds); // Minimum 1 minute
            this.plugin.pomodoroService.adjustPreparedTimer(newTime);
        }
        
        // Force an immediate update to ensure UI reflects changes
        if (this.plugin.pomodoroService) {
            const updatedState = this.plugin.pomodoroService.getState();
            this.updateTimer(updatedState.timeRemaining);
            this.updateProgress(updatedState);
        }
    }
    
    private onPomodoroComplete(session: PomodoroSession, nextType: string) {
        this.updateDisplay();
        
        // Show completion message and skip break option
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
