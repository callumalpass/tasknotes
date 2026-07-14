import { setIcon } from "obsidian";
import type { ModalFieldsConfigLike } from "./taskModalFieldConfig";
import { shouldShowFieldForModal } from "./taskModalFieldConfig";

export interface TaskModalSidebarRowSpec {
	id: string;
	iconName: string;
	label: string;
	value: string;
	hasValue: boolean;
	onClick: (event: UIEvent) => void;
}

export interface CreateTaskModalSidebarOptions {
	container: HTMLElement;
	rows: readonly TaskModalSidebarRowSpec[];
}

export function createTaskModalSidebar(options: CreateTaskModalSidebarOptions): HTMLElement {
	const sidebar = options.container.createDiv("tn-task-modal__sidebar");

	for (const row of options.rows) {
		createTaskModalSidebarRow(sidebar, row);
	}

	return sidebar;
}

export function createTaskModalSidebarRow(
	container: HTMLElement,
	spec: TaskModalSidebarRowSpec
): HTMLElement {
	const row = container.createDiv("tn-task-modal__sidebar-row");
	row.classList.toggle("has-value", spec.hasValue);
	row.setAttribute("data-field-id", spec.id);
	row.setAttribute("role", "button");
	row.setAttribute("tabindex", "0");

	const iconWrap = row.createSpan("tn-task-modal__sidebar-row-icon");
	setIcon(iconWrap, spec.iconName);

	const body = row.createDiv("tn-task-modal__sidebar-row-body");
	body.createDiv("tn-task-modal__sidebar-row-label").setText(spec.label);
	body.createDiv("tn-task-modal__sidebar-row-value").setText(spec.value);

	const chevron = row.createSpan("tn-task-modal__sidebar-row-chevron");
	setIcon(chevron, "chevron-right");

	const activate = (event: UIEvent): void => {
		event.preventDefault();
		spec.onClick(event);
	};

	row.addEventListener("click", activate);
	row.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			activate(event);
		}
	});

	return row;
}

export interface CreateTaskModalSidebarOrgSectionResult {
	section: HTMLElement;
	row: HTMLElement;
	listElement: HTMLElement;
}

/**
 * Desktop edit sidebar section: a property row with its organization list
 * rendered directly underneath instead of in a shared footer container.
 */
export function createTaskModalSidebarOrgSection(
	container: HTMLElement,
	spec: TaskModalSidebarRowSpec
): CreateTaskModalSidebarOrgSectionResult {
	const section = container.createDiv("tn-task-modal__sidebar-section");
	const row = createTaskModalSidebarRow(section, spec);
	const listElement = section.createDiv("task-projects-list tn-task-modal__org-list");

	return { section, row, listElement };
}

export interface CreateTaskModalPropertySectionsOptions {
	container: HTMLElement;
	groups: readonly (readonly TaskModalSidebarRowSpec[])[];
}

/**
 * Renders property rows in a single grouped card for the mobile bottom sheet.
 * Full-width divider elements sit between rows so separators stay edge-to-edge
 * regardless of row padding or icon width.
 */
export function createTaskModalPropertySections(
	options: CreateTaskModalPropertySectionsOptions
): HTMLElement {
	const wrapper = options.container.createDiv("tn-task-modal__mobile-sections");
	const rows = options.groups.flat();
	if (!rows.length) return wrapper;

	const card = wrapper.createDiv("tn-task-modal__mobile-group");
	for (const row of rows) {
		if (card.childElementCount > 0) {
			card.createDiv("tn-task-modal__sidebar-row-divider");
		}
		createTaskModalSidebarRow(card, row);
	}

	return wrapper;
}

export function updateTaskModalSidebarRow(
	sidebar: HTMLElement | undefined,
	rowId: string,
	value: string,
	hasValue: boolean
): void {
	const row = sidebar?.querySelector<HTMLElement>(`[data-field-id="${rowId}"]`);
	if (!row) return;

	row.classList.toggle("has-value", hasValue);
	const valueEl = row.querySelector<HTMLElement>(".tn-task-modal__sidebar-row-value");
	if (valueEl) {
		valueEl.setText(value);
	}
}

export interface TaskModalSidebarFieldVisibilityOptions {
	config: ModalFieldsConfigLike | undefined;
	isCreationMode: boolean;
}

export function isTaskModalSidebarFieldVisible(
	fieldId: string,
	options: TaskModalSidebarFieldVisibilityOptions
): boolean {
	return shouldShowFieldForModal(fieldId, options.config, options.isCreationMode);
}
