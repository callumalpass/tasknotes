import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "../i18n";
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

type TranslateFn = (key: MessageDescriptor, variables?: Record<string, unknown>) => string;

function translateOrDefault(
	translate: TranslateFn | undefined,
	key: MessageDescriptor,
	variables?: Record<string, unknown>
): string {
	return translate ? translate(key, variables) : uiText(key, variables);
}

function downloadICSFile(download: ICSDownloadFile): void {
	const blob = new Blob([download.content], { type: "text/calendar" });
	const url = URL.createObjectURL(blob);

	try {
		const anchor = activeWindow.createEl("a");
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
			translateOrDefault(translate, msg({ message: "Failed to generate calendar link", context: "services.calendarExport.notices.generateLinkFailed" }))
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
				translateOrDefault(translate, msg({ message: "No tasks found to export", context: "services.calendarExport.notices.noTasksToExport" }))
			);
			return;
		}

		downloadICSFile(download);

		showNotice(
			translateOrDefault(translate, msg({ message: "{count, plural, one {Downloaded {filename} with {count, number} task} other {Downloaded {filename} with {count, number} tasks}}", context: "services.calendarExport.notices.downloadSuccess" }), {
					filename: download.filename,
					count: download.taskCount,
				})
		);
	} catch (error) {
		tasknotesLogger.error("Failed to download all tasks ICS file:", {
			category: "provider",
			operation: "download-all-tasks-ics-file",
			error: error,
		});
		showNotice(
			translateOrDefault(translate, msg({ message: "Failed to download calendar file", context: "services.calendarExport.notices.downloadFailed" }))
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
			translateOrDefault(translate, msg({ message: "Downloaded {filename}", context: "services.calendarExport.notices.singleDownloadSuccess" }), { filename: download.filename })
		);
	} catch (error) {
		tasknotesLogger.error("Failed to download ICS file:", {
			category: "provider",
			operation: "download-ics-file",
			error: error,
		});
		showNotice(
			translateOrDefault(translate, msg({ message: "Failed to download calendar file", context: "services.calendarExport.notices.downloadFailed" }))
		);
	}
}
