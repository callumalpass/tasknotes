import { uiText } from "../i18n/runtime";
import { configLabel } from "../i18n/configLabels";
import { uiNumber } from "../i18n/formatters";
import { msg } from "@lingui/core/macro";
import { setIcon, setTooltip } from "obsidian";
import type TaskNotesPlugin from "../main";
import { createElementInDocument } from "../utils/documentDom";
import {
	priorityGlyphState,
	renderPriorityGlyph,
	renderStatusGlyph,
	statusGlyphState,
} from "../ui/kit/glyphs";
import type { TaskListHeaderItem } from "./taskListGrouping";

type TaskListGroupHeaderOptions = {
	document: Document;
	headerItem: TaskListHeaderItem;
	plugin: TaskNotesPlugin;
	field: ReturnType<TaskNotesPlugin["fieldMapper"]["lookupMappingKey"]>;
	renderTitle: (container: HTMLElement, title: string) => void;
	onCreate: () => void;
};

export function createTaskListGroupHeader(options: TaskListGroupHeaderOptions): HTMLElement {
	const { headerItem } = options;
	// Use correct document for pop-out window support
	const doc = options.document;

	const groupHeader = createElementInDocument(doc, "div");
	groupHeader.className = "task-section task-group";

	// Determine header level and set appropriate data attributes
	const isSubHeader = headerItem.type === "sub-header";
	const level = isSubHeader ? "sub" : "primary";
	groupHeader.dataset.level = level;

	const groupKey = isSubHeader
		? `${headerItem.groupKey}:${headerItem.subGroupKey}`
		: headerItem.groupKey;

	if (isSubHeader) {
		groupHeader.dataset.groupKey = groupKey;
		groupHeader.dataset.parentKey = headerItem.parentKey;
	} else {
		groupHeader.dataset.groupKey = groupKey;
	}

	// Apply collapsed state
	if (headerItem.isCollapsed) {
		groupHeader.classList.add("is-collapsed");
	}

	const headerElement = createElementInDocument(doc, "h3");
	headerElement.className = "task-group-header task-list-view__group-header";
	groupHeader.appendChild(headerElement);

	// Add toggle button
	const toggleBtn = createElementInDocument(doc, "button");
	toggleBtn.className = "task-group-toggle";
	toggleBtn.type = "button";
	toggleBtn.setAttribute(
		"aria-label",
		uiText(
			msg({
				message: "Toggle group",
				context: "bases/TaskListView: TaskListView.createGroupHeader display",
			})
		)
	);
	toggleBtn.setAttribute("aria-expanded", String(!headerItem.isCollapsed));
	toggleBtn.dataset.groupKey = groupKey;
	headerElement.appendChild(toggleBtn);

	// Add chevron icon
	setIcon(toggleBtn, "chevron-right");
	const svg = toggleBtn.querySelector("svg");
	if (svg) {
		svg.classList.add("chevron");
		svg.setAttribute("width", "16");
		svg.setAttribute("height", "16");
	}

	// Add group title
	const titleContainer = headerElement.createSpan({ cls: "task-group-title" });
	const displayTitle = isSubHeader ? headerItem.subGroupTitle : headerItem.groupTitle;

	const glyph = createElementInDocument(doc, "span");
	glyph.className = "task-group-glyph";
	glyph.setAttribute("aria-hidden", "true");
	headerElement.insertBefore(glyph, titleContainer);
	const field = options.field;
	const config =
		field === "status"
			? options.plugin.statusManager?.getStatusConfig(displayTitle)
			: field === "priority"
				? options.plugin.priorityManager?.getPriorityConfig(displayTitle)
				: null;
	if (config?.color) glyph.style.color = config.color;
	if (config?.icon) setIcon(glyph, config.icon);
	else if (field === "status" && options.plugin.statusManager) {
		renderStatusGlyph(
			glyph,
			statusGlyphState(displayTitle, options.plugin.statusManager.getAllStatuses())
		);
	} else if (field === "priority" && options.plugin.priorityManager) {
		renderPriorityGlyph(
			glyph,
			priorityGlyphState(displayTitle, options.plugin.priorityManager.getAllPriorities())
		);
	} else setIcon(glyph, "folder");
	options.renderTitle(titleContainer, config ? configLabel(config) : displayTitle);

	// Add count
	headerElement.createSpan({
		text: `(${uiNumber(headerItem.taskCount)})`,
		cls: "agenda-view__item-count",
	});
	const addButton = headerElement.createEl("button", {
		cls: "tn-btn tn-btn--ghost tn-btn--icon task-group-add",
	});
	addButton.type = "button";
	const newTaskLabel = uiText(msg({ message: "New", context: "common.new" }));
	addButton.setAttribute("aria-label", newTaskLabel);
	setTooltip(addButton, newTaskLabel);
	setIcon(addButton, "plus");
	addButton.addEventListener("click", (event) => {
		event.stopPropagation();
		options.onCreate();
	});

	return groupHeader;
}
