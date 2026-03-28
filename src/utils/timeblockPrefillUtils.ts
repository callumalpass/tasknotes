import { TaskInfo } from "../types";
import {
	formatDateForStorage,
	hasTimeComponent,
	parseDateToLocal,
} from "./dateUtils";

export interface TimeblockPrefill {
	date: string;
	startTime: string;
	endTime: string;
}

function formatTimeForInput(date: Date): string {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function buildTimeblockPrefillForTask(
	task: TaskInfo,
	targetDate: Date
): TimeblockPrefill {
	let startDate: Date | null = null;

	if (task.scheduled) {
		try {
			startDate = parseDateToLocal(task.scheduled);
		} catch {
			startDate = null;
		}
	}

	if (!startDate || isNaN(startDate.getTime())) {
		startDate = new Date(targetDate);
	}

	if (isNaN(startDate.getTime())) {
		startDate = new Date();
	}

	if (!task.scheduled || !hasTimeComponent(task.scheduled)) {
		startDate.setHours(9, 0, 0, 0);
	}

	const durationMinutes = task.timeEstimate && task.timeEstimate > 0 ? task.timeEstimate : 60;
	const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

	return {
		date: formatDateForStorage(startDate),
		startTime: formatTimeForInput(startDate),
		endTime: formatTimeForInput(endDate),
	};
}
