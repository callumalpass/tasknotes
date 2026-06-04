import { setIcon, setTooltip } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { formatDateTimeForDisplay } from "../utils/dateUtils";
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
import {
	toggleTaskCardBlockedByExpansion,
	type TaskCardSecondaryBadgeHandlers,
} from "./taskCardSecondaryBadges";

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

	const blockedLabel = plugin.i18n.translate("ui.taskCard.blockedBadge");
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
		setTooltip(blockedPill, plugin.i18n.translate("ui.taskCard.blockedBadgeTooltip"), {
			placement: "top",
		});
	}

	return blockedPill;
}

function createBlockingMetadataPill(config: RenderTaskCardMetadataConfig): HTMLElement | null {
	const { metadataLine, task, plugin } = config;
	if (!task.isBlocking) {
		return null;
	}

	const blockingLabel = plugin.i18n.translate("ui.taskCard.blockingBadge");
	const blockingCount = task.blocking?.length ?? 0;
	const pillText = blockingCount > 0 ? `${blockingLabel} (${blockingCount})` : blockingLabel;
	const blockingPill = metadataLine.createSpan({
		cls: "task-card__metadata-pill task-card__metadata-pill--blocking",
		text: pillText,
	});
	setTooltip(blockingPill, plugin.i18n.translate("ui.taskCard.blockingBadgeTooltip"), {
		placement: "top",
	});
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
	setTooltip(syncPill, plugin.i18n.translate("ui.taskCard.googleCalendarSyncTooltip"), {
		placement: "top",
	});
	return syncPill;
}

function createOccurrenceMetadataPill(config: RenderTaskCardMetadataConfig): HTMLElement | null {
	const { metadataLine, task, plugin } = config;
	if (!task.recurrence_parent || !task.occurrence_date) {
		return null;
	}

	const dateLabel = formatDateTimeForDisplay(task.occurrence_date, {
		dateFormat: "MMM d",
		showTime: false,
		userTimeFormat: plugin.settings.calendarViewSettings?.timeFormat,
	});
	const pill = metadataLine.createSpan({
		cls: "task-card__metadata-pill task-card__metadata-pill--occurrence",
	});
	setIcon(pill, "refresh-ccw");
	pill.createSpan({ text: `Occurrence: ${dateLabel}` });
	prepareInteractiveControl(pill);
	pill.setAttribute(
		"aria-label",
		`Open recurring parent for occurrence on ${task.occurrence_date}`
	);
	setTooltip(pill, `Occurrence of ${task.recurrence_parent} on ${task.occurrence_date}`, {
		placement: "top",
	});
	pill.addEventListener("click", (event) => {
		event.stopPropagation();
		const parentPath = parseLinkToPath(task.recurrence_parent || "");
		void plugin.app.workspace.openLinkText(parentPath, task.path, false);
	});
	return pill;
}

export function renderTaskCardMetadata(config: RenderTaskCardMetadataConfig): HTMLElement[] {
	const { metadataLine, task, plugin, visibleProperties, propertyOptions = {} } = config;
	metadataLine.empty();
	const metadataElements: HTMLElement[] = [];
	const propertiesToShow = getPropertiesToShow(visibleProperties, plugin);

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
