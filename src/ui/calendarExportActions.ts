import type { TranslationKey } from "../i18n";
import {
	CalendarExportService,
	type CalendarURLOptions,
	type ICSDownloadFile,
	type ICSExportOptions,
} from "../services/CalendarExportService";
import type { TaskInfo } from "../types";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { showNotice } from "./notifications";

const tasknotesLogger = createTaskNotesLogger({ tag: "UI/CalendarExportActions" });

type TranslateFn = (key: TranslationKey, variables?: Record<string, unknown>) => string;

function translateOrDefault(
	translate: TranslateFn | undefined,
	key: TranslationKey,
	fallback: string,
	variables?: Record<string, unknown>
): string {
	return translate ? translate(key, variables) : fallback;
}

function downloadICSFile(download: ICSDownloadFile): void {
	const blob = new Blob([download.content], { type: "text/calendar" });
	const url = URL.createObjectURL(blob);

	try {
		const anchor = activeDocument.createElement("a");
		anchor.href = url;
		anchor.download = download.filename;
		anchor.click();
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function openCalendarURL(options: CalendarURLOptions, translate?: TranslateFn): void {
	try {
		const url = CalendarExportService.generateCalendarURL(options);
		window.open(url, "_blank");
	} catch (error) {
		tasknotesLogger.error("Failed to generate calendar URL:", {
			category: "provider",
			operation: "generate-calendar-url",
			error: error,
		});
		showNotice(
			translateOrDefault(
				translate,
				"services.calendarExport.notices.generateLinkFailed",
				"Failed to generate calendar link"
			)
		);
	}
}

export function downloadAllTasksICSFile(
	tasks: TaskInfo[],
	translate?: TranslateFn,
	options?: ICSExportOptions
): void {
	try {
		const download = CalendarExportService.createMultipleTasksICSDownload(tasks, options);
		if (!download) {
			showNotice(
				translateOrDefault(
					translate,
					"services.calendarExport.notices.noTasksToExport",
					"No tasks found to export"
				)
			);
			return;
		}

		downloadICSFile(download);

		const pluralSuffix = download.taskCount === 1 ? "" : "s";
		showNotice(
			translateOrDefault(
				translate,
				"services.calendarExport.notices.downloadSuccess",
				`Downloaded ${download.filename} with ${download.taskCount} task${pluralSuffix}`,
				{
					filename: download.filename,
					count: download.taskCount,
					plural: pluralSuffix,
				}
			)
		);
	} catch (error) {
		tasknotesLogger.error("Failed to download all tasks ICS file:", {
			category: "provider",
			operation: "download-all-tasks-ics-file",
			error: error,
		});
		showNotice(
			translateOrDefault(
				translate,
				"services.calendarExport.notices.downloadFailed",
				"Failed to download calendar file"
			)
		);
	}
}

export function downloadTaskICSFile(
	task: TaskInfo,
	translate?: TranslateFn,
	options?: ICSExportOptions
): void {
	try {
		const download = CalendarExportService.createTaskICSDownload(task, options);
		downloadICSFile(download);

		showNotice(
			translateOrDefault(
				translate,
				"services.calendarExport.notices.singleDownloadSuccess",
				`Downloaded ${download.filename}`,
				{ filename: download.filename }
			)
		);
	} catch (error) {
		tasknotesLogger.error("Failed to download ICS file:", {
			category: "provider",
			operation: "download-ics-file",
			error: error,
		});
		showNotice(
			translateOrDefault(
				translate,
				"services.calendarExport.notices.downloadFailed",
				"Failed to download calendar file"
			)
		);
	}
}
