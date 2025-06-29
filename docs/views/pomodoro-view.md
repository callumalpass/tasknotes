# Pomodoro Views

TaskNotes includes integrated pomodoro timer functionality with two dedicated views: the Pomodoro View for active timer sessions and the Pomodoro Stats View for tracking productivity over time.

## Pomodoro View

The Pomodoro View provides a focused interface for time-boxed work sessions using the pomodoro technique.

### Timer Interface

**Current Session Display**: Shows the active task being worked on and remaining time in the current session.

**Timer Controls**: 
- Start/stop buttons for beginning and pausing sessions
- Reset button to restart the current session
- Skip button to move to break periods early

**Session Type Indicator**: Displays whether you're in a work session, short break, or long break period.

**Progress Visualization**: Circular or linear progress bar showing session completion.

### Task Integration

**Task Selection**: Choose which task to work on during the pomodoro session from:
- Recently accessed tasks
- High-priority tasks
- Tasks scheduled for today
- Search and filter from all tasks

**Automatic Time Tracking**: When a pomodoro session is completed, the time is automatically recorded in the task's time tracking data.

**Task Switching**: Switch between tasks during breaks or between sessions without losing timer state.

### Session Configuration

**Work Duration**: Set the length of work sessions (traditionally 25 minutes, but configurable).

**Break Durations**: Configure short break (typically 5 minutes) and long break (typically 15-30 minutes) periods.

**Session Cycles**: Set how many work sessions before a long break (traditionally 4 sessions).

**Auto-Start Options**: 
- Automatically start breaks after work sessions
- Automatically start work sessions after breaks
- Require manual confirmation for each transition

### Notifications and Alerts

**Session Completion**: Audio and/or visual notifications when sessions complete.

**Break Reminders**: Notifications when break periods end and it's time to return to work.

**Custom Sounds**: Configure different notification sounds for work completion, break start, and session transitions.

**Do Not Disturb**: Option to suppress notifications during active work sessions.

## Pomodoro Stats View

The Stats View provides detailed analytics and historical data about your pomodoro sessions and productivity patterns.

### Session History

**Daily Sessions**: View completed sessions for any given day, including:
- Tasks worked on
- Session durations
- Break times taken
- Completion rates

**Weekly/Monthly Views**: Aggregate data showing patterns over longer time periods.

**Session Details**: Detailed breakdown of individual sessions including start times, interruptions, and actual work time.

### Productivity Metrics

**Completion Rates**: Percentage of started sessions that were completed without interruption.

**Total Time Tracking**: Cumulative time spent in work sessions, with breakdown by:
- Tasks
- Projects (via tags or contexts)
- Time periods (daily, weekly, monthly)

**Average Session Length**: Track whether you're maintaining consistent session durations.

**Break Adherence**: Statistics on how often you take recommended breaks.

### Visual Analytics

**Calendar Heatmap**: Visual representation of productive days with color-coded intensity based on completed sessions.

**Time Distribution Charts**: Graphs showing when during the day you're most productive.

**Task Completion Correlation**: Analysis of which tasks or task types benefit most from pomodoro sessions.

**Streak Tracking**: Monitor consecutive days with completed pomodoro sessions.

### Goal Setting and Progress

**Daily Targets**: Set goals for number of pomodoro sessions per day.

**Project Targets**: Set time-based goals for specific tasks or projects.

**Progress Indicators**: Visual feedback on goal achievement and consistency.

**Achievement Badges**: Milestone rewards for reaching productivity targets.

## Data Storage and Privacy

**Local Storage**: All pomodoro data is stored locally in your Obsidian vault.

**Integration Options**: Choose between:
- Plugin data files for centralized storage
- Daily note frontmatter for distributed storage
- Both options for redundancy

**Export Capabilities**: Export session data for external analysis or backup.

## Workflow Integration

**Task Time Estimates**: Compare actual pomodoro session time with initial task estimates to improve future planning.

**Calendar Integration**: Completed sessions can appear as time blocks in calendar views.

**Status Updates**: Option to automatically update task status when pomodoro sessions are completed.

**Note Integration**: Add session notes or reflections directly to task notes after completing pomodoros.

## Customization Options

**Theme Integration**: Pomodoro views respect Obsidian's theme settings and can be customized with CSS.

**Layout Options**: 
- Compact view for small panes
- Detailed view with full statistics
- Minimal view focusing only on timer

**Sound Customization**: Upload custom notification sounds or disable audio alerts entirely.

**Keyboard Shortcuts**: Assign hotkeys for common actions like start/stop, skip, and task switching.

## Benefits for Focus and Productivity

The integrated pomodoro system helps with:

**Time Awareness**: Understanding how long tasks actually take versus estimates.

**Distraction Management**: Built-in break periods prevent mental fatigue and maintain focus quality.

**Progress Visualization**: Seeing completed sessions provides motivation and sense of accomplishment.

**Data-Driven Planning**: Historical data helps improve time estimation and task planning.

**Habit Building**: Consistent use builds sustainable work habits and productivity routines.