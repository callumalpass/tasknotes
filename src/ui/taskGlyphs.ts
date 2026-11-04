import { setIcon } from "obsidian";
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
	const status = plugin.statusManager.getStatusConfig(task.status);
	const priority = plugin.priorityManager.getPriorityConfig(task.priority);
	const glyphs = createElementInDocument(document, "span");
	glyphs.className = "tn-task-glyphs";
	glyphs.setAttribute("aria-hidden", "true");
	const statusGlyph = glyphs.createSpan({ cls: "tn-task-glyphs__status" });
	if (!status) statusGlyph.setAttribute("title", unconfiguredValueLabel(task.status));
	statusGlyph.style.color = status?.color || "var(--text-muted)";
	if (status?.icon) setIcon(statusGlyph, status.icon);
	else
		renderStatusGlyph(
			statusGlyph,
			statusGlyphState(task.status, plugin.statusManager.getAllStatuses())
		);
	// A task with no priority shows nothing: events are too narrow to spend space on an empty slot.
	if (!hasVisiblePriority(task.priority, plugin.priorityManager.getAllPriorities()))
		return glyphs;
	const priorityGlyph = glyphs.createSpan({ cls: "tn-task-glyphs__priority" });
	if (!priority) priorityGlyph.setAttribute("title", unconfiguredValueLabel(task.priority));
	priorityGlyph.style.color = priority?.color || "var(--text-muted)";
	if (priority?.icon) setIcon(priorityGlyph, priority.icon);
	else
		renderPriorityGlyph(
			priorityGlyph,
			priorityGlyphState(task.priority, plugin.priorityManager.getAllPriorities())
		);
	return glyphs;
}
