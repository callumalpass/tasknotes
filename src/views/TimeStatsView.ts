import { ItemView, WorkspaceLeaf, Setting, Notice } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TIME_STATS_VIEW_TYPE } from '../types';

export class TimeStatsView extends ItemView {
    plugin: TaskNotesPlugin;
    private resultEl: HTMLElement;
    private customStartDateEl: HTMLInputElement;
    private customEndDateEl: HTMLInputElement;

    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return TIME_STATS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Time Statistics';
    }

    getIcon(): string {
        return 'hourglass';
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();

        container.createEl('h2', { text: 'Time Estimate Statistics' });

        const controlsEl = container.createDiv({ cls: 'time-stats-controls' });

        new Setting(controlsEl)
            .setName('Quick Ranges')
            .addButton(button => button.setButtonText('Daily').onClick(() => this.fetchTimeStats('daily')))
            .addButton(button => button.setButtonText('Weekly').onClick(() => this.fetchTimeStats('weekly')))
            .addButton(button => button.setButtonText('Monthly').onClick(() => this.fetchTimeStats('monthly')))
            .addButton(button => button.setButtonText('Yearly').onClick(() => this.fetchTimeStats('yearly')));

        const customRangeEl = new Setting(controlsEl).setName('Custom Range');
        this.customStartDateEl = customRangeEl.controlEl.createEl('input', { type: 'date' });
        this.customEndDateEl = customRangeEl.controlEl.createEl('input', { type: 'date' });
        customRangeEl.addButton(button => button.setButtonText('Fetch').onClick(() => {
            const start = this.customStartDateEl.value;
            const end = this.customEndDateEl.value;
            if (start && end) {
                this.fetchTimeStats({ start: new Date(start), end: new Date(end) });
            } else {
                new Notice('Please select both a start and end date.');
            }
        }));

        this.resultEl = container.createDiv({ cls: 'time-stats-result' });
    }

    private async fetchTimeStats(range: 'daily' | 'weekly' | 'monthly' | 'yearly' | { start: Date, end: Date }): Promise<void> {
        this.resultEl.setText('Loading...');

        try {
            if (!this.plugin.taskStatsService) {
                throw new Error('TaskStatsService is not available.');
            }

            const totalMinutes = await this.plugin.taskStatsService.getAggregatedTimeEstimate(range);

            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            this.resultEl.setText(`Total estimated time: ${hours} hours and ${minutes} minutes`);

        } catch (error: any) {
            console.error('Error fetching time stats:', error);
            this.resultEl.setText(`Error: ${error.message}`);
            new Notice(`Failed to fetch time statistics: ${error.message}`);
        }
    }
}
