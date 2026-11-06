import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { setIcon, setTooltip } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { taskDateLabel } from "./kit/dateLabel";
import { parseLinkToPath } from "../utils/linkUtils";
import { convertInternalToUserProperties, isPropertyForField } from "../utils/propertyMapping";
import {
	getDefaultVisibleProperties,
	renderPropertyMetadata,
	updateMetadataVisibility,
	type TaskCardPropertyOptions,
} from "./taskCardProperties";
import { getBlockedByTaskPaths } from "./taskCardRelationships";
import { prepareInteractiveControl } from "./taskCardIndicators";
import { openPopover } from "./kit/popover";
import {
	toggleTaskCardBlockedByExpansion,
	type TaskCardSecondaryBadgeHandlers,
} from "./taskCardSecondaryBadges";

const metadataObservers = new WeakMap<HTMLElement, ResizeObserver>();

export function cleanupTaskCardMetadata(metadataLine: HTMLElement): void {
	metadataObservers.get(metadataLine)?.disconnect();
	metadataObservers.delete(metadataLine);
}

export function fitTaskCardMetadata(values: HTMLElement, metadataLine: HTMLElement, plugin?: TaskNotesPlugin, occurrenceScheduled = ""): void {
	const atoms: HTMLElement[] = [];
	const groups: Array<{ property: HTMLElement; chips: HTMLElement[] }> = [];
	for (const property of Array.from(values.children) as HTMLElement[]) {
		const chips = Array.from(
			property.querySelectorAll<HTMLElement>(".tag, .context-tag, .task-card__project-link")
		);
		if (chips.length) {
			property.classList.add("task-card__metadata-chips");
			groups.push({ property, chips });
			for (const node of Array.from(property.childNodes)) {
				if (node.nodeType === Node.TEXT_NODE) node.remove();
			}
			atoms.push(...chips);
		} else atoms.push(property);
	}
	const dateSlots = Array.from(metadataLine.querySelectorAll<HTMLElement>(".task-card__date-slot")).filter((slot) => slot.childElementCount > 0);
	const summary = metadataLine.createSpan({
		cls: "task-card__metadata-overflow",
		attr: { "aria-haspopup": "dialog", "aria-expanded": "false" },
	});
	prepareInteractiveControl(summary);
	summary.dataset.occurrenceScheduled = occurrenceScheduled;
	summary.hidden = true;
	let hiddenLabels: string[] = [];
	summary.addEventListener("click", (event) => {
		event.stopPropagation();
		if (!hiddenLabels.length) return;
		const card = summary.closest<HTMLElement>(".task-card");
		const root = summary.closest<HTMLElement>(".tasknotes-plugin") ?? card?.parentElement;
		const path = card?.dataset.taskPath;
		const inDayPanel = !!summary.closest(".tn-calendar-day-panel");
		let currentSummary = summary;
		const resolveAnchor = () => {
			if (!root?.isConnected) return null;
			if (currentSummary.isConnected) return currentSummary;
			const replacement = Array.from(root.querySelectorAll<HTMLElement>(".task-card"))
				.filter((element) => element.dataset.taskPath === path && !!element.closest(".tn-calendar-day-panel") === inDayPanel)
				.flatMap((element) => Array.from(element.querySelectorAll<HTMLElement>(".task-card__metadata-overflow")))
				.find((element) => element.dataset.occurrenceScheduled === occurrenceScheduled);
			if (!replacement) return null;
			currentSummary = replacement;
			currentSummary.setAttribute("aria-expanded", "true");
			return currentSummary;
		};
		const popover = openPopover({
			anchor: summary,
			resolveAnchor,
			app: plugin?.app,
			className: "tn-picker",
			onClose: () => {
				currentSummary.setAttribute("aria-expanded", "false");
			},
		});
		summary.setAttribute("aria-expanded", "true");
		popover.el.setAttribute("role", "dialog");
		popover.el.setAttribute("aria-label", summary.getAttribute("aria-label") || "");
		const list = popover.el.createDiv({ cls: "tn-picker__list" });
		for (const label of hiddenLabels) list.createDiv({ cls: "tn-picker__row", text: label });
		popover.el.tabIndex = -1;
		popover.reposition();
		popover.el.focus();
	});
	const fit = () => {
		if (!values.isConnected) {
			cleanupTaskCardMetadata(metadataLine);
			return;
		}
		if (metadataLine.clientWidth === 0) return;
		values.hidden = false;
		for (const atom of atoms) atom.hidden = false;
		for (const group of groups) group.property.hidden = false;
		for (const slot of dateSlots) slot.hidden = false;
		summary.hidden = true;
		hiddenLabels = [];
		const fits = () => {
			values.hidden = !atoms.some((atom) => !atom.hidden);
			return [...atoms, ...dateSlots, summary].every((element) => {
				if (element.hidden) return true;
				const bounds = element.getBoundingClientRect();
				const boundary = atoms.includes(element) ? values.getBoundingClientRect().right : metadataLine.getBoundingClientRect().right;
				return bounds.right <= boundary + 0.5 && element.scrollWidth <= element.clientWidth + 1;
			});
		};
		if (fits()) return;
		summary.hidden = false;
		summary.textContent = `+${atoms.length + dateSlots.length}`;
		for (const atom of atoms) atom.hidden = true;
		for (const group of groups) group.property.hidden = true;
		for (const slot of dateSlots) {
			if (fits()) break;
			slot.hidden = true;
		}
		for (const atom of atoms) {
			atom.hidden = false;
			for (const group of groups)
				group.property.hidden = group.chips.every((chip) => chip.hidden);
			if (!fits()) atom.hidden = true;
		}
		for (const group of groups)
			group.property.hidden = group.chips.every((chip) => chip.hidden);
		values.hidden = !atoms.some((atom) => !atom.hidden);
		const hidden = [...atoms, ...dateSlots]
			.filter((atom) => atom.hidden)
			.map((atom) => atom.getAttribute("aria-label") || atom.firstElementChild?.getAttribute("aria-label") || atom.textContent || "");
		summary.textContent = hidden.length ? `+${hidden.length}` : "";
		summary.hidden = hidden.length === 0;
		const label = hidden.join(" · ");
		hiddenLabels = hidden;
		summary.setAttribute("aria-label", label);
		setTooltip(summary, label, { placement: "top" });
	};
	const Observer = metadataLine.ownerDocument.defaultView?.ResizeObserver;
	if (Observer) {
		const observer = new Observer(fit);
		observer.observe(values);
		observer.observe(metadataLine);
		metadataObservers.set(metadataLine, observer);
	}
}

export interface RenderTaskCardMetadataConfig {
	metadataLine: HTMLElement;
	card: HTMLElement;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	visibleProperties?: string[];
	propertyOptions?: TaskCardPropertyOptions;
	onBlockedByToggle: () => void;
}

export interface RenderTaskCardMetadataLineConfig {
	metadataLine: HTMLElement;
	card: HTMLElement;
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	visibleProperties?: string[];
	propertyOptions?: TaskCardPropertyOptions;
	handlers: Pick<TaskCardSecondaryBadgeHandlers, "toggleBlockedByTasks">;
}

function getPropertiesToShow(
	visibleProperties: string[] | undefined,
	plugin: TaskNotesPlugin
): string[] {
	return (
		visibleProperties ||
		(plugin.settings.defaultVisibleProperties
			? convertInternalToUserProperties(plugin.settings.defaultVisibleProperties, plugin)
			: getDefaultVisibleProperties(plugin))
	);
}

function createBlockedMetadataPill(config: RenderTaskCardMetadataConfig): HTMLElement | null {
	const { metadataLine, card, task, plugin, onBlockedByToggle } = config;
	if (!task.isBlocked) {
		return null;
	}

	const blockedLabel = plugin.i18n.translate(
		msg({ message: "Blocked", context: "ui.taskCard.blockedBadge" })
	);
	const blockedByPaths = getBlockedByTaskPaths(task, plugin.app);
	const blockedCount = task.blockedBy?.length ?? 0;
	const pillText = blockedCount > 0 ? `${blockedLabel} (${blockedCount})` : blockedLabel;
	const blockedPill = metadataLine.createSpan({
		cls: "task-card__metadata-pill task-card__metadata-pill--blocked",
		text: pillText,
	});

	if (blockedByPaths.length > 0) {
		const toggleLabel = `${blockedLabel} (${blockedByPaths.length})`;
		prepareInteractiveControl(blockedPill);
		blockedPill.setAttribute("aria-label", toggleLabel);
		blockedPill.setAttribute(
			"aria-expanded",
			String(Boolean(card.querySelector(".task-card__blocked-by")))
		);
		setTooltip(blockedPill, toggleLabel, { placement: "top" });
		blockedPill.addEventListener("click", (event) => {
			event.stopPropagation();
			onBlockedByToggle();
		});
	} else {
		setTooltip(
			blockedPill,
			plugin.i18n.translate(
				msg({
					message: "This task is waiting on another task",
					context: "ui.taskCard.blockedBadgeTooltip",
				})
			),
			{
				placement: "top",
			}
		);
	}

	return blockedPill;
}

function createBlockingMetadataPill(config: RenderTaskCardMetadataConfig): HTMLElement | null {
	const { metadataLine, task, plugin } = config;
	if (!task.isBlocking) {
		return null;
	}

	const blockingLabel = plugin.i18n.translate(
		msg({ message: "Blocking", context: "ui.taskCard.blockingBadge" })
	);
	const blockingCount = task.blocking?.length ?? 0;
	const pillText = blockingCount > 0 ? `${blockingLabel} (${blockingCount})` : blockingLabel;
	const blockingPill = metadataLine.createSpan({
		cls: "task-card__metadata-pill task-card__metadata-pill--blocking",
		text: pillText,
	});
	setTooltip(
		blockingPill,
		plugin.i18n.translate(
			msg({
				message: "This task is blocking another task",
				context: "ui.taskCard.blockingBadgeTooltip",
			})
		),
		{
			placement: "top",
		}
	);
	return blockingPill;
}

function createGoogleCalendarSyncPill(config: RenderTaskCardMetadataConfig): HTMLElement | null {
	const { metadataLine, task, plugin } = config;
	if (!task.googleCalendarEventId) {
		return null;
	}

	const syncPill = metadataLine.createSpan({
		cls: "task-card__metadata-pill task-card__metadata-pill--google-calendar",
	});
	setIcon(syncPill, "calendar");
	setTooltip(
		syncPill,
		plugin.i18n.translate(
			msg({
				message: "Synced to Google Calendar",
				context: "ui.taskCard.googleCalendarSyncTooltip",
			})
		),
		{
			placement: "top",
		}
	);
	return syncPill;
}

function createOccurrenceMetadataPill(config: RenderTaskCardMetadataConfig): HTMLElement | null {
	const { metadataLine, task, plugin } = config;
	if (!task.recurrence_parent || !task.occurrence_date) {
		return null;
	}

	const dateLabel = taskDateLabel(
		task.occurrence_date,
		plugin.settings.calendarViewSettings?.timeFormat
	);
	const pill = metadataLine.createSpan({
		cls: "task-card__metadata-pill task-card__metadata-pill--occurrence",
	});
	setIcon(pill, "refresh-ccw");
	pill.createSpan({
		text: uiText(
			msg({
				message: "Occurrence: {dateLabel}",
				context: "ui/taskCardMetadata: createOccurrenceMetadataPill text",
			}),
			{ dateLabel: dateLabel }
		),
	});
	prepareInteractiveControl(pill);
	pill.setAttribute(
		"aria-label",
		uiText(
			msg({
				message: "Open recurring parent for occurrence on {occurrence_date}",
				context: "ui/taskCardMetadata: createOccurrenceMetadataPill display",
			}),
			{ occurrence_date: task.occurrence_date }
		)
	);
	setTooltip(
		pill,
		uiText(
			msg({
				message: "Occurrence of {recurrence_parent} on {occurrence_date}",
				context: "ui/taskCardMetadata: createOccurrenceMetadataPill display",
			}),
			{ recurrence_parent: task.recurrence_parent, occurrence_date: task.occurrence_date }
		),
		{
			placement: "top",
		}
	);
	pill.addEventListener("click", (event) => {
		event.stopPropagation();
		const parentPath = parseLinkToPath(task.recurrence_parent || "");
		void plugin.app.workspace.openLinkText(parentPath, task.path, false);
	});
	return pill;
}

export function renderTaskCardMetadata(config: RenderTaskCardMetadataConfig): HTMLElement[] {
	const { metadataLine, card, task, plugin, visibleProperties, propertyOptions = {} } = config;
	cleanupTaskCardMetadata(metadataLine);
	metadataLine.empty();
	const metadataElements: HTMLElement[] = [];
	const propertiesToShow = getPropertiesToShow(visibleProperties, plugin);
	for (const field of ["scheduled", "due"] as const) {
		metadataLine.classList.toggle(`task-card__metadata--with-${field}`,
			propertiesToShow.some((property) => isPropertyForField(property, field, plugin)));
	}

	const occurrencePill = createOccurrenceMetadataPill(config);
	if (occurrencePill) {
		metadataElements.push(occurrencePill);
	}

	for (const propertyId of propertiesToShow) {
		if (
			isPropertyForField(propertyId, "status", plugin) ||
			isPropertyForField(propertyId, "priority", plugin)
		) {
			continue;
		}

		if (propertyId === "blocked") {
			const blockedPill = createBlockedMetadataPill(config);
			if (blockedPill) {
				metadataElements.push(blockedPill);
			}
			continue;
		}

		if (propertyId === "blocking") {
			const blockingPill = createBlockingMetadataPill(config);
			if (blockingPill) {
				metadataElements.push(blockingPill);
			}
			continue;
		}

		if (propertyId === "googleCalendarSync") {
			const syncPill = createGoogleCalendarSyncPill(config);
			if (syncPill) {
				metadataElements.push(syncPill);
			}
			continue;
		}

		const propertyElement = renderPropertyMetadata(
			metadataLine,
			propertyId,
			task,
			plugin,
			propertyOptions
		);
		if (propertyElement) {
			metadataElements.push(propertyElement);
		}
	}

	updateMetadataVisibility(metadataLine, metadataElements);
	metadataLine.hidden = metadataElements.length === 0;
	card.classList.toggle("task-card--metadata-empty", metadataLine.hidden);
	const values = metadataLine.createSpan({ cls: "task-card__metadata-values" });
	for (const element of metadataElements) {
		if (!element.classList.contains("task-card__metadata-date")) values.appendChild(element);
	}
	metadataLine.prepend(values);
	for (const field of ["scheduled", "due"] as const) {
		if (!propertiesToShow.some((property) => isPropertyForField(property, field, plugin)))
			continue;
		const slot = metadataLine.createSpan({
			cls: `task-card__date-slot task-card__date-slot--${field}`,
		});
		const date = metadataElements.find((element) =>
			element.classList.contains(`task-card__metadata-date--${field}`)
		);
		slot.hidden = !date;
		if (date) slot.appendChild(date);
	}
	fitTaskCardMetadata(values, metadataLine, plugin, propertyOptions.occurrenceScheduled);
	return metadataElements;
}

export function renderTaskCardMetadataLine(
	config: RenderTaskCardMetadataLineConfig
): HTMLElement[] {
	const { metadataLine, card, task, plugin, visibleProperties, propertyOptions, handlers } =
		config;

	return renderTaskCardMetadata({
		metadataLine,
		card,
		task,
		plugin,
		visibleProperties,
		propertyOptions,
		onBlockedByToggle: () =>
			void toggleTaskCardBlockedByExpansion({
				card,
				task,
				plugin,
				handlers,
			}),
	});
}
