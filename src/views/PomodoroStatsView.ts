import { ItemView, WorkspaceLeaf, Setting } from 'obsidian';
import { format, startOfWeek, endOfWeek, startOfDay } from 'date-fns';
import TaskNotesPlugin from '../main';
import { 
    POMODORO_STATS_VIEW_TYPE,
    PomodoroHistoryStats,
    PomodoroSessionHistory
} from '../types';
import { parseTimestamp } from '../utils/dateUtils';
import { getSessionDuration } from '../utils/pomodoroUtils';

export class PomodoroStatsView extends ItemView {
    plugin: TaskNotesPlugin;
    
    // UI elements
    private overviewStatsEl: HTMLElement | null = null;
    private todayStatsEl: HTMLElement | null = null;
    private weekStatsEl: HTMLElement | null = null;
    private recentSessionsEl: HTMLElement | null = null;
    private overallStatsEl: HTMLElement | null = null;
    
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    
    getViewType(): string {
        return POMODORO_STATS_VIEW_TYPE;
    }
    
    getDisplayText(): string {
        return 'Pomodoro stats';
    }
    
    getIcon(): string {
        return 'bar-chart';
    }

    /**
     * Calculate actual duration in minutes with backward compatibility
     */
    private calculateActualDuration(activePeriods: Array<{startTime: string; endTime?: string}>): number {
        return activePeriods
            .filter(period => period.endTime) // Only completed periods
            .reduce((total, period) => {
                const start = new Date(period.startTime);
                const end = period.endTime ? new Date(period.endTime) : new Date();
                const durationMs = end.getTime() - start.getTime();
                return total + Math.round(durationMs / (1000 * 60)); // Convert to minutes
            }, 0);
    }
    
    async onOpen() {
        await this.plugin.onReady();
        await this.render();
    }
    
    async onClose() {
        this.contentEl.empty();
    }
    
    async render() {
        const container = this.contentEl.createDiv({ cls: 'tasknotes-plugin tasknotes-container pomodoro-stats-container pomodoro-stats-view' });
        
        // Header
        const header = container.createDiv({ cls: 'pomodoro-stats-header pomodoro-stats-view__header' });
        new Setting(header)
            .setName('Pomodoro statistics')
            .setHeading();
        
        // Refresh button
        const refreshButton = header.createEl('button', { 
            cls: 'pomodoro-stats-refresh-button pomodoro-stats-view__refresh-button',
            text: 'Refresh'
        });
        this.registerDomEvent(refreshButton, 'click', () => {
            this.refreshStats();
        });
        
        // Overview section (like TickTick)
        const overviewSection = container.createDiv({ cls: 'pomodoro-stats-section pomodoro-stats-view__section' });
        new Setting(overviewSection)
            .setName('Overview')
            .setHeading();
        this.overviewStatsEl = overviewSection.createDiv({ cls: 'pomodoro-overview-grid pomodoro-stats-view__overview-grid' });
        
        // Today's stats
        const todaySection = container.createDiv({ cls: 'pomodoro-stats-section pomodoro-stats-view__section' });
        new Setting(todaySection)
            .setName('Today')
            .setHeading();
        this.todayStatsEl = todaySection.createDiv({ cls: 'pomodoro-stats-grid pomodoro-stats-view__stats-grid' });
        
        // This week's stats
        const weekSection = container.createDiv({ cls: 'pomodoro-stats-section pomodoro-stats-view__section' });
        new Setting(weekSection)
            .setName('This week')
            .setHeading();
        this.weekStatsEl = weekSection.createDiv({ cls: 'pomodoro-stats-grid pomodoro-stats-view__stats-grid' });
        
        // Overall stats
        const overallSection = container.createDiv({ cls: 'pomodoro-stats-section pomodoro-stats-view__section' });
        new Setting(overallSection)
            .setName('All time')
            .setHeading();
        this.overallStatsEl = overallSection.createDiv({ cls: 'pomodoro-stats-grid pomodoro-stats-view__stats-grid' });
        
        // Recent sessions
        const recentSection = container.createDiv({ cls: 'pomodoro-stats-section pomodoro-stats-view__section' });
        new Setting(recentSection)
            .setName('Recent sessions')
            .setHeading();
        this.recentSessionsEl = recentSection.createDiv({ cls: 'pomodoro-recent-sessions pomodoro-stats-view__recent-sessions' });
        
        // Initial load
        await this.refreshStats();
    }
    
    private async refreshStats() {
        try {
            await Promise.all([
                this.updateOverviewStats(),
                this.updateTodayStats(),
                this.updateWeekStats(),
                this.updateOverallStats(),
                this.updateRecentSessions()
            ]);
        } catch (error) {
            console.error('Failed to refresh stats:', error);
        }
    }
    
    private async updateOverviewStats() {
        if (!this.overviewStatsEl) return;
        
        const todayStats = await this.plugin.pomodoroService.getTodayStats();
        const overallStats = await this.calculateOverallStatsFromHistory();
        
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStats = await this.calculateStatsForRange(yesterday, yesterday);
        
        this.renderOverviewStats(this.overviewStatsEl, todayStats, overallStats, yesterdayStats);
    }
    
    private async updateTodayStats() {
        if (!this.todayStatsEl) return;
        
        const stats = await this.plugin.pomodoroService.getTodayStats();
        this.renderStatsGrid(this.todayStatsEl, stats);
    }
    
    private async updateWeekStats() {
        if (!this.weekStatsEl) return;
        
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        
        const stats = await this.calculateStatsForRange(weekStart, weekEnd);
        this.renderStatsGrid(this.weekStatsEl, stats);
    }
    
    private async updateOverallStats() {
        if (!this.overallStatsEl) return;
        
        const history = await this.plugin.pomodoroService.getSessionHistory();
        const stats = this.calculateOverallStats(history);
        this.renderStatsGrid(this.overallStatsEl, stats);
    }
    
    private async calculateOverallStatsFromHistory(): Promise<PomodoroHistoryStats> {
        const history = await this.plugin.pomodoroService.getSessionHistory();
        return this.calculateOverallStats(history);
    }
    
    private async updateRecentSessions() {
        if (!this.recentSessionsEl) return;
        
        const history = await this.plugin.pomodoroService.getSessionHistory();
        const recentSessions = history
            .filter(session => session.type === 'work')
            .slice(-10)
            .reverse();
        
        this.recentSessionsEl.empty();
        
        if (recentSessions.length === 0) {
            this.recentSessionsEl.createDiv({ 
                cls: 'pomodoro-no-sessions pomodoro-stats-view__no-sessions',
                text: 'No sessions recorded yet'
            });
            return;
        }
        
        for (const session of recentSessions) {
            const sessionEl = this.recentSessionsEl.createDiv({ cls: 'pomodoro-session-item pomodoro-stats-view__session-item' });
            
            const dateEl = sessionEl.createSpan({ cls: 'session-date pomodoro-stats-view__session-date' });
            dateEl.textContent = format(new Date(session.startTime), 'MMM d, HH:mm');
            
            const durationEl = sessionEl.createSpan({ cls: 'session-duration pomodoro-stats-view__session-duration' });
            const actualDuration = getSessionDuration(session);
            durationEl.textContent = `${actualDuration}min`;
            
            const statusEl = sessionEl.createSpan({ cls: 'session-status pomodoro-stats-view__session-status' });
            statusEl.textContent = session.completed ? 'Completed' : 'Interrupted';
            statusEl.addClass(session.completed ? 'status-completed' : 'status-interrupted');
            statusEl.addClass(session.completed ? 'pomodoro-stats-view__session-status--completed' : 'pomodoro-stats-view__session-status--interrupted');
            
            if (session.taskPath) {
                const taskEl = sessionEl.createSpan({ cls: 'session-task pomodoro-stats-view__session-task' });
                const taskName = session.taskPath.split('/').pop()?.replace('.md', '') || '';
                taskEl.textContent = taskName;
            }
        }
    }
    
    private renderOverviewStats(container: HTMLElement, todayStats: PomodoroHistoryStats, overallStats: PomodoroHistoryStats, yesterdayStats: PomodoroHistoryStats) {
        container.empty();
        
        // Format time duration in hours and minutes
        const formatTime = (minutes: number): string => {
            if (minutes < 60) return `${minutes}m`;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
        };
        
        // Calculate changes from yesterday
        const pomodoroChange = todayStats.pomodorosCompleted - yesterdayStats.pomodorosCompleted;
        const timeChange = todayStats.totalMinutes - yesterdayStats.totalMinutes;
        
        // Today's Pomos
        const todayPomosCard = container.createDiv({ cls: 'pomodoro-overview-card pomodoro-stats-view__overview-card' });
        const todayPomosValue = todayPomosCard.createDiv({ cls: 'overview-value pomodoro-stats-view__overview-value' });
        todayPomosValue.textContent = todayStats.pomodorosCompleted.toString();
        todayPomosCard.createDiv({ cls: 'overview-label pomodoro-stats-view__overview-label', text: "Today's Pomos" });
        if (pomodoroChange !== 0) {
            const changeEl = todayPomosCard.createDiv({ cls: 'overview-change pomodoro-stats-view__overview-change' });
            changeEl.textContent = `${pomodoroChange > 0 ? '+' : ''}${pomodoroChange} from yesterday`;
            changeEl.addClass(pomodoroChange > 0 ? 'positive' : 'negative');
        }
        
        // Total Pomos
        const totalPomosCard = container.createDiv({ cls: 'pomodoro-overview-card pomodoro-stats-view__overview-card' });
        const totalPomosValue = totalPomosCard.createDiv({ cls: 'overview-value pomodoro-stats-view__overview-value' });
        totalPomosValue.textContent = overallStats.pomodorosCompleted.toString();
        totalPomosCard.createDiv({ cls: 'overview-label pomodoro-stats-view__overview-label', text: 'Total Pomos' });
        
        // Today's Focus
        const todayFocusCard = container.createDiv({ cls: 'pomodoro-overview-card pomodoro-stats-view__overview-card' });
        const todayFocusValue = todayFocusCard.createDiv({ cls: 'overview-value pomodoro-stats-view__overview-value' });
        todayFocusValue.textContent = formatTime(todayStats.totalMinutes);
        todayFocusCard.createDiv({ cls: 'overview-label pomodoro-stats-view__overview-label', text: "Today's Focus" });
        if (timeChange !== 0) {
            const changeEl = todayFocusCard.createDiv({ cls: 'overview-change pomodoro-stats-view__overview-change' });
            changeEl.textContent = `${formatTime(Math.abs(timeChange))} ${timeChange > 0 ? 'more' : 'less'} than yesterday`;
            changeEl.addClass(timeChange > 0 ? 'positive' : 'negative');
        }
        
        // Total Focus Duration
        const totalFocusCard = container.createDiv({ cls: 'pomodoro-overview-card pomodoro-stats-view__overview-card' });
        const totalFocusValue = totalFocusCard.createDiv({ cls: 'overview-value pomodoro-stats-view__overview-value' });
        totalFocusValue.textContent = formatTime(overallStats.totalMinutes);
        totalFocusCard.createDiv({ cls: 'overview-label pomodoro-stats-view__overview-label', text: 'Total Focus Duration' });
    }

    private renderStatsGrid(container: HTMLElement, stats: PomodoroHistoryStats) {
        container.empty();
        
        // Completed pomodoros
        const pomodorosCard = container.createDiv({ cls: 'pomodoro-stat-card pomodoro-stats-view__stat-card' });
        pomodorosCard.createDiv({ cls: 'stat-value pomodoro-stats-view__stat-value', text: stats.pomodorosCompleted.toString() });
        pomodorosCard.createDiv({ cls: 'stat-label pomodoro-stats-view__stat-label', text: 'Pomodoros' });
        
        // Current streak
        const streakCard = container.createDiv({ cls: 'pomodoro-stat-card pomodoro-stats-view__stat-card' });
        streakCard.createDiv({ cls: 'stat-value pomodoro-stats-view__stat-value', text: stats.currentStreak.toString() });
        streakCard.createDiv({ cls: 'stat-label pomodoro-stats-view__stat-label', text: 'Streak' });
        
        // Total minutes
        const minutesCard = container.createDiv({ cls: 'pomodoro-stat-card pomodoro-stats-view__stat-card' });
        minutesCard.createDiv({ cls: 'stat-value pomodoro-stats-view__stat-value', text: stats.totalMinutes.toString() });
        minutesCard.createDiv({ cls: 'stat-label pomodoro-stats-view__stat-label', text: 'Minutes' });
        
        // Average session length
        const avgCard = container.createDiv({ cls: 'pomodoro-stat-card pomodoro-stats-view__stat-card' });
        avgCard.createDiv({ cls: 'stat-value pomodoro-stats-view__stat-value', text: stats.averageSessionLength.toString() });
        avgCard.createDiv({ cls: 'stat-label pomodoro-stats-view__stat-label', text: 'Avg Length' });
        
        // Completion rate
        const rateCard = container.createDiv({ cls: 'pomodoro-stat-card pomodoro-stats-view__stat-card' });
        rateCard.createDiv({ cls: 'stat-value pomodoro-stats-view__stat-value', text: `${stats.completionRate}%` });
        rateCard.createDiv({ cls: 'stat-label pomodoro-stats-view__stat-label', text: 'Completion' });
    }
    
    private async calculateStatsForRange(startDate: Date, endDate: Date): Promise<PomodoroHistoryStats> {
        const history = await this.plugin.pomodoroService.getSessionHistory();
        
        // Normalize range boundaries to start of day for safe comparison
        const normalizedStartDate = startOfDay(startDate);
        const normalizedEndDate = startOfDay(endDate);
        
        // Filter sessions within date range
        const rangeSessions = history.filter(session => {
            try {
                // Parse the session timestamp safely and normalize to start of day
                const sessionTimestamp = parseTimestamp(session.startTime);
                const sessionDate = startOfDay(sessionTimestamp);
                
                // Safe date comparison using normalized dates
                return sessionDate >= normalizedStartDate && sessionDate <= normalizedEndDate;
            } catch (error) {
                console.error('Error parsing session timestamp for filtering:', { 
                    sessionStartTime: session.startTime, 
                    error 
                });
                return false; // Exclude sessions with invalid timestamps
            }
        });
        
        return this.calculateStatsFromSessions(rangeSessions);
    }
    
    private calculateOverallStats(history: PomodoroSessionHistory[]): PomodoroHistoryStats {
        return this.calculateStatsFromSessions(history);
    }
    
    private calculateStatsFromSessions(sessions: PomodoroSessionHistory[]): PomodoroHistoryStats {
        // Filter work sessions only
        const workSessions = sessions.filter(session => session.type === 'work');
        const completedWork = workSessions.filter(session => session.completed);
        
        // Calculate streak from most recent sessions
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
}
