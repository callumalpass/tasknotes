import { TFile, Notice, normalizePath } from "obsidian";
import { format } from "date-fns";
import { processFolderTemplate } from "../utils/folderTemplateProcessor";
import TaskNotesPlugin from "../main";
import { ICSEvent, TaskInfo, NoteInfo, TaskCreationData } from "../types";
import { getCurrentTimestamp, formatDateForStorage } from "../utils/dateUtils";
import {
	generateICSNoteFilename,
	generateUniqueFilename,
	ICSFilenameContext,
} from "../utils/filenameGenerator";
import { ensureFolderExists } from "../utils/helpers";
import { processTemplate, ICSTemplateData } from "../utils/templateProcessor";
import { TranslationKey } from "../i18n";

/**
 * Service for creating notes and tasks from ICS calendar events
 */
export class ICSNoteService {
	constructor(private plugin: TaskNotesPlugin) {}

	private translate(key: TranslationKey, variables?: Record<string, any>): string {
		return this.plugin.i18n.translate(key, variables);
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
				due: overrides?.due || undefined, // Don't set due date from ICS events
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
				dateCreated: getCurrentTimestamp(),
				dateModified: getCurrentTimestamp(),
				...overrides,
			};

			// Create the task using the existing TaskService
			return await this.plugin.taskService.createTask(taskData);
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
			const startDateStr = icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
				? icsEvent.start + 'T00:00:00'
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
			const startDateStr = icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
				? icsEvent.start + 'T00:00:00'
				: icsEvent.start;
			const eventStartDate = new Date(startDateStr);

			// Determine note title
			const noteTitle =
				overrides?.title ||
				`${icsEvent.title} - ${format(eventStartDate, "PPP")}`;

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
			let frontmatter: Record<string, any> = {
				title: noteTitle,
				[dateCreatedField]: getCurrentTimestamp(),
				[dateModifiedField]: getCurrentTimestamp(),
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

			// Create NoteInfo object
			const noteInfo: NoteInfo = {
				title: noteTitle,
				path: file.path,
				tags: frontmatter.tags || [],
				createdDate: frontmatter.dateCreated,
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
			const icsEventIdField = this.plugin.fieldMapper.toUserField("icsEventId");

			// Search through cached tasks
			const allTasks = await this.plugin.cacheManager.getAllTasks();
			for (const task of allTasks) {
				if (task.icsEventId && task.icsEventId.includes(icsEvent.id)) {
					relatedNotes.push(task);
				}
			}

			// Search through notes (this is more expensive as we need to read frontmatter)
			const noteFiles = this.plugin.app.vault.getMarkdownFiles();
			for (const file of noteFiles) {
				try {
					const cache = this.plugin.app.metadataCache.getFileCache(file);
					const frontmatter = cache?.frontmatter;

					const icsEventIds = frontmatter?.[icsEventIdField];
					const hasEventId = Array.isArray(icsEventIds)
						? icsEventIds.includes(icsEvent.id)
						: icsEventIds === icsEvent.id; // backwards compatibility

					if (frontmatter && hasEventId) {
						const noteInfo: NoteInfo = {
							title: frontmatter.title || file.basename,
							path: file.path,
							tags: frontmatter.tags || [],
							createdDate: frontmatter.dateCreated,
							lastModified: file.stat.mtime,
						};
						relatedNotes.push(noteInfo);
					}
				} catch (error) {
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
				frontmatter[dateModifiedField] = getCurrentTimestamp();
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
			const startDateStr = icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
				? icsEvent.start + 'T00:00:00'
				: icsEvent.start;
			const startDate = new Date(startDateStr);
			details.push(`**Start:** ${format(startDate, "PPPp")}`);
		}

		if (icsEvent.end && !icsEvent.allDay) {
			const endDateStr = /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.end)
				? icsEvent.end + 'T00:00:00'
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
	private formatYamlValue(value: any): string {
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
			const startDateStr = icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.start)
				? icsEvent.start + 'T00:00:00'
				: icsEvent.start;
			const endDateStr = icsEvent.allDay && /^\d{4}-\d{2}-\d{2}$/.test(icsEvent.end)
				? icsEvent.end + 'T00:00:00'
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
