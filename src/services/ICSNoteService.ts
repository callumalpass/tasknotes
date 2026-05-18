import { TFile, Notice, normalizePath } from "obsidian";
import { format } from "date-fns";
import { processFolderTemplate } from "../utils/folderTemplateProcessor";
import TaskNotesPlugin from "../main";
import { ICSEvent, TaskInfo, NoteInfo, TaskCreationData } from "../types";
import { getCurrentTimestampForStorage, formatDateForStorage } from "../utils/dateUtils";
import {
	generateICSNoteFilename,
	generateUniqueFilename,
	ICSFilenameContext,
} from "../utils/filenameGenerator";
import { ensureFolderExists } from "../utils/helpers";
import { processTemplate, ICSTemplateData } from "../utils/templateProcessor";
import type { InterpolationValues, TranslationKey } from "../i18n";

export interface ICSEventReference {
	event: ICSEvent;
	subscriptionName?: string;
}

interface EventSeriesIndex {
	seriesIdByEventId: Map<string, string>;
	eventIdsBySeriesId: Map<string, Set<string>>;
}

/**
 * Service for creating notes and tasks from ICS calendar events
 */
export class ICSNoteService {
	constructor(private plugin: TaskNotesPlugin) {}

	private translate(key: TranslationKey, variables?: InterpolationValues): string {
		return this.plugin.i18n.translate(key, variables);
	}

	/**
	 * Find a loaded calendar event by its stored ICS event id.
	 */
	findEventById(eventId: string): ICSEventReference | null {
		const trimmedEventId = eventId.trim();
		if (!trimmedEventId) return null;

		const icsEvent = this.plugin.icsSubscriptionService
			?.getAllEvents()
			.find((event) => event.id === trimmedEventId);
		if (icsEvent) {
			const subscriptionName = this.plugin.icsSubscriptionService
				?.getSubscriptions()
				.find((subscription) => subscription.id === icsEvent.subscriptionId)?.name;
			return { event: icsEvent, subscriptionName };
		}

		const googleEvent = this.plugin.googleCalendarService
			?.getAllEvents()
			.find((event) => event.id === trimmedEventId);
		if (googleEvent) {
			const calendarId = googleEvent.subscriptionId.replace("google-", "");
			const subscriptionName =
				this.plugin.googleCalendarService
					?.getAvailableCalendars()
					.find((calendar) => calendar.id === calendarId)?.summary || "Google Calendar";
			return { event: googleEvent, subscriptionName };
		}

		const microsoftEvent = this.plugin.microsoftCalendarService
			?.getAllEvents()
			.find((event) => event.id === trimmedEventId);
		if (microsoftEvent) {
			const calendarId = microsoftEvent.subscriptionId.replace("microsoft-", "");
			const subscriptionName =
				this.plugin.microsoftCalendarService
					?.getAvailableCalendars()
					.find((calendar) => calendar.id === calendarId)?.summary ||
				"Microsoft Calendar";
			return { event: microsoftEvent, subscriptionName };
		}

		return null;
	}

	private getLoadedCalendarEvents(): ICSEvent[] {
		return [
			...(this.plugin.icsSubscriptionService?.getAllEvents() ?? []),
			...(this.plugin.googleCalendarService?.getAllEvents() ?? []),
			...(this.plugin.microsoftCalendarService?.getAllEvents() ?? []),
		];
	}

	private getPotentialSeriesId(eventId: string): string | null {
		const match = eventId.match(/^(.*)-\d+$/);
		const seriesId = match?.[1]?.trim();
		return seriesId || null;
	}

	private buildEventSeriesIndex(): EventSeriesIndex {
		const candidates = new Map<string, Set<string>>();

		for (const event of this.getLoadedCalendarEvents()) {
			const seriesId = this.getPotentialSeriesId(event.id);
			if (!seriesId) continue;

			let eventIds = candidates.get(seriesId);
			if (!eventIds) {
				eventIds = new Set<string>();
				candidates.set(seriesId, eventIds);
			}
			eventIds.add(event.id);
		}

		const seriesIdByEventId = new Map<string, string>();
		const eventIdsBySeriesId = new Map<string, Set<string>>();

		for (const [seriesId, eventIds] of candidates) {
			if (eventIds.size < 2) {
				continue;
			}

			eventIdsBySeriesId.set(seriesId, eventIds);
			for (const eventId of eventIds) {
				seriesIdByEventId.set(eventId, seriesId);
			}
		}

		return { seriesIdByEventId, eventIdsBySeriesId };
	}

	private getRelatedEventIds(eventId: string, seriesIndex: EventSeriesIndex): Set<string> {
		const relatedIds = new Set<string>([eventId]);
		const seriesId = seriesIndex.seriesIdByEventId.get(eventId);
		const storedSeriesId = seriesIndex.eventIdsBySeriesId.has(eventId) ? eventId : seriesId;

		if (storedSeriesId) {
			relatedIds.add(storedSeriesId);
			for (const relatedEventId of seriesIndex.eventIdsBySeriesId.get(storedSeriesId) ?? []) {
				relatedIds.add(relatedEventId);
			}
		}

		return relatedIds;
	}

	private eventIdsMatchSeries(
		storedEventId: string,
		targetEventIds: Set<string>,
		seriesIndex: EventSeriesIndex
	): boolean {
		for (const relatedId of this.getRelatedEventIds(storedEventId, seriesIndex)) {
			if (targetEventIds.has(relatedId)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Count linked notes/tasks per calendar event id in one pass.
	 */
	async getRelatedNoteCountsByEventId(): Promise<Map<string, number>> {
		const pathsByEventId = new Map<string, Set<string>>();
		const icsEventIdField = this.plugin.fieldMapper.toUserField("icsEventId");
		const seriesIndex = this.buildEventSeriesIndex();

		const addReference = (eventIds: unknown, path: string): void => {
			for (const eventId of this.normalizeEventIds(eventIds)) {
				for (const relatedEventId of this.getRelatedEventIds(eventId, seriesIndex)) {
					let paths = pathsByEventId.get(relatedEventId);
					if (!paths) {
						paths = new Set<string>();
						pathsByEventId.set(relatedEventId, paths);
					}
					paths.add(path);
				}
			}
		};

		try {
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			for (const task of allTasks) {
				addReference(task.icsEventId, task.path);
			}

			const noteFiles = this.plugin.app.vault.getMarkdownFiles();
			for (const file of noteFiles) {
				const cache = this.plugin.app.metadataCache.getFileCache(file);
				const frontmatter = cache?.frontmatter;
				if (!frontmatter) continue;
				addReference(frontmatter[icsEventIdField], file.path);
			}
		} catch (error) {
			console.error("Error counting related notes for ICS events:", error);
			return new Map();
		}

		return new Map(
			Array.from(pathsByEventId.entries()).map(([eventId, paths]) => [
				eventId,
				paths.size,
			])
		);
	}

	private normalizeEventIds(value: unknown): string[] {
		const values = Array.isArray(value) ? value : value ? [value] : [];
		return values
			.filter((eventId): eventId is string => typeof eventId === "string")
			.map((eventId) => eventId.trim())
			.filter(Boolean);
	}

	/**
	 * Create a new task from an ICS event
	 */
	async createTaskFromICS(
		icsEvent: ICSEvent,
		overrides?: Partial<TaskCreationData>
	): Promise<{ file: TFile; taskInfo: TaskInfo }> {
		try {
			// Get the subscription name for context
			const subscription = this.plugin.icsSubscriptionService
				.getSubscriptions()
				.find((sub) => sub.id === icsEvent.subscriptionId);
			const subscriptionName = subscription?.name || "Unknown Calendar";

			// Convert ICS event to task creation data
			const scheduledValue =
				overrides?.scheduled !== undefined
					? overrides.scheduled
					: this.computeScheduledFromICSEvent(icsEvent);

			const taskData: TaskCreationData = {
				title: overrides?.title || icsEvent.title,
				status: overrides?.status || this.plugin.settings.defaultTaskStatus,
				priority: overrides?.priority || this.plugin.settings.defaultTaskPriority,
				due:
					overrides?.due !== undefined
						? overrides.due
						: this.plugin.settings.icsIntegration?.useICSEndAsDue
							? this.computeDueFromICSEnd(icsEvent)
							: undefined,
				// Safe date handling per guidelines:
				// - all-day: YYYY-MM-DD (UTC-anchored calendar day)
				// - timed: YYYY-MM-DDTHH:mm (local)
				scheduled: scheduledValue,
				contexts:
					overrides?.contexts || (icsEvent.location ? [icsEvent.location] : undefined),
				projects: overrides?.projects,
				tags: overrides?.tags || [this.plugin.fieldMapper.toUserField("icsEventTag")],
				timeEstimate: overrides?.timeEstimate || this.calculateEventDuration(icsEvent),
				details:
					overrides?.details || this.buildICSEventDetails(icsEvent, subscriptionName),
				icsEventId: [icsEvent.id],
				creationContext: "ics-event",
				dateCreated: getCurrentTimestampForStorage(),
				dateModified: getCurrentTimestampForStorage(),
				// Spread overrides but exclude 'due' since we handle it specially above
				...Object.fromEntries(
					Object.entries(overrides || {}).filter(([key]) => key !== "due")
				),
			};

			// Create the task using the existing TaskService
			// Disable defaults since ICS events have their own data
			return await this.plugin.taskService.createTask(taskData, { applyDefaults: false });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error creating task from ICS event:", {
				error: errorMessage,
				icsEventId: icsEvent.id,
				icsEventTitle: icsEvent.title,
			});
			throw new Error(`Failed to create task from ICS event: ${errorMessage}`);
		}
	}

	/**
	 * Convert ICSEvent.start to a safe scheduled string per guidelines
	 * - All-day -> 'YYYY-MM-DD'
	 * - Timed   -> 'YYYY-MM-DDTHH:mm' (local)
	 */
	private computeScheduledFromICSEvent(icsEvent: ICSEvent): string | undefined {
		try {
			if (!icsEvent.start) return undefined;
			// For all-day events with date-only format (YYYY-MM-DD), append T00:00:00 to parse as local midnight
			const startDateStr =
				icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
					? icsEvent.start + "T00:00:00"
					: icsEvent.start;
			const start = new Date(startDateStr);
			if (icsEvent.allDay) {
				return formatDateForStorage(start);
			}
			// Timed event: store local wall-clock without seconds
			return format(start, "yyyy-MM-dd'T'HH:mm");
		} catch (error) {
			console.warn("Failed to compute scheduled from ICS event start:", {
				start: icsEvent.start,
				error,
			});
			return icsEvent.start; // fallback to raw value
		}
	}

	/**
	 * Convert ICSEvent.end to a safe due date string
	 * - All-day events: Use the start date (ICS all-day events have DTEND as the next day per spec)
	 * - Timed events: Use the actual end time
	 * - No end time: Return undefined
	 */
	private computeDueFromICSEnd(icsEvent: ICSEvent): string | undefined {
		try {
			// No end time means no due date
			if (!icsEvent.end) return undefined;

			// For all-day events, the ICS spec uses DTEND as the day AFTER the event
			// e.g., an all-day event on Feb 12 has DTSTART=20250212 and DTEND=20250213
			// So we use the start date as the due date for all-day events
			if (icsEvent.allDay) {
				if (!icsEvent.start) return undefined;
				const startDateStr = /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
					? icsEvent.start + "T00:00:00"
					: icsEvent.start;
				const startDate = new Date(startDateStr);
				return formatDateForStorage(startDate);
			}

			// Timed event: use the actual end time
			const endDateStr = /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.end)
				? icsEvent.end + "T00:00:00"
				: icsEvent.end;
			const endDate = new Date(endDateStr);
			return format(endDate, "yyyy-MM-dd'T'HH:mm");
		} catch (error) {
			console.warn("Failed to compute due from ICS event end:", {
				end: icsEvent.end,
				error,
			});
			return undefined;
		}
	}

	/**
	 * Create a new note from an ICS event
	 */
	async createNoteFromICS(
		icsEvent: ICSEvent,
		overrides?: { title?: string; folder?: string; template?: string }
	): Promise<{ file: TFile; noteInfo: NoteInfo }> {
		try {
			// Get the subscription name for context
			const subscription = this.plugin.icsSubscriptionService
				.getSubscriptions()
				.find((sub) => sub.id === icsEvent.subscriptionId);
			const subscriptionName = subscription?.name || "Unknown Calendar";

			// For all-day events with date-only format (YYYY-MM-DD), append T00:00:00 to parse as local midnight
			const startDateStr =
				icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
					? icsEvent.start + "T00:00:00"
					: icsEvent.start;
			const eventStartDate = new Date(startDateStr);

			// Determine note title
			const noteTitle =
				overrides?.title || `${icsEvent.title} - ${format(eventStartDate, "PPP")}`;

			// Determine folder (safely handle missing icsIntegration settings)
			const rawFolder =
				overrides?.folder || this.plugin.settings.icsIntegration?.defaultNoteFolder || "";

			// Process folder template with ICS-specific data
			const folder = processFolderTemplate(rawFolder, {
				date: eventStartDate,
				icsData: {
					title: icsEvent.title,
					location: icsEvent.location,
					description: icsEvent.description,
				},
			});

			// Generate filename context for ICS events
			// Use clean event title for filename template variables, not the formatted noteTitle
			const filenameContext: ICSFilenameContext = {
				title: icsEvent.title, // Use clean event title for {title} variable
				priority: "",
				status: "",
				date: eventStartDate,
				dueDate: icsEvent.end,
				scheduledDate: icsEvent.start,
				icsEventTitle: icsEvent.title,
				icsEventLocation: icsEvent.location,
				icsEventDescription: icsEvent.description,
			};

			// Generate unique filename using ICS-specific filename generator
			const baseFilename = generateICSNoteFilename(filenameContext, this.plugin.settings);
			const uniqueFilename = await generateUniqueFilename(
				baseFilename,
				folder,
				this.plugin.app.vault
			);
			const fullPath = folder ? `${folder}/${uniqueFilename}.md` : `${uniqueFilename}.md`;

			// Ensure folder exists
			if (folder) {
				await ensureFolderExists(this.plugin.app.vault, folder);
			}

			// Prepare ICS template data
			const icsTemplateData: ICSTemplateData = {
				title: noteTitle,
				priority: "",
				status: "",
				contexts: icsEvent.location ? [icsEvent.location] : [],
				tags: [this.plugin.fieldMapper.toUserField("icsEventTag")],
				timeEstimate: 0,
				dueDate: icsEvent.end || "",
				scheduledDate: icsEvent.start || "",
				details: icsEvent.description || "",
				parentNote: "",
				icsEventTitle: icsEvent.title,
				icsEventStart: icsEvent.start,
				icsEventEnd: icsEvent.end || "",
				icsEventLocation: icsEvent.location || "",
				icsEventDescription: icsEvent.description || "",
				icsEventUrl: icsEvent.url || "",
				icsEventSubscription: subscriptionName,
				icsEventId: icsEvent.id,
			};

			// Process template if provided
			const dateCreatedField = this.plugin.fieldMapper.toUserField("dateCreated");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			let frontmatter: Record<string, unknown> = {
				title: noteTitle,
				[dateCreatedField]: getCurrentTimestampForStorage(),
				[dateModifiedField]: getCurrentTimestampForStorage(),
				tags: [this.plugin.fieldMapper.toUserField("icsEventTag")],
				[this.plugin.fieldMapper.toUserField("icsEventId")]: [icsEvent.id],
			};

			let bodyContent = this.buildICSEventDetails(icsEvent, subscriptionName);

			if (overrides?.template) {
				try {
					const templatePath = normalizePath(overrides.template.trim());
					const templateFile = this.plugin.app.vault.getAbstractFileByPath(
						templatePath.endsWith(".md") ? templatePath : `${templatePath}.md`
					);

					if (templateFile instanceof TFile) {
						const templateContent = await this.plugin.app.vault.read(templateFile);
						const processed = processTemplate(templateContent, icsTemplateData);

						frontmatter = { ...frontmatter, ...processed.frontmatter };
						bodyContent = processed.body || bodyContent;
					} else {
						console.warn(`ICS note template not found: ${templatePath}`);
						new Notice(
							this.translate("services.icsNote.notices.templateNotFound", {
								path: templatePath,
							})
						);
					}
				} catch (error) {
					console.error("Error processing ICS note template:", error);
					new Notice(
						this.translate("services.icsNote.notices.templateProcessError", {
							template: overrides.template,
						})
					);
				}
			}

			// Create file content
			const yamlHeader =
				Object.keys(frontmatter).length > 0
					? `---\n${Object.entries(frontmatter)
							.map(([key, value]) => `${key}: ${this.formatYamlValue(value)}`)
							.join("\n")}\n---\n\n`
					: "";
			const content = `${yamlHeader}${bodyContent}`;

				// Create the file
				const file = await this.plugin.app.vault.create(fullPath, content);

				const noteTags = Array.isArray(frontmatter.tags)
					? frontmatter.tags.filter((tag): tag is string => typeof tag === "string")
					: [];
				const createdDate =
					typeof frontmatter[dateCreatedField] === "string"
						? frontmatter[dateCreatedField]
						: undefined;

				// Create NoteInfo object
				const noteInfo: NoteInfo = {
					title: noteTitle,
					path: file.path,
					tags: noteTags,
					createdDate,
					lastModified: Date.now(),
				};

			return { file, noteInfo };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error creating note from ICS event:", {
				error: errorMessage,
				icsEventId: icsEvent.id,
				icsEventTitle: icsEvent.title,
			});
			throw new Error(`Failed to create note from ICS event: ${errorMessage}`);
		}
	}

	/**
	 * Find existing notes linked to an ICS event
	 */
	async findRelatedNotes(icsEvent: ICSEvent): Promise<(TaskInfo | NoteInfo)[]> {
		try {
			const relatedNotes: (TaskInfo | NoteInfo)[] = [];
			const relatedPaths = new Set<string>();
			const icsEventIdField = this.plugin.fieldMapper.toUserField("icsEventId");
			const seriesIndex = this.buildEventSeriesIndex();
			const targetEventIds = this.getRelatedEventIds(icsEvent.id, seriesIndex);
			const hasLinkedEventId = (eventIds: unknown): boolean =>
				this.normalizeEventIds(eventIds).some((eventId) =>
					this.eventIdsMatchSeries(eventId, targetEventIds, seriesIndex)
				);

			// Search through cached tasks
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			for (const task of allTasks) {
				if (hasLinkedEventId(task.icsEventId)) {
					if (relatedPaths.has(task.path)) continue;
					relatedNotes.push(task);
					relatedPaths.add(task.path);
				}
			}

			// Search through notes (this is more expensive as we need to read frontmatter)
			const noteFiles = this.plugin.app.vault.getMarkdownFiles();
			for (const file of noteFiles) {
				try {
					const cache = this.plugin.app.metadataCache.getFileCache(file);
					const frontmatter = cache?.frontmatter;

					if (frontmatter && hasLinkedEventId(frontmatter[icsEventIdField])) {
						if (relatedPaths.has(file.path)) continue;
						const noteInfo: NoteInfo = {
							title: frontmatter.title || file.basename,
							path: file.path,
							tags: frontmatter.tags || [],
							createdDate: frontmatter.dateCreated,
							lastModified: file.stat.mtime,
						};
						relatedNotes.push(noteInfo);
						relatedPaths.add(file.path);
					}
				} catch {
					// Skip files that can't be read
					continue;
				}
			}

			return relatedNotes;
		} catch (error) {
			console.error("Error finding related notes for ICS event:", error);
			return [];
		}
	}

	/**
	 * Link an existing note to an ICS event
	 */
	async linkNoteToICS(notePath: string, icsEvent: ICSEvent): Promise<void> {
		try {
			const file = this.plugin.app.vault.getAbstractFileByPath(notePath);
			if (!(file instanceof TFile)) {
				throw new Error(`Cannot find note file: ${notePath}`);
			}

			// Update the note's frontmatter to include the ICS event ID
			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const icsEventIdField = this.plugin.fieldMapper.toUserField("icsEventId");

				// Get existing ICS event IDs or create new array
				let existingIds = frontmatter[icsEventIdField];
				if (!existingIds) {
					existingIds = [];
				} else if (!Array.isArray(existingIds)) {
					// Convert single value to array for backwards compatibility
					existingIds = [existingIds];
				}

				// Add new event ID if not already present
				if (!existingIds.includes(icsEvent.id)) {
					existingIds.push(icsEvent.id);
				}

				frontmatter[icsEventIdField] = existingIds;
				const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
				frontmatter[dateModifiedField] = getCurrentTimestampForStorage();
			});

			new Notice(
				this.translate("services.icsNote.notices.linkedToEvent", { title: icsEvent.title })
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error linking note to ICS event:", {
				error: errorMessage,
				notePath,
				icsEventId: icsEvent.id,
			});
			throw new Error(`Failed to link note to ICS event: ${errorMessage}`);
		}
	}

	/**
	 * Build default event details from ICS event data
	 */
	private buildICSEventDetails(icsEvent: ICSEvent, subscriptionName: string): string {
		const details: string[] = [];

		details.push(`# ${icsEvent.title}`);
		details.push("");

		if (icsEvent.start) {
			// For all-day events with date-only format (YYYY-MM-DD), append T00:00:00 to parse as local midnight
			const startDateStr =
				icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
					? icsEvent.start + "T00:00:00"
					: icsEvent.start;
			const startDate = new Date(startDateStr);
			details.push(`**Start:** ${format(startDate, "PPPp")}`);
		}

		if (icsEvent.end && !icsEvent.allDay) {
			const endDateStr = /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.end)
				? icsEvent.end + "T00:00:00"
				: icsEvent.end;
			const endDate = new Date(endDateStr);
			details.push(`**End:** ${format(endDate, "PPPp")}`);
		}

		if (icsEvent.location) {
			details.push(`**Location:** ${icsEvent.location}`);
		}

		details.push(`**Calendar:** ${subscriptionName}`);

		if (icsEvent.description) {
			details.push("");
			details.push("## Description");
			details.push(icsEvent.description);
		}

		if (icsEvent.url) {
			details.push("");
			details.push(`**Event URL:** ${icsEvent.url}`);
		}

		return details.join("\n");
	}

	/**
	 * Format a value for YAML frontmatter
	 */
	private formatYamlValue(value: unknown): string {
		if (typeof value === "string") {
			// Simple check for strings that need quoting
			if (
				value.includes(":") ||
				value.includes("#") ||
				value.includes("[") ||
				value.includes("{")
			) {
				return `"${value.replace(/"/g, '\\"')}"`;
			}
			return value;
		}
		if (Array.isArray(value)) {
			return `[${value.map((v) => (typeof v === "string" ? `"${v}"` : v)).join(", ")}]`;
		}
		return String(value);
	}

	/**
	 * Calculate event duration in minutes
	 */
	private calculateEventDuration(icsEvent: ICSEvent): number | undefined {
		if (!icsEvent.start || !icsEvent.end) {
			return undefined;
		}

		try {
			// For all-day events with date-only format (YYYY-MM-DD), append T00:00:00 to parse as local midnight
			const startDateStr =
				icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
					? icsEvent.start + "T00:00:00"
					: icsEvent.start;
			const endDateStr =
				icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.end)
					? icsEvent.end + "T00:00:00"
					: icsEvent.end;

			const startTime = new Date(startDateStr).getTime();
			const endTime = new Date(endDateStr).getTime();

			if (isNaN(startTime) || isNaN(endTime)) {
				return undefined;
			}

			const durationMs = endTime - startTime;
			const durationMinutes = Math.round(durationMs / (1000 * 60));

			// Return duration only if it's positive and reasonable (less than 24 hours)
			return durationMinutes > 0 && durationMinutes < 1440 ? durationMinutes : undefined;
		} catch (error) {
			console.warn("Error calculating event duration:", error);
			return undefined;
		}
	}
}
