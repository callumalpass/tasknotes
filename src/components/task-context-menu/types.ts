import TaskNotesPlugin from "../../main";
import { TaskInfo } from "../../types";

export interface TaskContextMenuOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	targetDate: Date;
	/** The clicked occurrence (Calendar); omit to let the service's anchor-aware default resolve the date. */
	occurrenceDate?: Date;
	onUpdate?: () => void;
	onHide?: () => void;
	promoteOccurrenceControls?: boolean;
}
