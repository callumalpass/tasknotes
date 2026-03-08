import { Notice, TFile } from "obsidian";
import {
	appHasDailyNotesPluginLoaded,
	getAllDailyNotes,
	getDailyNote,
} from "obsidian-daily-notes-interface";
import TaskNotesPlugin from "../main";
import { TimeBlock } from "../types";
import { GoogleCalendarService } from "./GoogleCalendarService";

/** Debounce delay for rapid timeblock updates (ms) */
const SYNC_DEBOUNCE_MS = 500;

/** Max concurrent API calls during bulk sync to avoid rate limits */
const SYNC_CONCURRENCY_LIMIT = 5;

interface TimeblockSyncResult {
	synced: number;
	failed: number;
	skipped: number;
}

export class TimeblockCalendarSyncService {
	private plugin: TaskNotesPlugin;
	private googleCalendarService: GoogleCalendarService;

	/** Debounce timers for pending syncs, keyed by date + timeblock ID */
	private pendingSyncs: Map<string, ReturnType<typeof setTimeout>> = new Map();

	constructor(plugin: TaskNotesPlugin, googleCalendarService: GoogleCalendarService) {
		this.plugin = plugin;
		this.googleCalendarService = googleCalendarService;
	}

	destroy(): void {
		for (const timer of this.pendingSyncs.values()) {
			clearTimeout(timer);
		}
		this.pendingSyncs.clear();
	}

	isEnabled(): boolean {
		const settings = this.plugin.settings.googleCalendarExport;
		const enabled = settings.enabled;
		const timeblockSyncEnabled = settings.syncTimeblocks;
		const hasTargetCalendar = !!settings.targetCalendarId;
		const isConnected = this.googleCalendarService.getAvailableCalendars().length > 0;

		return enabled && timeblockSyncEnabled && hasTargetCalendar && isConnected;
	}

	private getEventId(timeblock: TimeBlock): string | undefined {
		return timeblock.googleCalendarEventId;
	}

	private getSyncKey(timeblock: TimeBlock, date: string): string {
		if (timeblock.id) {
			return `${date}:${timeblock.id}`;
		}

		return `${date}:${timeblock.title}:${timeblock.startTime}:${timeblock.endTime}`;
	}

	private buildEventDescription(timeblock: TimeBlock, date: string): string | undefined {
		if (!this.plugin.settings.googleCalendarExport.includeDescription) {
			return undefined;
		}

		const lines: string[] = [];
		if (timeblock.description) {
			lines.push(timeblock.description);
		}

		if (timeblock.attachments && timeblock.attachments.length > 0) {
			lines.push("");
			lines.push("Attachments:");
			for (const attachment of timeblock.attachments) {
				lines.push(`- ${attachment}`);
			}
		}

		if (this.plugin.settings.googleCalendarExport.includeObsidianLink) {
			const dailyNote = this.getDailyNoteForDate(date);
			if (dailyNote) {
				const vaultName = this.plugin.app.vault.getName();
				const encodedPath = encodeURIComponent(dailyNote.path);
				const obsidianUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodedPath}`;
				if (lines.length > 0) {
					lines.push("");
					lines.push("---");
				}
				lines.push(`<a href=\"${obsidianUri}\">Open Daily Note in Obsidian</a>`);
			}
		}

		return lines.length > 0 ? lines.join("\n") : undefined;
	}

	/**
	 * Apply the shared Google Calendar event title template to a timeblock.
	 * Supports task placeholders for compatibility and adds timeblock-specific fields.
	 */
	private applyTitleTemplate(timeblock: TimeBlock, date: string): string {
		const settings = this.plugin.settings.googleCalendarExport;
		const template =
			settings.timeblockEventTitleTemplate || settings.eventTitleTemplate || "{{title}}";
		const fallbackTitle = timeblock.title || "Timeblock";

		const rendered = template
			.replace(/\{\{title\}\}/g, fallbackTitle)
			.replace(/\{\{status\}\}/g, "")
			.replace(/\{\{priority\}\}/g, "")
			.replace(/\{\{due\}\}/g, "")
			.replace(/\{\{scheduled\}\}/g, "")
			.replace(/\{\{date\}\}/g, date)
			.replace(/\{\{startTime\}\}/g, timeblock.startTime || "")
			.replace(/\{\{endTime\}\}/g, timeblock.endTime || "")
			.trim();

		return rendered || fallbackTitle;
	}

	private toCalendarEvent(timeblock: TimeBlock, date: string): {
		summary: string;
		description?: string;
		start: { dateTime: string; timeZone: string };
		end: { dateTime: string; timeZone: string };
		colorId?: string;
	} {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const startDateTime = `${date}T${timeblock.startTime}:00`;
		const endDateTime = `${date}T${timeblock.endTime}:00`;

		const event: {
			summary: string;
			description?: string;
			start: { dateTime: string; timeZone: string };
			end: { dateTime: string; timeZone: string };
			colorId?: string;
		} = {
			summary: this.applyTitleTemplate(timeblock, date),
			start: { dateTime: startDateTime, timeZone: timezone },
			end: { dateTime: endDateTime, timeZone: timezone },
		};

		const description = this.buildEventDescription(timeblock, date);
		if (description) {
			event.description = description;
		}

		if (this.plugin.settings.googleCalendarExport.eventColorId) {
			event.colorId = this.plugin.settings.googleCalendarExport.eventColorId;
		}

		return event;
	}

	private extractEventId(icsEventId: string): string {
		const eventIdMatch = icsEventId.match(/^google-[^-]+-(.+)$/);
		return eventIdMatch ? eventIdMatch[1] : icsEventId;
	}

	private getDailyNoteForDate(date: string): TFile | null {
		if (!appHasDailyNotesPluginLoaded()) {
			return null;
		}

		const moment = (window as any).moment(date, "YYYY-MM-DD");
		const allDailyNotes = getAllDailyNotes();
		const dailyNote = getDailyNote(moment, allDailyNotes);

		return dailyNote instanceof TFile ? dailyNote : null;
	}

	private findTimeblockIndex(timeblocks: any[], timeblock: TimeBlock): number {
		if (timeblock.id) {
			const idIndex = timeblocks.findIndex((tb) => tb?.id === timeblock.id);
			if (idIndex >= 0) {
				return idIndex;
			}
		}

		return timeblocks.findIndex(
			(tb) =>
				tb?.title === timeblock.title &&
				tb?.startTime === timeblock.startTime &&
				tb?.endTime === timeblock.endTime
		);
	}

	private async setTimeblockEventId(
		date: string,
		timeblock: TimeBlock,
		eventId?: string
	): Promise<void> {
		const dailyNote = this.getDailyNoteForDate(date);
		if (!dailyNote) {
			return;
		}

		await this.plugin.app.fileManager.processFrontMatter(dailyNote, (frontmatter) => {
			if (!frontmatter.timeblocks || !Array.isArray(frontmatter.timeblocks)) {
				return;
			}

			const index = this.findTimeblockIndex(frontmatter.timeblocks, timeblock);
			if (index === -1) {
				return;
			}

			if (eventId) {
				frontmatter.timeblocks[index].googleCalendarEventId = eventId;
			} else {
				delete frontmatter.timeblocks[index].googleCalendarEventId;
			}
		});
	}

	private async processInParallel<T>(
		items: T[],
		processor: (item: T) => Promise<void>
	): Promise<void> {
		const executing: Promise<void>[] = [];

		for (const item of items) {
			const promise = processor(item).then(() => {
				executing.splice(executing.indexOf(promise), 1);
			});
			executing.push(promise);

			if (executing.length >= SYNC_CONCURRENCY_LIMIT) {
				await Promise.race(executing);
			}
		}

		await Promise.all(executing);
	}

	async syncTimeblockToCalendar(timeblock: TimeBlock, date: string): Promise<void> {
		if (!this.isEnabled()) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		const existingEventId = this.getEventId(timeblock);
		const eventData = this.toCalendarEvent(timeblock, date);

		try {
			if (existingEventId) {
				await this.googleCalendarService.updateEvent(
					settings.targetCalendarId,
					existingEventId,
					eventData
				);
				return;
			}

			const createdEvent = await this.googleCalendarService.createEvent(
				settings.targetCalendarId,
				{
					...eventData,
					start: eventData.start,
					end: eventData.end,
					isAllDay: false,
				}
			);

			const eventId = this.extractEventId(createdEvent.id);
			await this.setTimeblockEventId(date, timeblock, eventId);
			timeblock.googleCalendarEventId = eventId;
		} catch (error: any) {
			if (error.status === 404 && existingEventId) {
				await this.setTimeblockEventId(date, timeblock, undefined);
				timeblock.googleCalendarEventId = undefined;
				return this.syncTimeblockToCalendar(timeblock, date);
			}

			console.error("[TimeblockCalendarSync] Failed to sync timeblock:", {
				date,
				timeblockId: timeblock.id,
				error,
			});
		}
	}

	async updateTimeblockInCalendar(
		timeblock: TimeBlock,
		date: string,
		previousDate?: string
	): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskUpdate) {
			return;
		}

		const key = this.getSyncKey(timeblock, previousDate || date);
		const existingTimer = this.pendingSyncs.get(key);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		return new Promise((resolve) => {
			const timer = setTimeout(async () => {
				this.pendingSyncs.delete(key);
				await this.syncTimeblockToCalendar(timeblock, date);
				resolve();
			}, SYNC_DEBOUNCE_MS);

			this.pendingSyncs.set(key, timer);
		});
	}

	async deleteTimeblockFromCalendar(timeblock: TimeBlock, date: string): Promise<void> {
		if (!this.plugin.settings.googleCalendarExport.syncOnTaskDelete) {
			return;
		}

		if (!this.isEnabled()) {
			return;
		}

		const existingEventId = this.getEventId(timeblock);
		if (!existingEventId) {
			return;
		}

		const settings = this.plugin.settings.googleCalendarExport;
		try {
			await this.googleCalendarService.deleteEvent(settings.targetCalendarId, existingEventId);
		} catch (error: any) {
			if (error.status !== 404 && error.status !== 410) {
				console.error("[TimeblockCalendarSync] Failed to delete event:", error);
			}
		}

		await this.setTimeblockEventId(date, timeblock, undefined);
		timeblock.googleCalendarEventId = undefined;
	}

	async syncAllTimeblocks(): Promise<TimeblockSyncResult> {
		const results: TimeblockSyncResult = { synced: 0, failed: 0, skipped: 0 };

		if (!this.isEnabled()) {
			new Notice("Google Calendar export is not enabled or configured.");
			return results;
		}

		if (!appHasDailyNotesPluginLoaded()) {
			new Notice("Daily Notes plugin is not enabled.");
			return results;
		}

		const allDailyNotes = getAllDailyNotes();
		const syncItems: Array<{ date: string; timeblock: TimeBlock }> = [];

		for (const [dateKey, dailyNote] of Object.entries(allDailyNotes)) {
			if (!(dailyNote instanceof TFile)) {
				continue;
			}

			const date = this.normalizeDateKey(dateKey);
			if (!date) {
				continue;
			}

			const cache = this.plugin.app.metadataCache.getFileCache(dailyNote);
			const timeblocks = cache?.frontmatter?.timeblocks;
			if (!timeblocks || !Array.isArray(timeblocks)) {
				continue;
			}

			for (const timeblock of timeblocks) {
				if (!timeblock || typeof timeblock.startTime !== "string" || typeof timeblock.endTime !== "string") {
					results.skipped++;
					continue;
				}

				syncItems.push({ date, timeblock: timeblock as TimeBlock });
			}
		}

		new Notice(`Syncing ${syncItems.length} timeblocks to Google Calendar...`);

		await this.processInParallel(syncItems, async ({ date, timeblock }) => {
			try {
				await this.syncTimeblockToCalendar(timeblock, date);
				results.synced++;
			} catch (error) {
				results.failed++;
				console.error("[TimeblockCalendarSync] Failed sync item:", { date, timeblock, error });
			}
		});

		new Notice(
			`Timeblock sync complete. Synced: ${results.synced}, Failed: ${results.failed}, Skipped: ${results.skipped}`
		);
		return results;
	}

	private normalizeDateKey(dateKey: string): string | null {
		const moment = (window as any).moment;
		if (!moment) {
			return null;
		}

		const strict = moment(dateKey, ["YYYY-MM-DD", "YYYYMMDD", "MM-DD-YYYY", "DD-MM-YYYY"], true);
		if (strict.isValid()) {
			return strict.format("YYYY-MM-DD");
		}

		const relaxed = moment(dateKey);
		if (relaxed.isValid()) {
			return relaxed.format("YYYY-MM-DD");
		}

		return null;
	}
}
