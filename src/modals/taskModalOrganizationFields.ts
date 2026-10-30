import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Setting } from "obsidian";

interface TaskModalListFieldOptions {
	label: string;
	buttonText: string;
	buttonTooltip: string;
	onButtonClick: () => void;
	listElement?: HTMLElement;
}

export interface TaskModalOrganizationFieldContext {
	translate: (key: MessageDescriptor) => string;
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
		label: context.translate(msg({ message: "Projects", context: "modals.task.organization.projects" })),
		buttonText: context.translate(msg({ message: "Add to project", context: "modals.task.organization.addToProjectButton" })),
		buttonTooltip: context.translate(msg({ message: "Select a project note using fuzzy search", context: "modals.task.projectsTooltip" })),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}

export function createTaskModalSubtasksField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): HTMLElement {
	return createTaskModalListField(options.container, {
		label: context.translate(msg({ message: "Subtasks", context: "modals.task.organization.subtasks" })),
		buttonText: context.translate(msg({ message: "Add subtask", context: "modals.task.organization.addSubtasksButton" })),
		buttonTooltip: context.translate(msg({ message: "Select tasks to make them subtasks of this task", context: "modals.task.organization.addSubtasksTooltip" })),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}

export function createTaskModalBlockedByField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): HTMLElement {
	return createTaskModalListField(options.container, {
		label: context.translate(msg({ message: "Blocked by", context: "modals.task.dependencies.blockedBy" })),
		buttonText: context.translate(msg({ message: "Add task", context: "modals.task.dependencies.addTaskButton" })),
		buttonTooltip: context.translate(msg({ message: "Select a task note using fuzzy search", context: "modals.task.dependencies.selectTaskTooltip" })),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}

export function createTaskModalBlockingField(
	context: TaskModalOrganizationFieldContext,
	options: CreateTaskModalOrganizationFieldOptions
): HTMLElement {
	return createTaskModalListField(options.container, {
		label: context.translate(msg({ message: "Blocking", context: "modals.task.dependencies.blocking" })),
		buttonText: context.translate(msg({ message: "Add task", context: "modals.task.dependencies.addTaskButton" })),
		buttonTooltip: context.translate(msg({ message: "Select a task note using fuzzy search", context: "modals.task.dependencies.selectTaskTooltip" })),
		onButtonClick: options.onButtonClick,
		listElement: options.listElement,
	});
}
