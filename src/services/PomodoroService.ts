import { Notice, TFile } from 'obsidian';
import { format } from 'date-fns';
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
    PomodoroTimePeriod,
    EVENT_POMODORO_START, 
    EVENT_POMODORO_COMPLETE, 
    EVENT_POMODORO_INTERRUPT, 
    EVENT_POMODORO_TICK,
    TaskInfo
} from '../types';
import { getCurrentTimestamp } from '../utils/dateUtils';
import { getSessionDuration } from '../utils/pomodoroUtils';

export class PomodoroService {
    private plugin: TaskNotesPlugin;
    private timerInterval: number | null = null;
    private state: PomodoroState;
    private stateFile = 'pomodoro-state.json';
    private activeAudioContexts: Set<AudioContext> = new Set();
    private cleanupTimeouts: Set<number> = new Set();
    private visibilityChangeHandler: (() => void) | null = null;

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
        this.state = {
            isRunning: false,
            timeRemaining: plugin.settings.pomodoroWorkDuration * 60 // Default work duration in seconds
        };
    }

    async initialize() {
        await this.loadState();
        
        // Resume timer if it was running
        if (this.state.isRunning && this.state.currentSession) {
            this.resumeTimer();
        }
        
        // Listen for visibility changes to handle app suspension/resume
        this.visibilityChangeHandler = () => {
            if (!document.hidden && this.state.isRunning && this.state.currentSession) {
                // App became visible again, check if timer needs adjustment
                this.resumeTimer();
            }
        };
        this.plugin.registerDomEvent(document, 'visibilitychange', this.visibilityChangeHandler);
    }

    async loadState() {
        try {
            const data = await this.plugin.loadData();
            
            if (data?.pomodoroState) {
                this.state = data.pomodoroState;
                
                // Validate loaded state
                this.state.timeRemaining = Math.max(0, this.state.timeRemaining || 0);
                
                // Clear any stale session from previous day
                const today = format(new Date(), 'yyyy-MM-dd');
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
            data.lastPomodoroDate = format(new Date(), 'yyyy-MM-dd');
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
        
        // Validate duration settings
        const duration = Math.max(1, Math.min(120, this.plugin.settings.pomodoroWorkDuration));

        const sessionStartTime = getCurrentTimestamp();
        const session: PomodoroSession = {
            id: Date.now().toString(),
            taskPath: task?.path,
            startTime: sessionStartTime,
            plannedDuration: duration,
            type: 'work',
            completed: false,
            activePeriods: [{
                startTime: sessionStartTime
                // endTime will be set when paused or completed
            }]
        };

        this.state.currentSession = session;
        this.state.isRunning = true;
        this.state.timeRemaining = session.plannedDuration * 60; // Convert to seconds

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
        
        this.plugin.emitter.trigger(EVENT_POMODORO_START, { session, task });
        new Notice(`Pomodoro started${task ? ` for: ${task.title}` : ''}`);
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

        await this.saveState();
        this.startTimer();
        
        new Notice(`${isLongBreak ? 'Long' : 'Short'} break started`);
    }

    async pausePomodoro() {
        if (!this.state.isRunning || !this.timerInterval) {
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
        this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60; // Reset to default work duration
        
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
        this.stopTimer(); // Clear any existing timer
        
        // Save state immediately when timer starts
        this.saveState().catch(error => {
            console.error('Failed to save state when starting timer:', error);
        });
        
        this.timerInterval = setInterval(async () => {
            if (this.state.timeRemaining > 0) {
                this.state.timeRemaining--;
                
                // Emit tick event for UI updates
                this.plugin.emitter.trigger(EVENT_POMODORO_TICK, { 
                    timeRemaining: this.state.timeRemaining,
                    session: this.state.currentSession 
                });
                
                // Save state periodically (every 10 seconds) to persist progress
                if (this.state.timeRemaining % 10 === 0) {
                    this.saveState().catch(error => {
                        console.error('Failed to save periodic state:', error);
                    });
                }
            }

            if (this.state.timeRemaining <= 0) {
                await this.completePomodoro();
            }
        }, 1000) as unknown as number; // Update every second
    }

    private stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    private resumeTimer() {
        // Calculate time elapsed since last save
        if (this.state.currentSession && this.state.currentSession.startTime) {
            const startTime = new Date(this.state.currentSession.startTime).getTime();
            const now = Date.now();
            
            // Check for invalid start time (future dates)
            if (startTime > now) {
                // Reset session if start time is in the future
                this.stopPomodoro();
                return;
            }
            
            const elapsed = Math.floor((now - startTime) / 1000);
            const totalDuration = this.state.currentSession.plannedDuration * 60;
            
            // Account for paused time by using actual time remaining from state
            // rather than calculating from start time when session was paused
            if (!this.state.isRunning && this.state.timeRemaining > 0) {
                // Session was paused, use stored time remaining
                this.state.timeRemaining = Math.min(this.state.timeRemaining, totalDuration);
            } else {
                // Session was running, calculate based on elapsed time
                this.state.timeRemaining = Math.max(0, totalDuration - elapsed);
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

        // Update daily note with pomodoro count for work sessions
        if (session.type === 'work') {
            await this.updateDailyNotePomodoroCount();
        }

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

        // Show notification
        if (this.plugin.settings.pomodoroNotifications) {
            const message = session.type === 'work' 
                ? `Pomodoro completed! Time for a ${shouldTakeLongBreak ? 'long' : 'short'} break.`
                : 'Break completed! Ready for the next pomodoro?';
            new Notice(message);
        }

        // Play sound if enabled
        if (this.plugin.settings.pomodoroSoundEnabled) {
            this.playCompletionSound();
        }

        // Clear current session
        this.state.currentSession = undefined;
        this.state.isRunning = false;
        this.state.timeRemaining = 0;
        
        await this.saveState();

        // Auto-start next session if configured
        if (session.type === 'work' && this.plugin.settings.pomodoroAutoStartBreaks) {
            const timeout = setTimeout(() => this.startBreak(shouldTakeLongBreak), 1000) as unknown as number;
            this.cleanupTimeouts.add(timeout);
        } else if (session.type !== 'work' && this.plugin.settings.pomodoroAutoStartWork) {
            const timeout = setTimeout(() => this.startPomodoro(), 1000) as unknown as number;
            this.cleanupTimeouts.add(timeout);
        }
    }


    private async updateDailyNotePomodoroCount() {
        try {
            // Check if Daily Notes plugin is enabled
            if (!appHasDailyNotesPluginLoaded()) {
                console.warn('Daily Notes core plugin is not enabled, skipping pomodoro update');
                return;
            }

            // Convert date to moment for the API
            const moment = (window as any).moment(new Date());
            
            // Get all daily notes to check if one exists for today
            const allDailyNotes = getAllDailyNotes();
            let file = getDailyNote(moment, allDailyNotes);
            
            if (!file) {
                // Daily note does not exist, create it using the core plugin
                try {
                    file = await createDailyNote(moment);
                    // Created daily note with 1 pomodoro
                } catch (createError: any) {
                    if (createError.message.includes('File already exists')) {
                        // File was created between our check and create attempt
                        // Daily note was created by another process, try to get it again
                        file = getDailyNote(moment, getAllDailyNotes());
                        if (file instanceof TFile) {
                            await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                                const pomodoroField = this.plugin.fieldMapper.toUserField('pomodoros');
                                if (!frontmatter[pomodoroField] || typeof frontmatter[pomodoroField] !== 'number') {
                                    frontmatter[pomodoroField] = 0;
                                }
                                frontmatter[pomodoroField]++;
                                // Updated pomodoro count
                            });
                        }
                    } else {
                        throw createError;
                    }
                }
            } else {
                // Daily note exists, updating pomodoro count
                // Update existing daily note
                await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                    const pomodoroField = this.plugin.fieldMapper.toUserField('pomodoros');
                    if (!frontmatter[pomodoroField]) {
                        frontmatter[pomodoroField] = 0;
                    }
                    frontmatter[pomodoroField]++;
                    // Updated pomodoro count
                });
            }
        } catch (error) {
            console.error('Failed to update daily note pomodoros:', error);
        }
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

    /**
     * Calculate actual duration in minutes from active periods
     */
    private calculateActualDuration(activePeriods: PomodoroTimePeriod[]): number {
        return activePeriods
            .filter(period => period.endTime) // Only completed periods
            .reduce((total, period) => {
                const start = new Date(period.startTime);
                const end = new Date(period.endTime!);
                const durationMs = end.getTime() - start.getTime();
                return total + Math.round(durationMs / (1000 * 60)); // Convert to minutes
            }, 0);
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
            const history = await this.getSessionHistory();
            history.push(historyEntry);
            await this.saveSessionHistory(history);
        } catch (error) {
            console.error('Failed to add session to history:', error);
        }
    }

    async getStatsForDate(date: Date): Promise<PomodoroHistoryStats> {
        const dateStr = format(date, 'yyyy-MM-dd');
        const history = await this.getSessionHistory();
        
        // Filter sessions for the specific date
        const dayHistory = history.filter(session => {
            const sessionDate = format(new Date(session.startTime), 'yyyy-MM-dd');
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
        
        // Clean up all timeouts
        for (const timeout of this.cleanupTimeouts) {
            clearTimeout(timeout);
        }
        this.cleanupTimeouts.clear();
        
        // Clean up all active audio contexts
        for (const audioContext of this.activeAudioContexts) {
            try {
                if (audioContext.state !== 'closed') {
                    audioContext.close().catch(() => {});
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        this.activeAudioContexts.clear();
        
        // Visibility change handler will be cleaned up automatically by Obsidian
        // when the plugin is unloaded, since we used registerDomEvent
        this.visibilityChangeHandler = null;
        
        // Save final state before cleanup
        this.saveState().catch(error => {
            console.error('Failed to save final state:', error);
        });
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
            const dateStr = format(date, 'yyyy-MM-dd');
            
            if (!grouped.has(dateStr)) {
                grouped.set(dateStr, []);
            }
            grouped.get(dateStr)!.push(session);
        }

        return grouped;
    }

    /**
     * Update a specific daily note with pomodoro sessions
     */
    private async updateDailyNotePomodoros(dateStr: string, sessions: PomodoroSessionHistory[]): Promise<void> {
        try {
            const date = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone issues
            const moment = (window as any).moment(date);
            
            // Get or create daily note
            const allDailyNotes = getAllDailyNotes();
            let dailyNote = getDailyNote(moment, allDailyNotes);
            
            if (!dailyNote) {
                dailyNote = await createDailyNote(moment);
            }

            // Update frontmatter
            const pomodoroField = this.plugin.fieldMapper.toUserField('pomodoros');
            
            await this.plugin.app.fileManager.processFrontMatter(dailyNote, (frontmatter) => {
                frontmatter[pomodoroField] = sessions;
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