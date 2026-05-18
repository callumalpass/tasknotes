import { Setting } from "obsidian";

interface TaskModalListFieldOptions {
	label: string;
	buttonText: string;
	buttonTooltip: string;
	onButtonClick: () => void;
	listElement?: HTMLElement;
}

export interface TaskModalOrganizationFieldContext {
	translate: (key: string) => string;
}

export interface CreateTaskModalOrganizationFieldOptions {
	container: HTMLElement;
	onButtonClick: () => void;
	listElement?: HTMLElement;
}

export function createTaskModalListField(
	container: HTMLElement,
	options: TaskModalListFieldOptions
): HTMLElement {
	new Setting(container).setName(options.label).addButton((button) => {
		button
			.setButtonText(options.buttonText)
			.setTooltip(options.buttonTooltip)
			.onClick(options.onButtonClick);
		button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
	});

	return options.listElement ?? container.createDiv({ cls: "task-projects-list" });
}

export function createTaskModalProjectsField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): HTMLElement {
	return createTaskModalListField(options.container, {
		label: context.translate("modals.task.organization.projects"),
		buttonText: context.translate("modals.task.organization.addToProjectButton"),
		buttonTooltip: context.translate("modals.task.projectsTooltip"),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}

export function createTaskModalSubtasksField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): HTMLElement {
	return createTaskModalListField(options.container, {
		label: context.translate("modals.task.organization.subtasks"),
		buttonText: context.translate("modals.task.organization.addSubtasksButton"),
		buttonTooltip: context.translate("modals.task.organization.addSubtasksTooltip"),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}

export function createTaskModalBlockedByField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): HTMLElement {
	return createTaskModalListField(options.container, {
		label: context.translate("modals.task.dependencies.blockedBy"),
		buttonText: context.translate("modals.task.dependencies.addTaskButton"),
		buttonTooltip: context.translate("modals.task.dependencies.selectTaskTooltip"),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}

export function createTaskModalBlockingField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): HTMLElement {
	return createTaskModalListField(options.container, {
		label: context.translate("modals.task.dependencies.blocking"),
		buttonText: context.translate("modals.task.dependencies.addTaskButton"),
		buttonTooltip: context.translate("modals.task.dependencies.selectTaskTooltip"),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}
