import { setIcon, setTooltip } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { createElementInDocument } from "../utils/documentDom";
import {
	priorityGlyphState,
	renderPriorityGlyph,
	renderStatusGlyph,
	statusGlyphState,
	unconfiguredValueLabel,
	hasVisiblePriority,
} from "./kit/glyphs";

export function createTaskGlyphs(
	document: Document,
	task: TaskInfo,
	plugin: TaskNotesPlugin
): HTMLElement {
	const glyphs = createElementInDocument(document, "span");
	glyphs.className = "tn-task-glyphs";
	glyphs.setAttribute("aria-hidden", "true");
	glyphs.append(createStatusGlyph(document, task, plugin));
	// A task with no priority shows nothing: events are too narrow to spend space on an empty slot.
	if (!hasVisiblePriority(task.priority, plugin.priorityManager.getAllPriorities())) {
		glyphs.classList.add("tn-task-glyphs--status-only");
		return glyphs;
	}
	glyphs.append(createPriorityGlyph(document, task, plugin));
	return glyphs;
}

export function createStatusGlyph(document: Document, task: TaskInfo, plugin: TaskNotesPlugin): HTMLElement {
	const status = plugin.statusManager.getStatusConfig(task.status);
	const statusGlyph = createElementInDocument(document, "span");
	statusGlyph.className = "tn-task-glyphs__status";
	if (!status) setTooltip(statusGlyph, unconfiguredValueLabel(task.status));
	statusGlyph.style.color = status?.color || "var(--text-muted)";
	if (status?.icon) setIcon(statusGlyph, status.icon);
	else
		renderStatusGlyph(
			statusGlyph,
			statusGlyphState(task.status, plugin.statusManager.getAllStatuses())
		);
	return statusGlyph;
}

/** The task's priority mark, or null when it would only draw the empty "no priority" ring. */
export function createRankedPriorityGlyph(document: Document, task: TaskInfo, plugin: TaskNotesPlugin): HTMLElement | null {
	const priority = plugin.priorityManager.getPriorityConfig(task.priority);
	if (!priority?.icon && priorityGlyphState(task.priority, plugin.priorityManager.getAllPriorities()).kind === "unset") {
		return null;
	}
	return createPriorityGlyph(document, task, plugin);
}

function createPriorityGlyph(document: Document, task: TaskInfo, plugin: TaskNotesPlugin): HTMLElement {
	const priority = plugin.priorityManager.getPriorityConfig(task.priority);
	const priorityGlyph = createElementInDocument(document, "span");
	priorityGlyph.className = "tn-task-glyphs__priority";
	if (!priority) setTooltip(priorityGlyph, unconfiguredValueLabel(task.priority));
	priorityGlyph.style.color = priority?.color || "var(--text-muted)";
	if (priority?.icon) setIcon(priorityGlyph, priority.icon);
	else
		renderPriorityGlyph(
			priorityGlyph,
			priorityGlyphState(task.priority, plugin.priorityManager.getAllPriorities())
		);
	return priorityGlyph;
}
