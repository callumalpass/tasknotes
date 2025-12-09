import { TAbstractFile } from "obsidian";
import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createCardInput,
	createDeleteHeaderButton,
	createCardToggle,
	CardRow,
} from "../../components/CardComponent";
import { createFilterSettingsInputs } from "../../components/FilterSettingsComponent";
import { ProjectSelectModal } from "../../../modals/ProjectSelectModal";
import { splitListPreservingLinksAndQuotes } from "../../../utils/stringSplit";
import { createNLPTriggerRows, createPropertyDescription, TranslateFn } from "./helpers";

/**
 * Renders the Projects property card with default projects, use parent note toggle, and autosuggest settings
 */
export function renderProjectsPropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	// Create a wrapper for the card so we can re-render it
	const cardWrapper = container.createDiv();
	let isCollapsed = true;

	function renderCard(): void {
		cardWrapper.empty();

		const propertyKeyInput = createCardInput(
			"text",
			"projects",
			plugin.settings.fieldMapping.projects
		);

		propertyKeyInput.addEventListener("change", () => {
			plugin.settings.fieldMapping.projects = propertyKeyInput.value;
			save();
		});

		// Create nested content for default projects
		const nestedContainer = document.createElement("div");
		nestedContainer.addClass("tasknotes-settings__nested-content");

		// Default projects container
		const selectedDefaultProjectFiles: TAbstractFile[] = [];
		const defaultProjectsContainer = nestedContainer.createDiv("default-projects-container");

		// Initialize selected projects from settings
		if (plugin.settings.taskCreationDefaults.defaultProjects) {
			const projectPaths = splitListPreservingLinksAndQuotes(
				plugin.settings.taskCreationDefaults.defaultProjects
			)
				.map((link) => link.replace(/\[\[|\]\]/g, "").trim())
				.filter((path) => path);

			projectPaths.forEach((path) => {
				const file =
					plugin.app.vault.getAbstractFileByPath(path + ".md") ||
					plugin.app.vault.getAbstractFileByPath(path);
				if (file) {
					selectedDefaultProjectFiles.push(file);
				}
			});
		}

		// Select projects button
		const selectButtonContainer = defaultProjectsContainer.createDiv();
		const selectButton = selectButtonContainer.createEl("button", {
			text: translate("settings.defaults.basicDefaults.defaultProjects.selectButton"),
			cls: "tn-btn tn-btn--ghost",
		});
		selectButton.onclick = () => {
			const modal = new ProjectSelectModal(
				plugin.app,
				plugin,
				(file: TAbstractFile) => {
					if (!selectedDefaultProjectFiles.includes(file)) {
						selectedDefaultProjectFiles.push(file);
						const projectLinks = selectedDefaultProjectFiles
							.map((f) => `[[${f.path.replace(/\.md$/, "")}]]`)
							.join(", ");
						plugin.settings.taskCreationDefaults.defaultProjects = projectLinks;
						save();
						renderDefaultProjectsList(
							projectsListContainer,
							plugin,
							save,
							selectedDefaultProjectFiles,
							translate
						);
					}
				}
			);
			modal.open();
		};

		// Projects list
		const projectsListContainer = defaultProjectsContainer.createDiv("default-projects-list-container");
		renderDefaultProjectsList(projectsListContainer, plugin, save, selectedDefaultProjectFiles, translate);

		// Use parent note as project toggle
		const useParentNoteToggle = createCardToggle(
			plugin.settings.taskCreationDefaults.useParentNoteAsProject,
			(value) => {
				plugin.settings.taskCreationDefaults.useParentNoteAsProject = value;
				save();
			}
		);

		const nlpRows = createNLPTriggerRows(plugin, "projects", "+", save, translate);

		// Create description element
		const descriptionEl = createPropertyDescription(
			translate("settings.taskProperties.properties.projects.description")
		);

		// Create autosuggest settings section
		const autosuggestSection = document.createElement("div");
		autosuggestSection.addClass("tasknotes-settings__nested-content");
		renderProjectAutosuggestSettings(autosuggestSection, plugin, save, translate, renderCard);

		const rows: CardRow[] = [
			{ label: "", input: descriptionEl, fullWidth: true },
			{ label: translate("settings.taskProperties.propertyCard.propertyKey"), input: propertyKeyInput },
			{ label: translate("settings.taskProperties.projectsCard.defaultProjects"), input: nestedContainer, fullWidth: true },
			{ label: translate("settings.taskProperties.projectsCard.useParentNote"), input: useParentNoteToggle },
			...nlpRows,
			{ label: "", input: autosuggestSection, fullWidth: true },
		];

		createCard(cardWrapper, {
			id: "property-projects",
			collapsible: true,
			defaultCollapsed: isCollapsed,
			onCollapseChange: (collapsed) => {
				isCollapsed = collapsed;
			},
			header: {
				primaryText: translate("settings.taskProperties.properties.projects.name"),
				secondaryText: plugin.settings.fieldMapping.projects,
			},
			content: {
				sections: [{ rows }],
			},
		});
	}

	renderCard();
}

/**
 * Renders the project autosuggest settings inside the projects card
 */
function renderProjectAutosuggestSettings(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn,
	_onRerender?: () => void
): void {
	container.empty();

	// Ensure projectAutosuggest exists
	if (!plugin.settings.projectAutosuggest) {
		plugin.settings.projectAutosuggest = {
			enableFuzzy: false,
			rows: [],
			showAdvanced: false,
			requiredTags: [],
			includeFolders: [],
			propertyKey: "",
			propertyValue: "",
		};
	}

	// Helper to check if any filters are active
	const hasActiveFilters = () => {
		const config = plugin.settings.projectAutosuggest;
		if (!config) return false;
		return (
			(config.requiredTags && config.requiredTags.length > 0) ||
			(config.includeFolders && config.includeFolders.length > 0) ||
			(config.propertyKey && config.propertyKey.trim() !== "")
		);
	};

	// ===== AUTOSUGGEST FILTERS SECTION =====
	const filterSectionWrapper = container.createDiv("tasknotes-settings__collapsible-section");
	filterSectionWrapper.addClass("tasknotes-settings__collapsible-section--collapsed");

	const filterHeader = filterSectionWrapper.createDiv("tasknotes-settings__collapsible-section-header");
	const filterHeaderLeft = filterHeader.createDiv("tasknotes-settings__collapsible-section-header-left");

	filterHeaderLeft.createSpan({
		text: translate("settings.taskProperties.projectsCard.autosuggestFilters"),
		cls: "tasknotes-settings__collapsible-section-title",
	});

	// Add "Filters On" badge if filters are active
	const filterBadge = filterHeaderLeft.createSpan("tasknotes-settings__filter-badge");
	const updateFilterBadge = () => {
		if (hasActiveFilters()) {
			filterBadge.style.display = "inline-flex";
			filterBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg><span>${translate("settings.taskProperties.projectsCard.filtersOn")}</span>`;
		} else {
			filterBadge.style.display = "none";
		}
	};
	updateFilterBadge();

	const filterChevron = filterHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	filterChevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const filterContent = filterSectionWrapper.createDiv("tasknotes-settings__collapsible-section-content");

	createFilterSettingsInputs(
		filterContent,
		{
			requiredTags: plugin.settings.projectAutosuggest.requiredTags,
			includeFolders: plugin.settings.projectAutosuggest.includeFolders,
			propertyKey: plugin.settings.projectAutosuggest.propertyKey,
			propertyValue: plugin.settings.projectAutosuggest.propertyValue,
		},
		(updated) => {
			plugin.settings.projectAutosuggest!.requiredTags = updated.requiredTags;
			plugin.settings.projectAutosuggest!.includeFolders = updated.includeFolders;
			plugin.settings.projectAutosuggest!.propertyKey = updated.propertyKey;
			plugin.settings.projectAutosuggest!.propertyValue = updated.propertyValue;
			updateFilterBadge();
			save();
		},
		translate
	);

	filterHeader.addEventListener("click", () => {
		filterSectionWrapper.toggleClass(
			"tasknotes-settings__collapsible-section--collapsed",
			!filterSectionWrapper.hasClass("tasknotes-settings__collapsible-section--collapsed")
		);
	});

	// ===== CUSTOMIZE DISPLAY SECTION =====
	const displaySectionWrapper = container.createDiv("tasknotes-settings__collapsible-section");
	displaySectionWrapper.addClass("tasknotes-settings__collapsible-section--collapsed");

	const displayHeader = displaySectionWrapper.createDiv("tasknotes-settings__collapsible-section-header");
	const displayHeaderLeft = displayHeader.createDiv("tasknotes-settings__collapsible-section-header-left");

	displayHeaderLeft.createSpan({
		text: translate("settings.taskProperties.projectsCard.customizeDisplay"),
		cls: "tasknotes-settings__collapsible-section-title",
	});

	const displayChevron = displayHeader.createSpan("tasknotes-settings__collapsible-section-chevron");
	displayChevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

	const displayContent = displaySectionWrapper.createDiv("tasknotes-settings__collapsible-section-content");

	// Fuzzy matching toggle
	const fuzzyRow = displayContent.createDiv("tasknotes-settings__card-config-row");
	fuzzyRow.createSpan({
		text: translate("settings.appearance.projectAutosuggest.enableFuzzyMatching.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const fuzzyToggle = createCardToggle(
		plugin.settings.projectAutosuggest.enableFuzzy,
		(value) => {
			plugin.settings.projectAutosuggest!.enableFuzzy = value;
			save();
		}
	);
	fuzzyRow.appendChild(fuzzyToggle);

	// Display rows help text
	displayContent.createDiv({
		text: translate("settings.appearance.projectAutosuggest.displayRowsHelp"),
		cls: "setting-item-description",
	});

	// Display row inputs
	const getRows = (): string[] => (plugin.settings.projectAutosuggest?.rows ?? []).slice(0, 3);

	const setRow = (idx: number, value: string) => {
		if (!plugin.settings.projectAutosuggest) return;
		const current = plugin.settings.projectAutosuggest.rows ?? [];
		const next = [...current];
		next[idx] = value;
		plugin.settings.projectAutosuggest.rows = next.slice(0, 3);
		save();
	};

	// Row 1
	const row1Container = displayContent.createDiv("tasknotes-settings__card-config-row");
	row1Container.createSpan({
		text: translate("settings.appearance.projectAutosuggest.displayRows.row1.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const row1Input = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.displayRows.row1.placeholder"),
		getRows()[0] || ""
	);
	row1Input.addEventListener("change", () => setRow(0, row1Input.value));
	row1Container.appendChild(row1Input);

	// Row 2
	const row2Container = displayContent.createDiv("tasknotes-settings__card-config-row");
	row2Container.createSpan({
		text: translate("settings.appearance.projectAutosuggest.displayRows.row2.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const row2Input = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.displayRows.row2.placeholder"),
		getRows()[1] || ""
	);
	row2Input.addEventListener("change", () => setRow(1, row2Input.value));
	row2Container.appendChild(row2Input);

	// Row 3
	const row3Container = displayContent.createDiv("tasknotes-settings__card-config-row");
	row3Container.createSpan({
		text: translate("settings.appearance.projectAutosuggest.displayRows.row3.name"),
		cls: "tasknotes-settings__card-config-label",
	});
	const row3Input = createCardInput(
		"text",
		translate("settings.appearance.projectAutosuggest.displayRows.row3.placeholder"),
		getRows()[2] || ""
	);
	row3Input.addEventListener("change", () => setRow(2, row3Input.value));
	row3Container.appendChild(row3Input);

	// Quick reference help section
	const helpContainer = displayContent.createDiv("tasknotes-settings__help-section");
	helpContainer.createEl("h4", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.header"),
	});
	const helpList = helpContainer.createEl("ul");
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.properties"),
	});
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.labels"),
	});
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.searchable"),
	});
	helpList.createEl("li", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.staticText"),
	});
	helpContainer.createEl("p", {
		text: translate("settings.appearance.projectAutosuggest.quickReference.alwaysSearchable"),
		cls: "settings-help-note",
	});

	displayHeader.addEventListener("click", () => {
		displaySectionWrapper.toggleClass(
			"tasknotes-settings__collapsible-section--collapsed",
			!displaySectionWrapper.hasClass("tasknotes-settings__collapsible-section--collapsed")
		);
	});
}

/**
 * Renders default projects list
 */
function renderDefaultProjectsList(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	selectedFiles: TAbstractFile[],
	translate: TranslateFn
): void {
	container.empty();

	if (selectedFiles.length === 0) {
		container.createDiv({
			text: translate("settings.taskProperties.projectsCard.noDefaultProjects"),
			cls: "setting-item-description",
		});
		return;
	}

	selectedFiles.forEach((file) => {
		const projectItem = container.createDiv("tasknotes-settings__project-item");
		projectItem.createSpan({ text: file.name.replace(/\.md$/, "") });

		const removeButton = projectItem.createEl("button", {
			cls: "tasknotes-settings__card-header-btn tasknotes-settings__card-header-btn--delete",
		});
		removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
		removeButton.title = translate("settings.defaults.basicDefaults.defaultProjects.removeTooltip", { name: file.name });
		removeButton.onclick = () => {
			const index = selectedFiles.indexOf(file);
			if (index > -1) {
				selectedFiles.splice(index, 1);
				const projectLinks = selectedFiles
					.map((f) => `[[${f.path.replace(/\.md$/, "")}]]`)
					.join(", ");
				plugin.settings.taskCreationDefaults.defaultProjects = projectLinks;
				save();
				renderDefaultProjectsList(container, plugin, save, selectedFiles, translate);
			}
		};
	});
}
