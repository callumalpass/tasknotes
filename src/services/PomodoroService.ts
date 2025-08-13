import { Notice } from 'obsidian';
import TaskNotesPlugin from '../main';
import { 
    createDailyNote, 
    getDailyNote, 
    getAllDailyNotes,
    appHasDailyNotesPluginLoaded
} from 'obsidian-daily-notes-interface';
import { 
    PomodoroSession, 
    PomodoroState,
    PomodoroSessionHistory,
    PomodoroHistoryStats,
    EVENT_POMODORO_START, 
    EVENT_POMODORO_COMPLETE, 
    EVENT_POMODORO_INTERRUPT, 
    EVENT_POMODORO_TICK,
    TaskInfo,
    IWebhookNotifier
} from '../types';
import { getCurrentTimestamp, formatDateForStorage, getTodayLocal, parseDateToLocal } from '../utils/dateUtils';
import { getSessionDuration, timerWorker } from '../utils/pomodoroUtils';

export class PomodoroService {
    private plugin: TaskNotesPlugin;
    private timerWorker: Worker | null = null;
    private state: PomodoroState;
    private activeAudioContexts: Set<AudioContext> = new Set();
    private cleanupTimeouts: Set<number> = new Set();
    private webhookNotifier?: IWebhookNotifier;

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
        this.state = {
            isRunning: false,
            timeRemaining: plugin.settings.pomodoroWorkDuration * 60 // Default work duration in seconds
        };
    }

    async initialize() {
        await this.loadState();
        this.setupWorker();
        
        if (this.state.isRunning && this.state.currentSession) {
            this.resumeTimer();
        }
    }

    /**
     * Set webhook notifier for triggering webhook events
     */
    setWebhookNotifier(notifier: IWebhookNotifier): void {
        this.webhookNotifier = notifier;
    }

    private setupWorker() {
        const blob = new Blob([timerWorker], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.timerWorker = new Worker(workerUrl);

        this.timerWorker.onmessage = (e) => {
            if (e.data.type === 'done') {
                this.completePomodoro();
            }

            if (e.data.type === 'tick') {
              this.state.timeRemaining = e.data.timeRemaining;

              this.plugin.emitter.trigger(EVENT_POMODORO_TICK, { 
                  timeRemaining: this.state.timeRemaining,
                  session: this.state.currentSession 
              });
            }
        };
    }

    async loadState() {
        try {
            const data = await this.plugin.loadData();
            
            if (data?.pomodoroState) {
                this.state = data.pomodoroState;
                
                // Validate loaded state
                this.state.timeRemaining = Math.max(0, this.state.timeRemaining || 0);
                
                // Clear any stale session from previous day
                const today = formatDateForStorage(getTodayLocal());
                const lastDate = data.lastPomodoroDate;
                if (lastDate !== today) {
                    if (this.state.currentSession) {
                        this.state.currentSession = undefined;
                        this.state.isRunning = false;
                    }
                }
                
                // Validate current session
                if (this.state.currentSession) {
                    // Check if session is stale (older than 24 hours)
                    const sessionStart = new Date(this.state.currentSession.startTime).getTime();
                    const now = Date.now();
                    const hoursSinceStart = (now - sessionStart) / (1000 * 60 * 60);
                    
                    if (hoursSinceStart > 24) {
                        // Session is too old, clear it
                        this.state.currentSession = undefined;
                        this.state.isRunning = false;
                        this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
                    }
                }
                
                // If no active session, reset timer to default duration
                if (!this.state.currentSession) {
                    this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
                }
            }
        } catch (error) {
            console.error('Failed to load pomodoro state:', error);
            // Reset to clean state on error
            this.state = {
                isRunning: false,
                timeRemaining: this.plugin.settings.pomodoroWorkDuration * 60
            };
        }
    }

    async saveState() {
        try {
            const data = await this.plugin.loadData() || {};
            data.pomodoroState = this.state;
            data.lastPomodoroDate = formatDateForStorage(getTodayLocal());
            await this.plugin.saveData(data);
        } catch (error) {
            console.error('Failed to save pomodoro state:', error);
        }
    }

    async saveLastSelectedTask(taskPath: string | undefined) {
        try {
            const data = await this.plugin.loadData() || {};
            data.lastSelectedTaskPath = taskPath;
            await this.plugin.saveData(data);
        } catch (error) {
            console.error('Failed to save last selected task:', error);
        }
    }

    async getLastSelectedTaskPath(): Promise<string | undefined> {
        try {
            const data = await this.plugin.loadData();
            return data?.lastSelectedTaskPath;
        } catch (error) {
            console.error('Failed to load last selected task:', error);
            return undefined;
        }
    }

    async startPomodoro(task?: TaskInfo) {
        if (this.state.isRunning) {
            new Notice('A pomodoro is already running');
            return;
        }
        
        // Check if there's a paused session that should be resumed instead
        if (this.state.currentSession && !this.state.isRunning) {
            new Notice('Resume the current session instead of starting a new one');
            return;
        }
        
        // Validate duration settings (in seconds) max 2 hours
        const durationSeconds = Math.max(1, Math.min(120*60, this.state.timeRemaining));

        // Convert to minutes for planned duration
        const plannedDurationMinutes = durationSeconds / 60;

        console.log("Starting pomodoro with planned duration:", plannedDurationMinutes, "minutes");

        const sessionStartTime = getCurrentTimestamp();

        const session: PomodoroSession = {
            id: Date.now().toString(),
            taskPath: task?.path,
            startTime: sessionStartTime,
            plannedDuration: plannedDurationMinutes,
            type: 'work',
            completed: false,
            activePeriods: [{
                startTime: sessionStartTime
                // endTime will be set when paused or completed
            }]
        };
        
        this.state.currentSession = session;
        this.state.isRunning = true;
        this.state.timeRemaining = durationSeconds;
        
        // Clear next session type since we're starting a session
        this.state.nextSessionType = undefined;

        // Save state before starting the timer
        await this.saveState();

        this.startTimer();
        
        // Start time tracking on the task if applicable
        if (task) {
            try {
                await this.plugin.taskService.startTimeTracking(task);
            } catch (error) {
                // If time tracking is already active, that's fine for Pomodoro
                if (!error.message?.includes('Time tracking is already active')) {
                    console.error('Failed to start time tracking for Pomodoro:', error);
                }
            }
        }
        
        // Notify the user and trigger event
        this.plugin.emitter.trigger(EVENT_POMODORO_START, { session, task });
        
        // Trigger webhook for pomodoro start
        if (this.webhookNotifier) {
            try {
                await this.webhookNotifier.triggerWebhook('pomodoro.started', { session, task });
            } catch (error) {
                console.warn('Failed to trigger webhook for pomodoro start:', error);
            }
        }
        
        new Notification(`Pomodoro started${task ? ` for: ${task.title}` : ''}`);
    }

    async startBreak(isLongBreak = false) {
        if (this.state.isRunning) {
            new Notice('A timer is already running');
            return;
        }
        
        // Check if there's a paused session
        if (this.state.currentSession && !this.state.isRunning) {
            new Notice('Resume the current session instead of starting a new one');
            return;
        }

        // Validate duration settings
        const duration = isLongBreak 
            ? Math.max(1, Math.min(60, this.plugin.settings.pomodoroLongBreakDuration))
            : Math.max(1, Math.min(30, this.plugin.settings.pomodoroShortBreakDuration));

        const sessionStartTime = getCurrentTimestamp();
        const session: PomodoroSession = {
            id: Date.now().toString(),
            startTime: sessionStartTime,
            plannedDuration: duration,
            type: isLongBreak ? 'long-break' : 'short-break',
            completed: false,
            activePeriods: [{
                startTime: sessionStartTime
                // endTime will be set when paused or completed
            }]
        };

        this.state.currentSession = session;
        this.state.isRunning = true;
        this.state.timeRemaining = session.plannedDuration * 60;
        this.state.nextSessionType = undefined; // Clear next session type since we're starting a session

        await this.saveState();
        this.startTimer();
        
        new Notice(`${isLongBreak ? 'Long' : 'Short'} break started`);
    }

    async pausePomodoro() {
        if (!this.state.isRunning) {
            return;
        }

        this.stopTimer();
        this.state.isRunning = false;
        
        // End the current active period
        if (this.state.currentSession && this.state.currentSession.activePeriods.length > 0) {
            const currentPeriod = this.state.currentSession.activePeriods[this.state.currentSession.activePeriods.length - 1];
            if (!currentPeriod.endTime) {
                currentPeriod.endTime = getCurrentTimestamp();
            }
        }
        
        // Stop time tracking on the task if applicable
        if (this.state.currentSession && this.state.currentSession.taskPath) {
            try {
                const task = await this.plugin.cacheManager.getTaskInfo(this.state.currentSession.taskPath);
                if (task) {
                    await this.plugin.taskService.stopTimeTracking(task);
                }
            } catch (error) {
                console.error('Failed to stop time tracking for Pomodoro pause:', error);
            }
        }
        
        await this.saveState();
        
        // Emit event to update UI
        this.plugin.emitter.trigger(EVENT_POMODORO_TICK, { 
            timeRemaining: this.state.timeRemaining,
            session: this.state.currentSession 
        });
        
        new Notice('Pomodoro paused');
    }

    async resumePomodoro() {
        if (this.state.isRunning || !this.state.currentSession) {
            return;
        }

        this.state.isRunning = true;
        
        // Start a new active period
        if (this.state.currentSession) {
            this.state.currentSession.activePeriods.push({
                startTime: getCurrentTimestamp()
                // endTime will be set when paused or completed
            });
        }
        
        await this.saveState();
        this.startTimer();
        
        // Start a new time tracking session on the task if applicable
        if (this.state.currentSession && this.state.currentSession.taskPath) {
            try {
                const task = await this.plugin.cacheManager.getTaskInfo(this.state.currentSession.taskPath);
                if (task) {
                    await this.plugin.taskService.startTimeTracking(task);
                }
            } catch (error) {
                // If time tracking is already active, that's fine for Pomodoro resume
                if (!error.message?.includes('Time tracking is already active')) {
                    console.error('Failed to start time tracking for Pomodoro resume:', error);
                }
            }
        }
        
        // Emit event to update UI
        this.plugin.emitter.trigger(EVENT_POMODORO_TICK, { 
            timeRemaining: this.state.timeRemaining,
            session: this.state.currentSession 
        });
        
        new Notice('Pomodoro resumed');
    }

    async stopPomodoro() {
        if (!this.state.currentSession) {
            return;
        }

        const wasRunning = this.state.isRunning;
        this.stopTimer();

        if (this.state.currentSession) {
            this.state.currentSession.interrupted = true;
            this.state.currentSession.endTime = getCurrentTimestamp();
            
            // End the current active period if it's still running
            if (this.state.currentSession.activePeriods.length > 0) {
                const currentPeriod = this.state.currentSession.activePeriods[this.state.currentSession.activePeriods.length - 1];
                if (!currentPeriod.endTime) {
                    currentPeriod.endTime = getCurrentTimestamp();
                }
            }
            
            // Add interrupted session to history
            await this.addSessionToHistory(this.state.currentSession);
        }

        this.plugin.emitter.trigger(EVENT_POMODORO_INTERRUPT, { session: this.state.currentSession });

        // Trigger webhook for pomodoro interruption
        if (this.webhookNotifier && this.state.currentSession) {
            try {
                const task = this.state.currentSession.taskPath 
                    ? await this.plugin.cacheManager.getTaskInfo(this.state.currentSession.taskPath) 
                    : undefined;
                await this.webhookNotifier.triggerWebhook('pomodoro.interrupted', { 
                    session: this.state.currentSession, 
                    task 
                });
            } catch (error) {
                console.warn('Failed to trigger webhook for pomodoro interruption:', error);
            }
        }

        // Stop time tracking on the task if applicable (only if it was running)
        if (this.state.currentSession && this.state.currentSession.taskPath && wasRunning) {
            try {
                const task = await this.plugin.cacheManager.getTaskInfo(this.state.currentSession.taskPath);
                if (task) {
                    await this.plugin.taskService.stopTimeTracking(task);
                }
            } catch (error) {
                console.error('Failed to stop time tracking for Pomodoro interrupt:', error);
            }
        }

        this.state.currentSession = undefined;
        this.state.isRunning = false;
        // Reset to default work duration
        this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
        
        await this.saveState();
        
        // Emit tick event to update UI with reset timer
        this.plugin.emitter.trigger(EVENT_POMODORO_TICK, { 
            timeRemaining: this.state.timeRemaining,
            session: this.state.currentSession 
        });
        
        if (wasRunning) {
            new Notice('Pomodoro stopped and reset');
        }
    }

    private startTimer() {
        if (!this.timerWorker) return;

        this.timerWorker.postMessage({
            command: 'start',
            duration: this.state.timeRemaining
        });
    }

    private stopTimer() {
        if (!this.timerWorker) return;
        
        this.timerWorker.postMessage({ command: 'stop' });
    }

    private resumeTimer() {
        if (this.state.currentSession && this.state.currentSession.startTime) {
            const startTime = new Date(this.state.currentSession.startTime).getTime();
            const now = Date.now();

            // Check for invalid start time (future dates)
            if (startTime > now) {
                // Reset session if start time is in the future
                this.stopPomodoro();
                return;
            }

            const totalDuration = this.state.currentSession.plannedDuration * 60;

            if (!this.state.isRunning && this.state.timeRemaining > 0) {
                // Session was paused, use stored time remaining (don't recalculate)
                this.state.timeRemaining = Math.min(this.state.timeRemaining, totalDuration);
            } else if (this.state.isRunning) {
                // Calculate elapsed time based on active periods
                const activePeriods = this.state.currentSession.activePeriods || [];
                let totalActiveSeconds = 0;

                for (const period of activePeriods) {
                    const start = new Date(period.startTime).getTime();
                    const end = period.endTime
                        ? new Date(period.endTime).getTime()
                        : now;
                    totalActiveSeconds += Math.floor((end - start) / 1000);
                }

                // Calculate time remaining based on actual active time
                this.state.timeRemaining = Math.max(0, totalDuration - totalActiveSeconds);
            }

            if (this.state.timeRemaining > 0 && this.state.isRunning) {
                this.startTimer();
            } else if (this.state.timeRemaining <= 0) {
                // Timer would have completed while app was closed
                this.completePomodoro();
            }
        }
    }

    private async completePomodoro() {
        this.stopTimer();
        
        if (!this.state.currentSession) {
            return;
        }

        const session = this.state.currentSession;
        session.completed = true;
        session.endTime = getCurrentTimestamp();
        
        // End the current active period if it's still running
        if (session.activePeriods.length > 0) {
            const currentPeriod = session.activePeriods[session.activePeriods.length - 1];
            if (!currentPeriod.endTime) {
                currentPeriod.endTime = getCurrentTimestamp();
            }
        }

        // Stop time tracking on task if applicable for work sessions
        // Only stop if timer was running (if paused, time tracking should already be stopped)
        if (session.type === 'work' && this.state.isRunning) {
            // Stop time tracking on task if applicable
            if (session.taskPath) {
                try {
                    const task = await this.plugin.cacheManager.getTaskInfo(session.taskPath);
                    if (task) {
                        await this.plugin.taskService.stopTimeTracking(task);
                    }
                } catch (error) {
                    console.error('Failed to stop time tracking for Pomodoro completion:', error);
                }
            }
        }

        // Daily note update is now handled by addSessionToHistory method

        // Determine next session based on session history
        let shouldTakeLongBreak = false;
        if (session.type === 'work') {
            try {
                const stats = await this.getTodayStats();
                // Add 1 to account for the current session that will be added to history
                const totalCompleted = stats.pomodorosCompleted + 1;
                shouldTakeLongBreak = totalCompleted % this.plugin.settings.pomodoroLongBreakInterval === 0;
            } catch (error) {
                console.error('Failed to calculate break type:', error);
                shouldTakeLongBreak = false;
            }
        }

        // Add session to history
        await this.addSessionToHistory(session);

        // Emit completion event
        this.plugin.emitter.trigger(EVENT_POMODORO_COMPLETE, { 
            session, 
            nextType: session.type === 'work' 
                ? (shouldTakeLongBreak ? 'long-break' : 'short-break')
                : 'work'
        });

        // Trigger webhook for pomodoro completion
        if (this.webhookNotifier) {
            try {
                const task = session.taskPath ? await this.plugin.cacheManager.getTaskInfo(session.taskPath) : undefined;
                await this.webhookNotifier.triggerWebhook('pomodoro.completed', { session, task });
            } catch (error) {
                console.warn('Failed to trigger webhook for pomodoro completion:', error);
            }
        }

        // Show notification
        if (this.plugin.settings.pomodoroNotifications) {
            const message = session.type === 'work' 
                ? `🍅 Pomodoro completed!`
                : '☕ Break completed!';
            const body = session.type === 'work'
                ? `Time for a ${shouldTakeLongBreak ? 'long break 💤' : 'short break ☕'}`
                : 'Ready for the next pomodoro?';

            new Notification(message, { body });
        }

        // Play sound if enabled
        if (this.plugin.settings.pomodoroSoundEnabled) {
            this.playCompletionSound();
        }

        // Clear current session and set up for next session
        this.state.currentSession = undefined;
        this.state.isRunning = false;
        
        // Set up appropriate timer for next session
        if (session.type === 'work') {
            // After work session, prepare break timer
            const breakDuration = shouldTakeLongBreak 
                ? this.plugin.settings.pomodoroLongBreakDuration 
                : this.plugin.settings.pomodoroShortBreakDuration;
            this.state.timeRemaining = breakDuration * 60;
            this.state.nextSessionType = shouldTakeLongBreak ? 'long-break' : 'short-break';
            
            // Auto-start break if configured, otherwise just prepare the timer
            if (this.plugin.settings.pomodoroAutoStartBreaks) {
                const timeout = setTimeout(() => this.startBreak(shouldTakeLongBreak), 1000) as unknown as number;
                this.cleanupTimeouts.add(timeout);
            }
        } else {
            // After break session, prepare work timer
            this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
            this.state.nextSessionType = 'work';
            
            // Auto-start work if configured, otherwise just prepare the timer
            if (this.plugin.settings.pomodoroAutoStartWork) {
                const timeout = setTimeout(() => this.startPomodoro(), 1000) as unknown as number;
                this.cleanupTimeouts.add(timeout);
            }
        }
        
        await this.saveState();
        
        // Emit tick event to update UI with new timer duration
        this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
            timeRemaining: this.state.timeRemaining,
            session: this.state.currentSession
        });
    }

    private playCompletionSound() {
        try {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            const volume = Math.max(0, Math.min(1, this.plugin.settings.pomodoroSoundVolume / 100));
            gainNode.gain.value = volume * 0.3; // Scale down for comfortable listening
            
            oscillator.frequency.value = 800; // Frequency in Hz
            oscillator.type = 'sine';
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep
            
            // Track audio context for cleanup
            this.activeAudioContexts.add(audioContext);
            
            // Second beep
            const beepTimeout = setTimeout(() => {
                try {
                    const osc2 = audioContext.createOscillator();
                    osc2.connect(gainNode);
                    osc2.frequency.value = 1000;
                    osc2.type = 'sine';
                    osc2.start();
                    osc2.stop(audioContext.currentTime + 0.1);
                } catch (error) {
                    console.error('Failed to play second beep:', error);
                }
            }, 150);
            this.cleanupTimeouts.add(beepTimeout as unknown as number);
            
            // Clean up audio context after sounds complete
            const cleanupTimeout = setTimeout(() => {
                this.activeAudioContexts.delete(audioContext);
                audioContext.close().catch(() => {});
            }, 300);
            this.cleanupTimeouts.add(cleanupTimeout as unknown as number);
        } catch (error) {
            console.error('Failed to play completion sound:', error);
        }
    }

    // Public getters
    getState(): PomodoroState {
        return { ...this.state };
    }

    adjustSessionTime(adjustmentSeconds: number): void {
        if (this.state.currentSession) {
            this.stopTimer();

            // Apply the adjustment directly to timeRemaining
            this.state.timeRemaining = Math.max(1, this.state.timeRemaining + adjustmentSeconds);
            
            // Calculate the new total duration based on how much time has actually elapsed
            const activePeriods = this.state.currentSession.activePeriods || [];
            let totalActiveSeconds = 0;
            
            for (const period of activePeriods) {
                if (period.endTime) {
                    // Completed period
                    const start = new Date(period.startTime).getTime();
                    const end = new Date(period.endTime).getTime();
                    totalActiveSeconds += Math.floor((end - start) / 1000);
                } else if (this.state.isRunning) {
                    // Current running period
                    const start = new Date(period.startTime).getTime();
                    const now = Date.now();
                    totalActiveSeconds += Math.floor((now - start) / 1000);
                }
            }
            
            // New planned duration = elapsed time + remaining time
            const newTotalSeconds = totalActiveSeconds + this.state.timeRemaining;
            this.state.currentSession.plannedDuration = Math.ceil(newTotalSeconds / 60);
            
            this.saveState();
            this.startTimer();

            // Emit tick event to update UI
            this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
                timeRemaining: this.state.timeRemaining,
                session: this.state.currentSession
            });
        }
    }

    public adjustPreparedTimer(newTimeInSeconds: number): void {
        // If there's a current session, we should not adjust the prepared timer
        if (!this.state.currentSession) {
            // Stop the timer if it's running
            this.stopTimer();

            // Ensure minimum 1 second duration
            this.state.timeRemaining = Math.max(1, newTimeInSeconds);
            this.saveState();
            
            console.log("Adjusted prepared timer to:", this.state.timeRemaining, "seconds");

            // Trigger tick event to update UI
            this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
                timeRemaining: this.state.timeRemaining,
                session: this.state.currentSession
            });
        }
    }

    isRunning(): boolean {
        return this.state.isRunning;
    }

    getCurrentSession(): PomodoroSession | undefined {
        return this.state.currentSession;
    }

    getTimeRemaining(): number {
        return this.state.timeRemaining;
    }

    async getPomodorosCompleted(): Promise<number> {
        const stats = await this.getTodayStats();
        return stats.pomodorosCompleted;
    }

    async getCurrentStreak(): Promise<number> {
        const stats = await this.getTodayStats();
        return stats.currentStreak;
    }

    async getTotalMinutesToday(): Promise<number> {
        const stats = await this.getTodayStats();
        return stats.totalMinutes;
    }

    async assignTaskToCurrentSession(task?: TaskInfo) {
        if (!this.state.currentSession) {
            return;
        }

        // Update the current session's task
        this.state.currentSession.taskPath = task?.path;
        await this.saveState();

        // Emit tick event to update UI
        this.plugin.emitter.trigger(EVENT_POMODORO_TICK, { 
            timeRemaining: this.state.timeRemaining,
            session: this.state.currentSession 
        });
    }


    // Session History Management
    async getSessionHistory(): Promise<PomodoroSessionHistory[]> {
        try {
            let history: PomodoroSessionHistory[] = [];
            
            // Load from plugin data (legacy or current storage)
            const data = await this.plugin.loadData();
            const pluginHistory = data?.pomodoroHistory || [];
            
            if (this.plugin.settings.pomodoroStorageLocation === 'daily-notes') {
                // Load from daily notes when that's the primary storage
                const dailyNotesHistory = await this.loadHistoryFromDailyNotes();
                history = dailyNotesHistory;
                
                // Merge with plugin data if there's any (for migration purposes)
                if (pluginHistory.length > 0) {
                    const mergedHistory = this.mergeHistories(pluginHistory, dailyNotesHistory);
                    history = mergedHistory;
                }
            } else {
                // Default plugin storage
                history = pluginHistory;
            }
            
            // Sort by start time to maintain chronological order
            return history.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        } catch (error) {
            console.error('Failed to load session history:', error);
            return [];
        }
    }

    async saveSessionHistory(history: PomodoroSessionHistory[]): Promise<void> {
        try {
            if (this.plugin.settings.pomodoroStorageLocation === 'daily-notes') {
                await this.saveHistoryToDailyNotes(history);
            } else {
                // Default plugin storage
                const data = await this.plugin.loadData() || {};
                data.pomodoroHistory = history;
                await this.plugin.saveData(data);
            }
        } catch (error) {
            console.error('Failed to save session history:', error);
        }
    }


    async addSessionToHistory(session: PomodoroSession): Promise<void> {
        if (!session.endTime) {
            console.warn('Cannot add session to history without end time');
            return;
        }

        const historyEntry: PomodoroSessionHistory = {
            id: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            plannedDuration: session.plannedDuration,
            type: session.type,
            taskPath: session.taskPath,
            completed: session.completed && !session.interrupted,
            activePeriods: session.activePeriods.slice() // Copy the active periods array
        };

        try {
            if (this.plugin.settings.pomodoroStorageLocation === 'daily-notes') {
                // For daily notes, add only this session to the appropriate daily note
                await this.addSingleSessionToDailyNote(historyEntry);
            } else {
                // For plugin storage, add to the full history
                const history = await this.getSessionHistory();
                history.push(historyEntry);
                await this.saveSessionHistory(history);
            }
        } catch (error) {
            console.error('Failed to add session to history:', error);
        }
    }

    async getStatsForDate(date: Date): Promise<PomodoroHistoryStats> {
        const dateStr = formatDateForStorage(date);
        const history = await this.getSessionHistory();
        
        // Filter sessions for the specific date
        const dayHistory = history.filter(session => {
            const sessionDate = formatDateForStorage(new Date(session.startTime));
            return sessionDate === dateStr;
        });

        // Calculate stats for work sessions only
        const workSessions = dayHistory.filter(session => session.type === 'work');
        const completedWork = workSessions.filter(session => session.completed);

        // Calculate current streak (consecutive completed work sessions from latest backwards)
        let currentStreak = 0;
        for (let i = workSessions.length - 1; i >= 0; i--) {
            if (workSessions[i].completed) {
                currentStreak++;
            } else {
                break;
            }
        }

        const totalMinutes = completedWork.reduce((sum, session) => 
            sum + getSessionDuration(session), 0);
        const averageSessionLength = completedWork.length > 0 
            ? totalMinutes / completedWork.length 
            : 0;
        const completionRate = workSessions.length > 0 
            ? (completedWork.length / workSessions.length) * 100 
            : 0;

        return {
            pomodorosCompleted: completedWork.length,
            currentStreak,
            totalMinutes,
            averageSessionLength: Math.round(averageSessionLength),
            completionRate: Math.round(completionRate)
        };
    }

    async getTodayStats(): Promise<PomodoroHistoryStats> {
        return this.getStatsForDate(new Date());
    }

    cleanup() {
        this.stopTimer();
        if (this.timerWorker) {
            this.timerWorker.terminate();
            this.timerWorker = null;
        }
        for (const timeout of this.cleanupTimeouts) {
            clearTimeout(timeout);
        }
        this.cleanupTimeouts.clear();
        for (const audioContext of this.activeAudioContexts) {
            if (audioContext.state !== 'closed') {
                audioContext.close().catch(() => {});
            }
        }
        this.activeAudioContexts.clear();
        this.saveState();
    }

    /**
     * Save pomodoro history to daily notes frontmatter
     */
    private async saveHistoryToDailyNotes(history: PomodoroSessionHistory[]): Promise<void> {
        try {
            // Check if Daily Notes plugin is enabled
            if (!appHasDailyNotesPluginLoaded()) {
                throw new Error('Daily Notes core plugin is not enabled');
            }

            // Group sessions by date
            const sessionsByDate = this.groupSessionsByDate(history);
            
            // Update each daily note with its sessions
            for (const [dateStr, sessions] of sessionsByDate) {
                await this.updateDailyNotePomodoros(dateStr, sessions);
            }
        } catch (error) {
            console.error('Failed to save history to daily notes:', error);
            throw error;
        }
    }

    /**
     * Load pomodoro history from daily notes frontmatter
     */
    private async loadHistoryFromDailyNotes(): Promise<PomodoroSessionHistory[]> {
        try {
            // Check if Daily Notes plugin is enabled
            if (!appHasDailyNotesPluginLoaded()) {
                return [];
            }

            const allHistory: PomodoroSessionHistory[] = [];
            const allDailyNotes = getAllDailyNotes();
            const pomodoroField = this.plugin.fieldMapper.toUserField('pomodoros');

            // Read from each daily note
            for (const [, file] of Object.entries(allDailyNotes)) {
                try {
                    const cache = this.plugin.app.metadataCache.getFileCache(file);
                    const frontmatter = cache?.frontmatter;
                    
                    if (frontmatter && frontmatter[pomodoroField]) {
                        const sessions = frontmatter[pomodoroField];
                        if (Array.isArray(sessions)) {
                            allHistory.push(...sessions);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to read pomodoro data from daily note ${file.path}:`, error);
                }
            }

            return allHistory;
        } catch (error) {
            console.error('Failed to load history from daily notes:', error);
            return [];
        }
    }

    /**
     * Group sessions by date string (YYYY-MM-DD)
     */
    private groupSessionsByDate(history: PomodoroSessionHistory[]): Map<string, PomodoroSessionHistory[]> {
        const grouped = new Map<string, PomodoroSessionHistory[]>();

        for (const session of history) {
            const date = new Date(session.startTime);
            const dateStr = formatDateForStorage(date);
            
            if (!grouped.has(dateStr)) {
                grouped.set(dateStr, []);
            }
            grouped.get(dateStr)!.push(session);
        }

        return grouped;
    }

    /**
     * Add a single session to the appropriate daily note
     */
    private async addSingleSessionToDailyNote(session: PomodoroSessionHistory): Promise<void> {
        try {
            const sessionDate = new Date(session.startTime);
            const moment = (window as any).moment(sessionDate);
            
            // Get or create daily note
            const allDailyNotes = getAllDailyNotes();
            let dailyNote = getDailyNote(moment, allDailyNotes);
            
            if (!dailyNote) {
                dailyNote = await createDailyNote(moment);
                
                // Validate that daily note was created successfully
                if (!dailyNote) {
                    throw new Error('Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists.');
                }
            }

            // Update frontmatter
            const pomodoroField = this.plugin.fieldMapper.toUserField('pomodoros');
            
            await this.plugin.app.fileManager.processFrontMatter(dailyNote, (frontmatter) => {
                // Get existing sessions
                const existingSessions = frontmatter[pomodoroField] || [];
                const existingIds = new Set(existingSessions.map((s: any) => s.id));
                
                // Only add session if it doesn't already exist
                if (!existingIds.has(session.id)) {
                    frontmatter[pomodoroField] = [...existingSessions, session];
                }
            });
        } catch (error) {
            console.error(`Failed to add session to daily note:`, error);
        }
    }

    /**
     * Update a specific daily note with pomodoro sessions
     */
    private async updateDailyNotePomodoros(dateStr: string, sessions: PomodoroSessionHistory[]): Promise<void> {
        try {
            const date = parseDateToLocal(dateStr); // Use local date for daily note creation
            const moment = (window as any).moment(date);
            
            // Get or create daily note
            const allDailyNotes = getAllDailyNotes();
            let dailyNote = getDailyNote(moment, allDailyNotes);
            
            if (!dailyNote) {
                dailyNote = await createDailyNote(moment);
                
                // Validate that daily note was created successfully
                if (!dailyNote) {
                    throw new Error('Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists.');
                }
            }

            // Update frontmatter
            const pomodoroField = this.plugin.fieldMapper.toUserField('pomodoros');
            
            await this.plugin.app.fileManager.processFrontMatter(dailyNote, (frontmatter) => {
                // Get existing sessions and append new ones
                const existingSessions = frontmatter[pomodoroField] || [];
                const existingIds = new Set(existingSessions.map((s: any) => s.id));
                
                // Only add sessions that don't already exist
                const newSessions = sessions.filter(session => !existingIds.has(session.id));
                
                if (newSessions.length > 0) {
                    frontmatter[pomodoroField] = [...existingSessions, ...newSessions];
                }
            });
        } catch (error) {
            console.error(`Failed to update daily note for ${dateStr}:`, error);
        }
    }

    /**
     * Merge histories from plugin and daily notes, removing duplicates
     */
    private mergeHistories(pluginHistory: PomodoroSessionHistory[], dailyNotesHistory: PomodoroSessionHistory[]): PomodoroSessionHistory[] {
        const merged = [...dailyNotesHistory];
        const existingIds = new Set(dailyNotesHistory.map(s => s.id));

        // Add plugin sessions that aren't already in daily notes
        for (const session of pluginHistory) {
            if (!existingIds.has(session.id)) {
                merged.push(session);
            }
        }

        return merged;
    }

    /**
     * Migrate existing plugin data to daily notes
     */
    async migrateTodailyNotes(): Promise<void> {
        try {
            // Check if Daily Notes plugin is enabled
            if (!appHasDailyNotesPluginLoaded()) {
                throw new Error('Daily Notes core plugin must be enabled for migration');
            }

            // Load existing plugin data
            const data = await this.plugin.loadData();
            const pluginHistory = data?.pomodoroHistory || [];

            if (pluginHistory.length === 0) {
                return; // Nothing to migrate
            }

            // Save to daily notes
            await this.saveHistoryToDailyNotes(pluginHistory);

            // Clear plugin data after successful migration
            data.pomodoroHistory = [];
            await this.plugin.saveData(data);

            new Notice(`Successfully migrated ${pluginHistory.length} pomodoro sessions to daily notes.`);
        } catch (error) {
            console.error('Failed to migrate pomodoro data to daily notes:', error);
            new Notice('Failed to migrate pomodoro data. Please try again or check the console for details.');
            throw error;
        }
    }
}