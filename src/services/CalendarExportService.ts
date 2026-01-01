import { TaskInfo } from "../types";
import { format, parseISO } from "date-fns";
import { Notice } from "obsidian";
import { TranslationKey } from "../i18n";

export interface CalendarURLOptions {
	type: "google" | "outlook" | "yahoo" | "ics";
	task: TaskInfo;
	useScheduledAsDue?: boolean; // If task has no due date, use scheduled as end time
}

export interface ICSExportOptions {
	useDurationForExport?: boolean; // Use timeEstimate (duration) instead of due date for DTEND
}

type TranslateFn = (key: TranslationKey, variables?: Record<string, any>) => string;

export class CalendarExportService {
	/**
	 * Generate a calendar URL for adding a task as an event
	 */
	static generateCalendarURL(options: CalendarURLOptions): string {
		const { type, task, useScheduledAsDue = true } = options;

		switch (type) {
			case "google":
				return this.generateGoogleCalendarURL(task, useScheduledAsDue);
			case "outlook":
				return this.generateOutlookCalendarURL(task, useScheduledAsDue);
			case "yahoo":
				return this.generateYahooCalendarURL(task, useScheduledAsDue);
			case "ics":
				return this.generateICSDownloadURL(task);
			default:
				throw new Error(`Unsupported calendar type: ${type}`);
		}
	}

	/**
	 * Open calendar URL in browser
	 */
	static openCalendarURL(options: CalendarURLOptions, translate?: TranslateFn): void {
		try {
			const url = this.generateCalendarURL(options);
			window.open(url, "_blank");
		} catch (error) {
			console.error("Failed to generate calendar URL:", error);
			new Notice(
				translate
					? translate("services.calendarExport.notices.generateLinkFailed")
					: "Failed to generate calendar link"
			);
		}
	}

	/**
	 * Generate Google Calendar URL
	 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...
	 */
	private static generateGoogleCalendarURL(task: TaskInfo, useScheduledAsDue: boolean): string {
		const baseURL = "https://calendar.google.com/calendar/render";
		const params = new URLSearchParams();

		params.append("action", "TEMPLATE");
		params.append("text", task.title);

		// Handle dates
		const dates = this.formatGoogleDates(task, useScheduledAsDue);
		if (dates) {
			params.append("dates", dates);
		}

		// Add description
		const description = this.buildDescription(task);
		if (description) {
			params.append("details", description);
		}

		// Add location from contexts
		if (task.contexts && task.contexts.length > 0) {
			params.append("location", task.contexts.join(", "));
		}

		return `${baseURL}?${params.toString()}`;
	}

	/**
	 * Generate Outlook Calendar URL
	 * Format: https://outlook.live.com/calendar/0/deeplink/compose?...
	 */
	private static generateOutlookCalendarURL(task: TaskInfo, useScheduledAsDue: boolean): string {
		const baseURL = "https://outlook.live.com/calendar/0/deeplink/compose";
		const params = new URLSearchParams();

		params.append("subject", task.title);

		// Handle dates
		const { startISO, endISO } = this.getTaskDateRange(task, useScheduledAsDue);
		if (startISO) {
			params.append("startdt", startISO);
		}
		if (endISO) {
			params.append("enddt", endISO);
		}

		// Add description
		const description = this.buildDescription(task);
		if (description) {
			params.append("body", description);
		}

		// Add location from contexts
		if (task.contexts && task.contexts.length > 0) {
			params.append("location", task.contexts.join(", "));
		}

		params.append("path", "/calendar/action/compose");
		params.append("rru", "addevent");

		return `${baseURL}?${params.toString()}`;
	}

	/**
	 * Generate Yahoo Calendar URL
	 * Format: https://calendar.yahoo.com/?v=60&title=...
	 */
	private static generateYahooCalendarURL(task: TaskInfo, useScheduledAsDue: boolean): string {
		const baseURL = "https://calendar.yahoo.com/";
		const params = new URLSearchParams();

		params.append("v", "60"); // Required parameter
		params.append("title", task.title);

		// Handle dates (Yahoo uses YYYYMMDDTHHmmss format)
		const { startYahoo, endYahoo } = this.getYahooDateFormat(task, useScheduledAsDue);
		if (startYahoo) {
			params.append("st", startYahoo);
		}
		if (endYahoo) {
			params.append("et", endYahoo);
		}

		// Add description
		const description = this.buildDescription(task);
		if (description) {
			params.append("desc", description);
		}

		// Add location from contexts
		if (task.contexts && task.contexts.length > 0) {
			params.append("in_loc", task.contexts.join(", "));
		}

		return `${baseURL}?${params.toString()}`;
	}

	/**
	 * Generate ICS download URL (data URL)
	 */
	private static generateICSDownloadURL(task: TaskInfo): string {
		const icsContent = this.generateICSContent(task);
		const encodedContent = encodeURIComponent(icsContent);
		return `data:text/calendar;charset=utf8,${encodedContent}`;
	}

	/**
	 * Generate ICS file content
	 */
	static generateICSContent(task: TaskInfo, options?: ICSExportOptions): string {
		const uid = `${task.path.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}@tasknotes`;
		const now = new Date()
			.toISOString()
			.replace(/[-:]/g, "")
			.replace(/\.\d{3}/, "");

		const lines = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//TaskNotes//Task Export//EN",
			"CALSCALE:GREGORIAN",
			"METHOD:PUBLISH",
			"BEGIN:VEVENT",
			`UID:${uid}`,
			`DTSTAMP:${now}`,
		];

		// Add title
		lines.push(`SUMMARY:${this.escapeICSText(task.title)}`);

		// Add dates
		const { startICS, endICS } = this.getICSDateFormat(task, true, options);
		if (startICS) {
			lines.push(`DTSTART:${startICS}`);
		}
		if (endICS) {
			lines.push(`DTEND:${endICS}`);
		}

		// Add description
		const description = this.buildDescription(task);
		if (description) {
			lines.push(`DESCRIPTION:${this.escapeICSText(description)}`);
		}

		// Add location from contexts
		if (task.contexts && task.contexts.length > 0) {
			lines.push(`LOCATION:${this.escapeICSText(task.contexts.join(", "))}`);
		}

		// Add categories from tags
		if (task.tags && task.tags.length > 0) {
			lines.push(`CATEGORIES:${task.tags.map((t) => this.escapeICSText(t)).join(",")}`);
		}

		// Map priority (ICS uses 1-9, with 1 being highest)
		if (task.priority) {
			const priorityMap: Record<string, string> = {
				highest: "1",
				high: "3",
				medium: "5",
				low: "7",
				lowest: "9",
			};
			const icsPriority = priorityMap[task.priority] || "5";
			lines.push(`PRIORITY:${icsPriority}`);
		}

		// Map status
		if (task.status) {
			const statusMap: Record<string, string> = {
				done: "COMPLETED",
				"in-progress": "IN-PROCESS",
				todo: "NEEDS-ACTION",
				cancelled: "CANCELLED",
			};
			const icsStatus = statusMap[task.status] || "NEEDS-ACTION";
			lines.push(`STATUS:${icsStatus}`);
		}

		lines.push("END:VEVENT");
		lines.push("END:VCALENDAR");

		return lines.join("\r\n");
	}

	/**
	 * Build description text from task
	 */
	private static buildDescription(task: TaskInfo): string {
		const parts: string[] = [];

		// Add metadata
		const metadata: string[] = [];

		if (task.priority) {
			metadata.push(`Priority: ${task.priority}`);
		}

		if (task.status) {
			metadata.push(`Status: ${task.status}`);
		}

		if (task.projects && task.projects.length > 0) {
			metadata.push(`Projects: ${task.projects.join(", ")}`);
		}

		if (task.tags && task.tags.length > 0) {
			metadata.push(`Tags: ${task.tags.join(", ")}`);
		}

		if (task.contexts && task.contexts.length > 0) {
			metadata.push(`Contexts: ${task.contexts.join(", ")}`);
		}

		if (task.timeEstimate) {
			metadata.push(`Estimated time: ${task.timeEstimate} minutes`);
		}

		if (metadata.length > 0) {
			parts.push(...metadata);
		}

		// Add note about source
		if (parts.length > 0) parts.push("");
		parts.push(`Exported from TaskNotes: ${task.path}`);

		return parts.join("\n");
	}

	/**
	 * Format dates for Google Calendar (YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ)
	 */
	private static formatGoogleDates(task: TaskInfo, useScheduledAsDue: boolean): string | null {
		const { startICS, endICS } = this.getICSDateFormat(task, useScheduledAsDue);

		if (!startICS) return null;

		// Google expects format: YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
		if (endICS) {
			return `${startICS}/${endICS}`;
		}

		// For single time, create a 1-hour event
		const start = this.parseICSDate(startICS);
		const end = new Date(start.getTime() + 60 * 60 * 1000); // Add 1 hour
		const endFormatted = this.formatDateToICS(end);

		return `${startICS}/${endFormatted}`;
	}

	/**
	 * Get task date range in ISO format
	 */
	private static getTaskDateRange(
		task: TaskInfo,
		useScheduledAsDue: boolean,
		options?: ICSExportOptions
	): { startISO: string | null; endISO: string | null } {
		let startISO: string | null = null;
		let endISO: string | null = null;

		if (task.scheduled) {
			try {
				const scheduledDate = this.parseTaskDate(task.scheduled);
				startISO = scheduledDate.toISOString();
			} catch (e) {
				console.warn("Invalid scheduled date:", task.scheduled);
			}
		}

		// When useDurationForExport is enabled, use timeEstimate to calculate end time
		// instead of using due date
		if (options?.useDurationForExport && startISO && task.timeEstimate && task.timeEstimate > 0) {
			// Use scheduled + timeEstimate (in minutes) as end time
			const start = new Date(startISO);
			const end = new Date(start.getTime() + task.timeEstimate * 60 * 1000);
			endISO = end.toISOString();
		} else if (task.due) {
			try {
				const dueDate = this.parseTaskDate(task.due);
				endISO = dueDate.toISOString();
			} catch (e) {
				console.warn("Invalid due date:", task.due);
			}
		} else if (useScheduledAsDue && startISO) {
			// Use scheduled + 1 hour as end time (default fallback)
			const start = new Date(startISO);
			const end = new Date(start.getTime() + 60 * 60 * 1000);
			endISO = end.toISOString();
		}

		return { startISO, endISO };
	}

	/**
	 * Format dates for Yahoo Calendar (YYYYMMDDTHHMMSS)
	 */
	private static getYahooDateFormat(
		task: TaskInfo,
		useScheduledAsDue: boolean
	): { startYahoo: string | null; endYahoo: string | null } {
		const { startISO, endISO } = this.getTaskDateRange(task, useScheduledAsDue);

		const formatYahoo = (isoString: string): string => {
			const date = new Date(isoString);
			return format(date, "yyyyMMdd'T'HHmmss");
		};

		return {
			startYahoo: startISO ? formatYahoo(startISO) : null,
			endYahoo: endISO ? formatYahoo(endISO) : null,
		};
	}

	/**
	 * Format dates for ICS format (YYYYMMDDTHHMMSSZ)
	 */
	private static getICSDateFormat(
		task: TaskInfo,
		useScheduledAsDue = true,
		options?: ICSExportOptions
	): { startICS: string | null; endICS: string | null } {
		const { startISO, endISO } = this.getTaskDateRange(task, useScheduledAsDue, options);

		const formatICS = (isoString: string): string => {
			const date = new Date(isoString);
			return this.formatDateToICS(date);
		};

		return {
			startICS: startISO ? formatICS(startISO) : null,
			endICS: endISO ? formatICS(endISO) : null,
		};
	}

	/**
	 * Format a Date object to ICS date format
	 */
	private static formatDateToICS(date: Date): string {
		return date
			.toISOString()
			.replace(/[-:]/g, "")
			.replace(/\.\d{3}/, "");
	}

	/**
	 * Parse ICS date format back to Date object
	 */
	private static parseICSDate(icsDate: string): Date {
		// YYYYMMDDTHHMMSSZ -> YYYY-MM-DDTHH:MM:SSZ
		const year = icsDate.substr(0, 4);
		const month = icsDate.substr(4, 2);
		const day = icsDate.substr(6, 2);
		const hour = icsDate.substr(9, 2);
		const minute = icsDate.substr(11, 2);
		const second = icsDate.substr(13, 2);

		return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
	}

	/**
	 * Parse task date string to Date object
	 */
	private static parseTaskDate(dateStr: string): Date {
		// Handle different date formats
		if (dateStr.includes("T")) {
			// ISO format or local datetime
			return parseISO(dateStr);
		} else {
			// Date only - assume start of day
			return parseISO(`${dateStr}T00:00:00`);
		}
	}

	/**
	 * Escape text for ICS format
	 */
	private static escapeICSText(text: string): string {
		return text
			.replace(/\\/g, "\\\\")
			.replace(/;/g, "\\;")
			.replace(/,/g, "\\,")
			.replace(/\n/g, "\\n")
			.replace(/\r/g, "");
	}

	/**
	 * Fold ICS lines to comply with RFC 5545 (max 75 octets per line)
	 */
	private static foldICSLines(content: string): string {
		const lines = content.split("\r\n");
		const foldedLines: string[] = [];

		lines.forEach((line) => {
			if (line.length <= 75) {
				foldedLines.push(line);
			} else {
				// Fold long lines by breaking at 75 characters and continuing with space
				let remainingLine = line;
				while (remainingLine.length > 75) {
					foldedLines.push(remainingLine.substring(0, 75));
					remainingLine = " " + remainingLine.substring(75); // Continue with space
				}
				if (remainingLine.length > 0) {
					foldedLines.push(remainingLine);
				}
			}
		});

		return foldedLines.join("\r\n");
	}

	/**
	 * Generate ICS content for multiple tasks
	 */
	static generateMultipleTasksICSContent(tasks: TaskInfo[], options?: ICSExportOptions): string {
		const now = new Date()
			.toISOString()
			.replace(/[-:]/g, "")
			.replace(/\.\d{3}/, "");

		const lines = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//TaskNotes//EN",
			"CALSCALE:GREGORIAN",
		];

		// Add each task as a VEVENT
		tasks.forEach((task, index) => {
			const uid = `${task.path.replace(/[^a-zA-Z0-9]/g, "-")}-${index}-${Date.now()}@tasknotes`;

			lines.push("BEGIN:VEVENT");
			lines.push(`UID:${uid}`);
			lines.push(`DTSTAMP:${now}`);

			// Add title
			lines.push(`SUMMARY:${this.escapeICSText(task.title)}`);

			// Add dates - ensure every event has a DTSTART (required by ICS standard)
			let { startICS, endICS } = this.getICSDateFormat(task, true, options);

			// If no start date, use task creation date or current date as fallback
			if (!startICS) {
				let fallbackDate: Date;
				if (task.dateCreated) {
					// Use task creation date if available
					fallbackDate = new Date(task.dateCreated);
				} else {
					// Fallback to current date
					fallbackDate = new Date();
				}
				startICS = this.formatDateToICS(fallbackDate);

				// Set end time to 1 hour after start for tasks without duration
				if (!endICS) {
					const endDate = new Date(fallbackDate.getTime() + 60 * 60 * 1000); // +1 hour
					endICS = this.formatDateToICS(endDate);
				}
			} else if (!endICS) {
				// If we have start but no end, add 1 hour duration
				const startDate = this.parseICSDate(startICS);
				const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
				endICS = this.formatDateToICS(endDate);
			}

			lines.push(`DTSTART:${startICS}`);
			lines.push(`DTEND:${endICS}`);

			// Add description
			const description = this.buildDescription(task);
			if (description) {
				lines.push(`DESCRIPTION:${this.escapeICSText(description)}`);
			}

			// Add location from contexts
			if (task.contexts && task.contexts.length > 0) {
				lines.push(`LOCATION:${this.escapeICSText(task.contexts.join(", "))}`);
			}

			// Add categories from tags
			if (task.tags && task.tags.length > 0) {
				lines.push(`CATEGORIES:${task.tags.map((t) => this.escapeICSText(t)).join(",")}`);
			}

			// Map priority (ICS uses 1-9, with 1 being highest)
			if (task.priority) {
				const priorityMap: Record<string, string> = {
					highest: "1",
					high: "3",
					medium: "5",
					low: "7",
					lowest: "9",
				};
				const icsPriority = priorityMap[task.priority] || "5";
				lines.push(`PRIORITY:${icsPriority}`);
			}

			// Map status
			if (task.status) {
				const statusMap: Record<string, string> = {
					done: "COMPLETED",
					"in-progress": "IN-PROCESS",
					todo: "NEEDS-ACTION",
					cancelled: "CANCELLED",
				};
				const icsStatus = statusMap[task.status] || "NEEDS-ACTION";
				lines.push(`STATUS:${icsStatus}`);
			}

			lines.push("END:VEVENT");
		});

		lines.push("END:VCALENDAR");

		// Join lines and ensure proper ICS line folding (max 75 chars per line)
		return this.foldICSLines(lines.join("\r\n"));
	}

	/**
	 * Download ICS file for all tasks
	 */
	static downloadAllTasksICSFile(tasks: TaskInfo[], translate?: TranslateFn, options?: ICSExportOptions): void {
		try {
			if (!tasks || tasks.length === 0) {
				new Notice(
					translate
						? translate("services.calendarExport.notices.noTasksToExport")
						: "No tasks found to export"
				);
				return;
			}

			const icsContent = this.generateMultipleTasksICSContent(tasks, options);
			const blob = new Blob([icsContent], { type: "text/calendar" });
			const url = URL.createObjectURL(blob);

			const date = new Date().toISOString().split("T")[0];
			const filename = `tasknotes-all-tasks-${date}.ics`;

			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();

			URL.revokeObjectURL(url);

			const pluralSuffix = tasks.length === 1 ? "" : "s";
			new Notice(
				translate
					? translate("services.calendarExport.notices.downloadSuccess", {
							filename,
							count: tasks.length,
							plural: pluralSuffix,
						})
					: `Downloaded ${filename} with ${tasks.length} task${pluralSuffix}`
			);
		} catch (error) {
			console.error("Failed to download all tasks ICS file:", error);
			new Notice(
				translate
					? translate("services.calendarExport.notices.downloadFailed")
					: "Failed to download calendar file"
			);
		}
	}

	/**
	 * Download ICS file for a task
	 */
	static downloadICSFile(task: TaskInfo, translate?: TranslateFn, options?: ICSExportOptions): void {
		try {
			const icsContent = this.generateICSContent(task, options);
			const blob = new Blob([icsContent], { type: "text/calendar" });
			const url = URL.createObjectURL(blob);

			const filename = `${task.title.replace(/[^a-zA-Z0-9]/g, "-")}.ics`;

			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();

			URL.revokeObjectURL(url);

			new Notice(
				translate
					? translate("services.calendarExport.notices.singleDownloadSuccess", {
							filename,
						})
					: `Downloaded ${filename}`
			);
		} catch (error) {
			console.error("Failed to download ICS file:", error);
			new Notice(
				translate
					? translate("services.calendarExport.notices.downloadFailed")
					: "Failed to download calendar file"
			);
		}
	}
}
