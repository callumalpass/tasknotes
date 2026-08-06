import { setIcon } from "obsidian";
import { createTaskModalSidebarRow } from "./taskModalSidebar";

export interface TaskModalOrganizationFieldContext {
	translate: (key: string, params?: Record<string, string | number>) => string;
}

export interface CreateTaskModalOrganizationFieldOptions {
	container: HTMLElement;
	onButtonClick: () => void;
	listElement?: HTMLElement;
	getItemCount?: () => number;
	onHeaderUpdate?: (update: () => void) => void;
}

export interface TaskModalOrganizationRowController {
	listElement: HTMLElement;
	updateHeader: () => void;
}

interface OrganizationRowCopy {
	sectionLabelKey: string;
	addAriaKey: string;
	iconName: string;
}

const ORGANIZATION_ROW_COPY: Record<string, OrganizationRowCopy> = {
	projects: {
		iconName: "folder",
		sectionLabelKey: "modals.task.organization.projects",
		addAriaKey: "modals.task.projectsTooltip",
	},
	subtasks: {
		iconName: "list-tree",
		sectionLabelKey: "modals.task.organization.subtasks",
		addAriaKey: "modals.task.organization.addSubtasksTooltip",
	},
	"blocked-by": {
		iconName: "git-pull-request",
		sectionLabelKey: "modals.task.dependencies.blockedBy",
		addAriaKey: "modals.task.dependencies.selectTaskTooltip",
	},
	blocking: {
		iconName: "git-branch",
		sectionLabelKey: "modals.task.dependencies.blocking",
		addAriaKey: "modals.task.dependencies.selectTaskTooltip",
	},
};

function createTaskModalOrganizationRow(
	container: HTMLElement,
	rowId: string,
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): TaskModalOrganizationRowController {
	const copy = ORGANIZATION_ROW_COPY[rowId];
	const fieldContainer = container.createDiv(`tn-task-modal__org-field tn-task-modal__org-field--${rowId}`);

	const emptyRowContainer = fieldContainer.createDiv("tn-task-modal__org-empty-row");
	createTaskModalSidebarRow(emptyRowContainer, {
		id: rowId,
		iconName: copy.iconName,
		label: context.translate(copy.sectionLabelKey),
		value: "",
		hasValue: false,
		onClick: () => {
			options.onButtonClick();
		},
	});

	const header = fieldContainer.createDiv("tn-task-modal__org-header");
	header.hidden = true;

	const titleLabel = header.createDiv("tn-task-modal__org-header-label");
	const titleText = titleLabel.createSpan("tn-task-modal__org-header-title");

	const addButton = header.createEl("button", {
		cls: "tn-task-modal__org-add-button",
		attr: { "aria-label": context.translate(copy.addAriaKey) },
	});
	setIcon(addButton.createSpan(), "plus");
	addButton.addEventListener("click", (event) => {
		event.stopPropagation();
		options.onButtonClick();
	});

	const listElement =
		options.listElement ??
		fieldContainer.createDiv({
			cls: "task-projects-list tn-task-modal__org-list",
		});

	const updateHeader = (): void => {
		const total = options.getItemCount?.() ?? 0;
		const isEmpty = total === 0;
		emptyRowContainer.hidden = !isEmpty;
		header.hidden = isEmpty;

		if (!isEmpty) {
			titleText.setText(context.translate(copy.sectionLabelKey));
		}
	};

	options.onHeaderUpdate?.(updateHeader);
	updateHeader();

	return { listElement, updateHeader };
}

export function createTaskModalProjectsField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): TaskModalOrganizationRowController {
	return createTaskModalOrganizationRow(options.container, "projects", context, options);
}

export function createTaskModalSubtasksField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): TaskModalOrganizationRowController {
	return createTaskModalOrganizationRow(options.container, "subtasks", context, options);
}

export function createTaskModalBlockedByField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): TaskModalOrganizationRowController {
	return createTaskModalOrganizationRow(options.container, "blocked-by", context, options);
}

export function createTaskModalBlockingField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): TaskModalOrganizationRowController {
	return createTaskModalOrganizationRow(options.container, "blocking", context, options);
}
