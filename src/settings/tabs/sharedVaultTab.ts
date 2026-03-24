import { Modal, Notice, Setting, TFile, setIcon } from "obsidian";
import TaskNotesPlugin from "../../main";
import { createSettingGroup } from "../components/settingHelpers";
import { sendTestNotification } from "./featuresTab";
import { FolderSuggest } from "../components/FolderSuggest";
import { TagSuggest } from "../components/TagSuggest";
import { openFileSelector } from "../../modals/FileSelectorModal";
import { createAvatar } from "../../ui/PersonAvatar";
import { createPersonGroupPicker } from "../../ui/PersonGroupPicker";
import type { TranslationKey } from "../../i18n";
import type { UserMappedField, DeviceUserMapping, LeadTime } from "../../types/settings";
import { getColorFromName } from "../../ui/PersonAvatar";
import { migratePropertyValue } from "../../utils/settingsMigration";

/**
 * Helper to update a person note's frontmatter from settings UI.
 * Uses two-step file lookup and invalidates PersonNoteService cache.
 */
async function updatePersonFrontmatter(
	plugin: TaskNotesPlugin,
	personPath: string,
	updater: (fm: Record<string, unknown>) => void
): Promise<void> {
	let file: import("obsidian").TAbstractFile | null = plugin.app.vault.getAbstractFileByPath(personPath);
	if (!file) {
		const linkPath = personPath.replace(/\.md$/, "");
		file = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, "");
	}
	if (file instanceof TFile) {
		await plugin.app.fileManager.processFrontMatter(file as TFile, updater);
		plugin.personNoteService?.invalidateCache(personPath);
	}
}

/**
 * Check if the creator User Field exists in settings
 */
function getCreatorUserField(plugin: TaskNotesPlugin): UserMappedField | undefined {
	const fieldKey = plugin.settings.creatorFieldName || "creator";
	return plugin.settings.userFields?.find((f) => f.key === fieldKey);
}

/**
 * Check if the assignee User Field exists in settings
 */
function getAssigneeUserField(plugin: TaskNotesPlugin): UserMappedField | undefined {
	const fieldKey = plugin.settings.assigneeFieldName || "assignee";
	return plugin.settings.userFields?.find((f) => f.key === fieldKey);
}

/**
 * Renders the Team & Attribution tab - device identity, person notes, and attribution settings
 */
export function renderSharedVaultTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const t = (key: TranslationKey) => plugin.i18n.translate(key);

	// Section 1: Overview Banner - Mental model explanation
	renderOverviewSection(container, plugin, t);

	// Section 2: Team Attribution Fields - Shows Creator and Assignee status with links to Task Properties
	renderTeamAttributionFieldsSection(container, plugin, t);

	// Section 3: Person Notes Source - Configure folder and tag filtering
	renderPersonNotesSourceSection(container, plugin, save, t);

	// Section 3.5: Group Notes - Configure group notes for team assignment
	renderGroupNotesSection(container, plugin, save, t);

	// Section 4: Your Identity - Device registration
	renderYourIdentitySection(container, plugin, save, t);

	// Section 5: Registered Team Members - All device mappings
	renderTeamMembersSection(container, plugin, save, t);

	// Section 6: Notification Filtering - Filter notifications by assignee
	renderNotificationFilteringSection(container, plugin, save, t);
}

/**
 * Section 1: Overview Banner
 * Explains the mental model: how device identity connects to task attribution
 */
function renderOverviewSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	t: (key: TranslationKey) => string
): void {
	createSettingGroup(
		container,
		{
			heading: t("settings.teamAttribution.overview.header" as TranslationKey),
			description: t("settings.teamAttribution.overview.description" as TranslationKey),
		},
		(group) => {
			// Creator vs Assignee explanation - using standard Setting for alignment
			group.addSetting((setting) => {
				setting.setName(t("settings.teamAttribution.overview.creatorVsAssignee.title" as TranslationKey));

				// Build description with clickable "Task Properties" link
				const descEl = setting.descEl;
				descEl.empty();
				descEl.style.whiteSpace = "pre-wrap";

				// Creator field explanation
				descEl.appendText(t("settings.teamAttribution.overview.creatorVsAssignee.creator" as TranslationKey));
				descEl.appendText("\n\n");

				// Assignee field explanation
				descEl.appendText(t("settings.teamAttribution.overview.creatorVsAssignee.assignee" as TranslationKey));
				descEl.appendText("\n\n");

				// Field note with clickable Task Properties link
				descEl.appendText("Both field names can be customized in ");
				const linkEl = descEl.createEl("a", {
					text: "Task Properties",
					cls: "tasknotes-settings-link",
				});
				linkEl.addEventListener("click", (e) => {
					e.preventDefault();
					navigateToTaskProperties(plugin);
				});
				descEl.appendText(" to match your workflow (e.g., 'author', 'owner', 'responsible').");
			});

			// Use case example
			group.addSetting((setting) => {
				setting
					.setName("Why this matters")
					.setDesc(t("settings.teamAttribution.overview.useCase" as TranslationKey));
			});
		}
	);
}

/**
 * Section 2: Team Attribution Fields
 * Shows status of Creator and Assignee fields with links to Task Properties
 */
function renderTeamAttributionFieldsSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	t: (key: TranslationKey) => string
): void {
	const creatorField = getCreatorUserField(plugin);
	const creatorFieldKey = plugin.settings.creatorFieldName || "creator";
	const assigneeField = getAssigneeUserField(plugin);
	const assigneeFieldKey = plugin.settings.assigneeFieldName || "assignee";

	createSettingGroup(
		container,
		{
			heading: t("settings.teamAttribution.attributionFields.header" as TranslationKey),
			description: t("settings.teamAttribution.attributionFields.description" as TranslationKey),
		},
		(group) => {
			// Creator field status
			group.addSetting((setting) => {
				if (creatorField) {
					setting
						.setName(t("settings.teamAttribution.attributionFields.creator.configured" as TranslationKey))
						.setDesc(`Using: ${creatorFieldKey} (${creatorField.type})`)
						.addButton((btn) =>
							btn
								.setButtonText("Edit")
								.onClick(() => navigateToTaskProperties(plugin, "property-creator"))
						);
					setting.settingEl.addClass("tasknotes-field-status-setting");
					setting.settingEl.addClass("tasknotes-field-status-setting--success");
				} else {
					setting
						.setName(t("settings.teamAttribution.attributionFields.creator.notConfigured" as TranslationKey))
						.setDesc("Go to Task Properties to set up")
						.addButton((btn) =>
							btn
								.setButtonText("Configure")
								.setCta()
								.onClick(() => navigateToTaskProperties(plugin, "property-creator"))
						);
					setting.settingEl.addClass("tasknotes-field-status-setting");
					setting.settingEl.addClass("tasknotes-field-status-setting--warning");
				}
			});

			// Assignee field status
			group.addSetting((setting) => {
				if (assigneeField) {
					setting
						.setName(t("settings.teamAttribution.attributionFields.assignee.configured" as TranslationKey))
						.setDesc(`Using: ${assigneeFieldKey} (${assigneeField.type})`)
						.addButton((btn) =>
							btn
								.setButtonText("Edit")
								.onClick(() => navigateToTaskProperties(plugin, "property-assignees"))
						);
					setting.settingEl.addClass("tasknotes-field-status-setting");
					setting.settingEl.addClass("tasknotes-field-status-setting--success");
				} else {
					setting
						.setName(t("settings.teamAttribution.attributionFields.assignee.notConfigured" as TranslationKey))
						.setDesc("Go to Task Properties to set up")
						.addButton((btn) =>
							btn
								.setButtonText("Configure")
								.setCta()
								.onClick(() => navigateToTaskProperties(plugin, "property-assignees"))
						);
					setting.settingEl.addClass("tasknotes-field-status-setting");
					setting.settingEl.addClass("tasknotes-field-status-setting--warning");
				}
			});
		}
	);
}

/**
 * Section 3: Person Notes Source
 * Configure where person notes live (folder + optional tag filter)
 */
function renderPersonNotesSourceSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	t: (key: TranslationKey) => string
): void {
	createSettingGroup(
		container,
		{
			heading: t("settings.teamAttribution.personNotesSource.header" as TranslationKey),
			description: t("settings.teamAttribution.personNotesSource.description" as TranslationKey),
		},
		(group) => {
			// Person notes folder - with autocomplete
			group.addSetting((setting) => {
				setting
					.setName(t("settings.teamAttribution.personNotesSource.folder.name" as TranslationKey))
					.setDesc(t("settings.teamAttribution.personNotesSource.folder.description" as TranslationKey));

				// Create text input with folder suggest
				const inputEl = setting.controlEl.createEl("input", {
					type: "text",
					cls: "tasknotes-settings__card-input folder-suggest-input",
					attr: {
						placeholder: t("settings.teamAttribution.personNotesSource.folder.placeholder" as TranslationKey),
					},
				});
				inputEl.value = plugin.settings.personNotesFolder;

				// Attach folder suggester
				new FolderSuggest(plugin.app, inputEl);

				// Handle value changes
				inputEl.addEventListener("input", () => {
					plugin.settings.personNotesFolder = inputEl.value.trim();
					save();
				});
			});

			// Person tag filter (optional) - with autocomplete
			group.addSetting((setting) => {
				setting
					.setName(t("settings.teamAttribution.personNotesSource.tag.name" as TranslationKey))
					.setDesc(t("settings.teamAttribution.personNotesSource.tag.description" as TranslationKey));

				// Create text input with tag suggest
				const inputEl = setting.controlEl.createEl("input", {
					type: "text",
					cls: "tasknotes-settings__card-input tag-suggest-input",
					attr: {
						placeholder: t("settings.teamAttribution.personNotesSource.tag.placeholder" as TranslationKey),
					},
				});
				inputEl.value = plugin.settings.personNotesTag;

				// Attach tag suggester
				new TagSuggest(plugin.app, inputEl);

				// Handle value changes (strip # if user types it)
				inputEl.addEventListener("input", () => {
					const cleaned = inputEl.value.trim().replace(/^#/, "");
					if (inputEl.value !== cleaned) {
						inputEl.value = cleaned;
					}
					plugin.settings.personNotesTag = cleaned;
					save();
				});
			});

			// Person type value - what value identifies a person note
			group.addSetting((setting) => {
				const typeProp = plugin.settings.identityTypePropertyName || "type";
				const descEl = document.createDocumentFragment();
				descEl.append(
					Object.assign(document.createElement("span"), { textContent: `Notes with ` }),
					Object.assign(document.createElement("code"), { textContent: `${typeProp}: <this value>` }),
					Object.assign(document.createElement("span"), { textContent: ` are treated as person notes. Property name configured in ` }),
					Object.assign(document.createElement("a"), {
						textContent: "Task Properties",
						onclick: () => navigateToTaskProperties(plugin),
					}),
				);
				(descEl.lastChild as HTMLElement).style.cssText = "cursor: pointer; color: var(--text-accent);";
				setting
					.setName("Person type value")
					.then((s) => { s.descEl.empty(); s.descEl.append(descEl); })
					.addText((text) => {
						text
							.setPlaceholder("tn-person")
							.setValue(plugin.settings.personTypeValue);
						// Use native "change" event (fires on blur) instead of onChange (fires per keystroke)
						text.inputEl.addEventListener("change", async () => {
							const newVal = text.inputEl.value.trim() || "tn-person";
							const oldVal = plugin.settings.personTypeValue;
							if (newVal === oldVal) return;

							const propName = plugin.settings.identityTypePropertyName || "tnType";
							const folder = plugin.settings.personNotesFolder;
							const result = await migratePropertyValue({
								app: plugin.app,
								plugin,
								propertyName: propName,
								oldValue: oldVal,
								newValue: newVal,
								fileFilter: folder ? (f) => f.path.startsWith(folder) : undefined,
								description: "person notes",
							});

							if (result === "cancelled") {
								text.setValue(oldVal);
								return;
							}
							plugin.settings.personTypeValue = newVal;
							save();
						});
					});
			});
		}
	);
}

/**
 * Section 3.5: Group Notes
 * Configure where group notes live for team assignment
 */
function renderGroupNotesSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	t: (key: TranslationKey) => string
): void {
	createSettingGroup(
		container,
		{
			heading: "Group notes",
			description: `Groups allow assigning tasks to teams. Group notes need "${plugin.settings.identityTypePropertyName || "type"}: ${plugin.settings.groupTypeValue || "tn-group"}" in frontmatter and a members array.`,
		},
		(group) => {
			// Group notes folder - with autocomplete
			group.addSetting((setting) => {
				setting
					.setName("Group notes folder")
					.setDesc("Folder containing group notes. Leave empty to use same folder as person notes.");

				// Create text input with folder suggest
				const inputEl = setting.controlEl.createEl("input", {
					type: "text",
					cls: "tasknotes-settings__card-input folder-suggest-input",
					attr: {
						placeholder: "User-DB/Groups",
					},
				});
				inputEl.value = plugin.settings.groupNotesFolder;

				// Attach folder suggester
				new FolderSuggest(plugin.app, inputEl);

				// Handle value changes
				inputEl.addEventListener("input", () => {
					plugin.settings.groupNotesFolder = inputEl.value.trim();
					save();
				});
			});

			// Group tag filter (optional) - with autocomplete
			group.addSetting((setting) => {
				setting
					.setName("Group notes tag (optional)")
					.setDesc("Only include notes with this tag as groups");

				// Create text input with tag suggest
				const inputEl = setting.controlEl.createEl("input", {
					type: "text",
					cls: "tasknotes-settings__card-input tag-suggest-input",
					attr: {
						placeholder: "group",
					},
				});
				inputEl.value = plugin.settings.groupNotesTag;

				// Attach tag suggester
				new TagSuggest(plugin.app, inputEl);

				// Handle value changes (strip # if user types it)
				inputEl.addEventListener("input", () => {
					const cleaned = inputEl.value.trim().replace(/^#/, "");
					if (inputEl.value !== cleaned) {
						inputEl.value = cleaned;
					}
					plugin.settings.groupNotesTag = cleaned;
					save();
				});
			});

			// Group type value - what value identifies a group note
			group.addSetting((setting) => {
				const typeProp = plugin.settings.identityTypePropertyName || "type";
				const descEl = document.createDocumentFragment();
				descEl.append(
					Object.assign(document.createElement("span"), { textContent: `Notes with ` }),
					Object.assign(document.createElement("code"), { textContent: `${typeProp}: <this value>` }),
					Object.assign(document.createElement("span"), { textContent: ` are treated as group notes. Property name configured in ` }),
					Object.assign(document.createElement("a"), {
						textContent: "Task Properties",
						onclick: () => navigateToTaskProperties(plugin),
					}),
				);
				(descEl.lastChild as HTMLElement).style.cssText = "cursor: pointer; color: var(--text-accent);";
				setting
					.setName("Group type value")
					.then((s) => { s.descEl.empty(); s.descEl.append(descEl); })
					.addText((text) => {
						text
							.setPlaceholder("tn-group")
							.setValue(plugin.settings.groupTypeValue);
						// Use native "change" event (fires on blur) instead of onChange (fires per keystroke)
						text.inputEl.addEventListener("change", async () => {
							const newVal = text.inputEl.value.trim() || "tn-group";
							const oldVal = plugin.settings.groupTypeValue;
							if (newVal === oldVal) return;

							const propName = plugin.settings.identityTypePropertyName || "tnType";
							const folder = plugin.settings.groupNotesFolder || plugin.settings.personNotesFolder;
							const result = await migratePropertyValue({
								app: plugin.app,
								plugin,
								propertyName: propName,
								oldValue: oldVal,
								newValue: newVal,
								fileFilter: folder ? (f) => f.path.startsWith(folder) : undefined,
								description: "group notes",
							});

							if (result === "cancelled") {
								text.setValue(oldVal);
								return;
							}
							plugin.settings.groupTypeValue = newVal;
							save();
						});
					});
			});

			// Discovery statistics + management
			group.addSetting((setting) => {
				setting
					.setName("Discovery")
					.setDesc("Persons and groups found in configured folders");

				const statsContainer = setting.controlEl.createDiv({ cls: "tasknotes-discovery-stats" });
				const detailsContainer = setting.controlEl.createDiv({ cls: "tasknotes-discovery-details" });
				detailsContainer.style.display = "none";

				const refreshDiscovery = async () => {
					statsContainer.empty();
					detailsContainer.empty();

					const persons = plugin.personNoteService?.discoverPersons() || [];
					const groups = await plugin.groupRegistry.discoverGroups();

					// Sort alphabetically
					persons.sort((a, b) => a.displayName.localeCompare(b.displayName));
					groups.sort((a, b) => a.displayName.localeCompare(b.displayName));

					// Summary line
					const summaryEl = statsContainer.createDiv({ cls: "tasknotes-discovery-stats__summary" });
					summaryEl.textContent = `${persons.length} person${persons.length !== 1 ? "s" : ""} \u00B7 ${groups.length} group${groups.length !== 1 ? "s" : ""}`;

					// Toggle details link
					if (persons.length > 0 || groups.length > 0) {
						const toggleLink = statsContainer.createEl("a", {
							text: "Show details",
							cls: "tasknotes-discovery-stats__toggle",
						});
						toggleLink.style.cssText = "cursor: pointer; color: var(--text-accent); font-size: var(--font-ui-smaller); margin-left: 8px;";
						let detailsOpen = false;
						toggleLink.addEventListener("click", () => {
							detailsOpen = !detailsOpen;
							detailsContainer.style.display = detailsOpen ? "block" : "none";
							toggleLink.textContent = detailsOpen ? "Hide details" : "Show details";
						});

						// --- People section ---
						const peopleSection = detailsContainer.createDiv({ cls: "tn-discovery-section" });
						const peopleHeader = peopleSection.createDiv({ cls: "tn-discovery-section__header tn-discovery-section__header--collapsible" });
						const peopleChevron = peopleHeader.createSpan({ cls: "tn-discovery-section__chevron" });
						setIcon(peopleChevron, "chevron-down");
						setIcon(peopleHeader.createSpan(), "user");
						peopleHeader.createSpan({ text: ` People (${persons.length})` });
						const peopleBody = peopleSection.createDiv({ cls: "tn-discovery-section__body" });

						// Collapsible state from localStorage
						const peopleCollapsed = localStorage.getItem("tn-discovery-people-collapsed") === "true";
						if (peopleCollapsed) {
							peopleBody.style.display = "none";
							peopleChevron.classList.add("is-collapsed");
						}
						peopleHeader.addEventListener("click", () => {
							const isNowCollapsed = peopleBody.style.display !== "none";
							peopleBody.style.display = isNowCollapsed ? "none" : "";
							peopleChevron.classList.toggle("is-collapsed", isNowCollapsed);
							localStorage.setItem("tn-discovery-people-collapsed", String(isNowCollapsed));
						});

						if (persons.length === 0) {
							const emptyEl = peopleBody.createDiv({ cls: "tn-discovery-section__empty" });
							if (!plugin.settings.personNotesFolder) {
								emptyEl.innerHTML = "No folder configured. Set a <em>Person notes folder</em> above to discover team members.";
							} else {
								emptyEl.textContent = `No person notes found in ${plugin.settings.personNotesFolder}`;
							}
						} else {
							for (const p of persons) {
								const row = peopleBody.createDiv({ cls: "tn-discovery-row" });
								const avatarEl = createAvatar({ name: p.displayName, size: "sm" });
								row.appendChild(avatarEl);
								const info = row.createDiv({ cls: "tn-discovery-row__info" });
								info.createDiv({ cls: "tn-discovery-row__name", text: p.displayName });
								const meta: string[] = [];
								if (p.role) meta.push(p.role);
								if (p.department) meta.push(p.department);
								if (meta.length > 0) {
									info.createDiv({ cls: "tn-discovery-row__meta", text: meta.join(" \u00B7 ") });
								}
								const openBtn = row.createEl("a", { cls: "tn-discovery-row__action", attr: { "aria-label": "Open note" } });
								setIcon(openBtn, "external-link");
								openBtn.style.cssText = "cursor: pointer; color: var(--text-muted); opacity: 0.6;";
								openBtn.addEventListener("click", () => {
									plugin.app.workspace.openLinkText(p.path, "", false);
								});
								openBtn.addEventListener("mouseenter", () => { openBtn.style.opacity = "1"; });
								openBtn.addEventListener("mouseleave", () => { openBtn.style.opacity = "0.6"; });
							}
						}

						// --- Groups section ---
						const groupsSection = detailsContainer.createDiv({ cls: "tn-discovery-section" });
						const groupsHeader = groupsSection.createDiv({ cls: "tn-discovery-section__header tn-discovery-section__header--collapsible" });
						const groupsChevron = groupsHeader.createSpan({ cls: "tn-discovery-section__chevron" });
						setIcon(groupsChevron, "chevron-down");
						setIcon(groupsHeader.createSpan(), "users");
						groupsHeader.createSpan({ text: ` Groups (${groups.length})` });
						const groupsBody = groupsSection.createDiv({ cls: "tn-discovery-section__body" });

						// Collapsible state from localStorage
						const groupsCollapsed = localStorage.getItem("tn-discovery-groups-collapsed") === "true";
						if (groupsCollapsed) {
							groupsBody.style.display = "none";
							groupsChevron.classList.add("is-collapsed");
						}
						groupsHeader.addEventListener("click", () => {
							const isNowCollapsed = groupsBody.style.display !== "none";
							groupsBody.style.display = isNowCollapsed ? "none" : "";
							groupsChevron.classList.toggle("is-collapsed", isNowCollapsed);
							localStorage.setItem("tn-discovery-groups-collapsed", String(isNowCollapsed));
						});

						if (groups.length === 0) {
							const emptyEl = groupsBody.createDiv({ cls: "tn-discovery-section__empty" });
							if (!plugin.settings.groupNotesFolder) {
								emptyEl.innerHTML = "No folder configured. Set a <em>Group notes folder</em> above to discover teams.";
							} else {
								emptyEl.textContent = `No group notes found in ${plugin.settings.groupNotesFolder}`;
							}
						} else {
							for (const g of groups) {
								const row = groupsBody.createDiv({ cls: "tn-discovery-row" });
								const avatarEl = createAvatar({ name: g.displayName, size: "sm", isGroup: true });
								row.appendChild(avatarEl);
								const info = row.createDiv({ cls: "tn-discovery-row__info" });
								info.createDiv({ cls: "tn-discovery-row__name", text: g.displayName });
								// Resolve member display names from paths
								const memberNames = g.memberPaths.map((mp: string) => {
									const basename = mp.replace(/\.md$/, "").split("/").pop() || mp;
									return basename;
								});
								const memberCount = memberNames.length;
								let memberText = `${memberCount} member${memberCount !== 1 ? "s" : ""}`;
								if (memberCount > 0 && memberCount <= 5) {
									memberText += `: ${memberNames.join(", ")}`;
								} else if (memberCount > 5) {
									memberText += `: ${memberNames.slice(0, 3).join(", ")} +${memberCount - 3} more`;
								}
								info.createDiv({ cls: "tn-discovery-row__meta", text: memberText });
								const openBtn = row.createEl("a", { cls: "tn-discovery-row__action", attr: { "aria-label": "Open note" } });
								setIcon(openBtn, "external-link");
								openBtn.style.cssText = "cursor: pointer; color: var(--text-muted); opacity: 0.6;";
								openBtn.addEventListener("click", () => {
									plugin.app.workspace.openLinkText(g.notePath, "", false);
								});
								openBtn.addEventListener("mouseenter", () => { openBtn.style.opacity = "1"; });
								openBtn.addEventListener("mouseleave", () => { openBtn.style.opacity = "0.6"; });
							}
						}
					}

				};

				// Buttons: Refresh, Create person, Create group
				setting.addButton((btn) => {
					btn.setButtonText("Refresh")
						.onClick(refreshDiscovery);
				});
				setting.addButton((btn) => {
					btn.setButtonText("Create person")
						.onClick(() => openCreatePersonGroupModal(plugin, "person", save, () => refreshDiscovery()));
				});
				setting.addButton((btn) => {
					btn.setButtonText("Create group")
						.onClick(() => openCreatePersonGroupModal(plugin, "group", save, () => refreshDiscovery()));
				});

				// Initial load
				refreshDiscovery();
			});
		}
	);
}

/**
 * Section 4: Your Identity
 * Link this device to your person note
 */
function renderYourIdentitySection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	t: (key: TranslationKey) => string
): void {
	createSettingGroup(
		container,
		{
			heading: t("settings.teamAttribution.yourIdentity.header" as TranslationKey),
			description: t("settings.teamAttribution.yourIdentity.description" as TranslationKey),
		},
		(group) => {
			// Device ID (read-only display)
			const shortId = plugin.deviceIdentityManager.getShortDeviceId();
			const fullId = plugin.deviceIdentityManager.getOrCreateDeviceId();

			group.addSetting((setting) => {
				setting
					.setName(t("settings.teamAttribution.yourIdentity.deviceId" as TranslationKey))
					.setDesc(t("settings.teamAttribution.yourIdentity.deviceIdDescription" as TranslationKey) + ` (${fullId})`)
					.addText((text) => {
						text.setValue(shortId).setDisabled(true);
						text.inputEl.addClass("tasknotes-device-id-display");
					});
			});

			// Registration status
			const currentMapping = plugin.userRegistry.getCurrentMapping();
			const isRegistered = currentMapping !== null;

			if (isRegistered && currentMapping) {
				// Check if person note file still exists
				let personFile = plugin.app.vault.getAbstractFileByPath(currentMapping.userNotePath);
				if (!personFile) {
					const linkPath = currentMapping.userNotePath.replace(/\.md$/, "");
					personFile = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, "");
				}
				const fileExists = personFile instanceof TFile;

				// Show current registration with avatar
				const displayName =
					currentMapping.userDisplayName ||
					currentMapping.userNotePath.split("/").pop()?.replace(/\.md$/, "") ||
					"Unknown";

				group.addSetting((setting) => {
					const descText = fileExists
						? currentMapping.userNotePath
						: `⚠️ File not found: ${currentMapping.userNotePath}`;
					setting
						.setName(t("settings.teamAttribution.yourIdentity.registered" as TranslationKey))
						.setDesc(descText);

					// Create clickable avatar + name container
					const avatarContainer = setting.controlEl.createDiv({
						cls: "tasknotes-identity-avatar-row",
					});

					if (fileExists) {
						avatarContainer.setAttribute("role", "button");
						avatarContainer.setAttribute("tabindex", "0");
						avatarContainer.title = "Click to open person note";
					}

					// Add avatar (with custom color if set)
					const avatar = createAvatar({
						name: displayName,
						size: "md",
						tooltip: fileExists ? `Open ${displayName}` : `${displayName} (file missing)`,
						color: currentMapping.avatarColor,
					});
					avatar.style.cursor = fileExists ? "pointer" : "default";
					if (!fileExists) {
						avatar.style.opacity = "0.6";
					}
					avatarContainer.appendChild(avatar);

					// Add name text
					const nameEl = avatarContainer.createSpan({
						cls: "tasknotes-identity-name",
						text: displayName,
					});
					if (!fileExists) {
						nameEl.style.color = "var(--text-warning)";
					}

					// Click handler to open the person note (only if file exists)
					if (fileExists) {
						const openPersonNote = async () => {
							await plugin.app.workspace.getLeaf().openFile(personFile as TFile);
						};

						avatarContainer.addEventListener("click", openPersonNote);
						avatarContainer.addEventListener("keydown", (e: KeyboardEvent) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								openPersonNote();
							}
						});
					}

					// Add action buttons
					setting
						.addButton((button) => {
							button.setButtonText("Edit").onClick(() => {
								// Toggle edit section visibility
								const parentEl = setting.settingEl.parentElement;
								if (!parentEl) return;
								const existingEdit = parentEl.querySelector(".tasknotes-identity-edit");
								if (existingEdit) {
									existingEdit.remove();
								} else {
									renderIdentityEditSection(parentEl, plugin, currentMapping, save, container);
								}
							});
						})
						.addButton((button) => {
							button.setButtonText("Change").onClick(() => {
								openPersonNoteSelector(plugin, save, container);
							});
						})
						.addButton((button) => {
							button
								.setButtonText(t("settings.teamAttribution.yourIdentity.unregisterButton" as TranslationKey))
								.setWarning()
								.onClick(async () => {
									await plugin.userRegistry.unregisterDevice();
									new Notice(t("settings.teamAttribution.yourIdentity.unregistrationSuccess" as TranslationKey));
									renderSharedVaultTab(container, plugin, save);
								});
						});
				});

				// Show warning if file is missing
				if (!fileExists) {
					group.addSetting((setting) => {
						setting
							.setName("⚠️ Person note missing")
							.setDesc("The linked person note was deleted or moved. Select a new one or the avatar data will be preserved from settings.")
							.addButton((button) => {
								button
									.setButtonText("Select new person note")
									.setCta()
									.onClick(() => {
										openPersonNoteSelector(plugin, save, container);
									});
							});
					});
				}
			} else {
				// Show registration button
				group.addSetting((setting) => {
					setting
						.setName(t("settings.teamAttribution.yourIdentity.notRegistered" as TranslationKey))
						.setDesc(t("settings.teamAttribution.yourIdentity.selectPersonNote" as TranslationKey))
						.addButton((button) => {
							button
								.setButtonText(t("settings.teamAttribution.yourIdentity.registerButton" as TranslationKey))
								.setCta()
								.onClick(() => {
									openPersonNoteSelector(plugin, save, container);
								});
						});
				});
			}
		}
	);
}

/**
 * Navigate to Task Properties tab and scroll to Team & Attribution Properties section
 */
function navigateToTaskProperties(plugin: TaskNotesPlugin, cardId = "property-type"): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab && settingsTab.containerEl) {
		// Force re-render by clearing target tab
		const tabContent = settingsTab.containerEl.querySelector(
			"#settings-tab-task-properties"
		) as HTMLElement;
		if (tabContent) {
			tabContent.empty();
		}

		const tabButton = settingsTab.containerEl.querySelector("#tab-button-task-properties") as HTMLElement;
		if (tabButton) {
			tabButton.click();
			// After tab switch, scroll to the target card
			setTimeout(() => {
				const targetCard = settingsTab.containerEl.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement;
				if (targetCard) {
					targetCard.scrollIntoView({ behavior: "smooth", block: "start" });
					// Brief highlight to draw attention
					targetCard.style.outline = "2px solid var(--text-accent)";
					targetCard.style.borderRadius = "var(--radius-m)";
					setTimeout(() => { targetCard.style.outline = ""; targetCard.style.borderRadius = ""; }, 2000);
				}
			}, 200);
		}
	}
}

/**
 * Navigate to Task Properties tab and scroll to the Reminders property card
 */
function navigateToReminders(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab?.containerEl) {
		const tabButton = settingsTab.containerEl.querySelector("#tab-button-task-properties") as HTMLElement;
		if (tabButton) {
			tabButton.click();
			setTimeout(() => {
				const reminderCard = settingsTab.containerEl.querySelector('[data-card-id="property-reminders"]') as HTMLElement;
				if (reminderCard) {
					reminderCard.scrollIntoView({ behavior: "smooth", block: "start" });
					reminderCard.style.outline = "2px solid var(--text-accent)";
					reminderCard.style.borderRadius = "var(--radius-m)";
					setTimeout(() => { reminderCard.style.outline = ""; reminderCard.style.borderRadius = ""; }, 2000);
				}
			}, 200);
		}
	}
}

/**
 * Navigate to Features tab and scroll to Notifications section
 */
function navigateToFeatures(plugin: TaskNotesPlugin): void {
	const settingsTab = (plugin.app as any).setting?.activeTab;
	if (settingsTab?.containerEl) {
		const tabContent = settingsTab.containerEl.querySelector(
			"#tab-content-features"
		) as HTMLElement;
		if (tabContent) {
			tabContent.empty();
		}
		const tabButton = settingsTab.containerEl.querySelector(
			"#tab-button-features"
		) as HTMLElement;
		if (tabButton) {
			tabButton.click();
			setTimeout(() => {
				const headings = settingsTab.containerEl.querySelectorAll(
					".setting-item-heading .setting-item-name"
				);
				for (const heading of headings) {
					if (heading.textContent?.toLowerCase().includes("notifications")) {
						(heading as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
						break;
					}
				}
			}, 200);
		}
	}
}

/**
 * Section 5: Registered Team Members
 * All devices that have registered in this vault
 */
function renderTeamMembersSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	t: (key: TranslationKey) => string
): void {
	const allMappings = plugin.userRegistry.getAllMappings();

	createSettingGroup(
		container,
		{
			heading: t("settings.teamAttribution.teamMembers.header" as TranslationKey),
			description: t("settings.teamAttribution.teamMembers.description" as TranslationKey),
		},
		(group) => {
			if (allMappings.length === 0) {
				group.addSetting((setting) => {
					setting
						.setName(t("settings.teamAttribution.teamMembers.noMembers" as TranslationKey))
						.setDesc("");
				});
				return;
			}

			for (const mapping of allMappings) {
				const isCurrentDevice =
					mapping.deviceId === plugin.deviceIdentityManager.getOrCreateDeviceId();
				const lastSeenDate = new Date(mapping.lastSeen).toLocaleDateString();
				const displayName =
					mapping.userDisplayName ||
					mapping.userNotePath.split("/").pop()?.replace(/\.md$/, "") ||
					"Unknown";

				group.addSetting((setting) => {
					const deviceLabel = `${mapping.deviceName}${isCurrentDevice ? " (this device)" : ""}`;
					const desc = `${t("settings.teamAttribution.teamMembers.person" as TranslationKey)}: ${displayName} • ${t("settings.teamAttribution.teamMembers.lastSeen" as TranslationKey)}: ${lastSeenDate}`;

					setting.setName(deviceLabel).setDesc(desc);

					if (!isCurrentDevice) {
						setting.addButton((button) => {
							button
								.setButtonText(t("settings.teamAttribution.teamMembers.removeDevice" as TranslationKey))
								.setWarning()
								.onClick(async () => {
									await plugin.userRegistry.removeMappingByDeviceId(mapping.deviceId);
									new Notice(`Removed ${mapping.deviceName}`);
									renderSharedVaultTab(container, plugin, save);
								});
						});
					}
				});
			}
		}
	);
}

/**
 * Section 6: Notification Scope (per-device)
 * Controls what notifications this device receives.
 * Settings stored in localStorage via DevicePreferencesManager.
 */
function renderNotificationFilteringSection(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	t: (key: TranslationKey) => string
): void {
	const devicePrefs = plugin.devicePrefs;
	const deviceName = plugin.deviceIdentityManager.getDeviceName();
	const shortId = plugin.deviceIdentityManager.getShortDeviceId();

	createSettingGroup(
		container,
		{
			heading: "Notification scope",
			description: `Per-device settings for "${deviceName}" (${shortId}). These settings are stored locally and do not sync across devices.`,
		},
		(group) => {
			// Cross-link to vault-wide notification settings
			group.addSetting((setting) => {
				const descEl = setting.descEl;
				setting.setName("Vault defaults");
				descEl.appendText("The vault-wide notification enable/disable and default delivery type are in ");
				const linkEl = descEl.createEl("a", {
					text: "Features \u2192",
					href: "#",
				});
				linkEl.addEventListener("click", (e) => {
					e.preventDefault();
					navigateToFeatures(plugin);
				});
			});

			// Notification type override (per-device)
			group.addSetting((setting) => {
				const vaultDefault = plugin.settings.notificationType || "in-app";
				const hasOverride = devicePrefs.hasNotificationTypeOverride();
				const desc = hasOverride
					? `Vault default: ${vaultDefault}`
					: "Using vault default";
				setting
					.setName("Notification type")
					.setDesc(desc)
					.addDropdown((dropdown) =>
						dropdown
							.addOption("vault-default", `Vault default (${vaultDefault})`)
							.addOption("in-app", "In-app notice")
							.addOption("system", "System notification")
							.addOption("both", "Both (system + in-app)")
							.setValue(hasOverride ? devicePrefs.getNotificationType() : "vault-default")
							.onChange((value) => {
								if (value === "vault-default") {
									devicePrefs.clearOverride("notificationType");
								} else {
									devicePrefs.update({ notificationType: value as "in-app" | "system" | "both" });
								}
								renderSharedVaultTab(container, plugin, save);
							})
					);
			});

			// Test notification button
			group.addSetting((setting) => {
				setting
					.setName("Test notification")
					.setDesc("Send a test notification using the current delivery type for this device.")
					.addButton((button) =>
						button
							.setButtonText("Send test")
							.onClick(() => {
								const type = devicePrefs.getNotificationType();
								sendTestNotification(type, plugin);
							})
					);
			});

			// System notification troubleshooting (show when effective type includes system)
			{
				const effectiveType = devicePrefs.getNotificationType();
				if (effectiveType === "system" || effectiveType === "both") {
					group.addSetting((setting) => {
						const descEl = setting.descEl;
						setting.setName("System notification troubleshooting");
						const permStatus = "Notification" in window ? Notification.permission : "unavailable";
						descEl.appendText(`Browser permission: ${permStatus}. `);

						const detailsEl = descEl.createEl("details");
						detailsEl.createEl("summary", {
							text: "Not seeing system notifications?",
						});
						const list = detailsEl.createEl("ul");
						list.style.marginTop = "4px";
						list.style.paddingLeft = "16px";
						list.createEl("li", {
							text: "Windows: Settings \u2192 System \u2192 Notifications. Make sure Obsidian is listed and allowed, banners are enabled, and Do Not Disturb / Focus Assist is off.",
						});
						list.createEl("li", {
							text: "macOS: System Settings \u2192 Notifications \u2192 Obsidian. Ensure alerts are enabled and Focus is off.",
						});
						list.createEl("li", {
							text: "Linux: Check your desktop environment's notification daemon is running.",
						});

						const knownIssueLi = list.createEl("li");
						knownIssueLi.appendText("Known Electron limitation: On Windows, Obsidian may not register as a notification sender with the OS. If Obsidian does not appear in your Windows notification settings, system notifications will silently fail. This is an ");
						knownIssueLi.createEl("a", {
							text: "upstream Electron issue",
							href: "https://github.com/electron/electron/issues/4973",
						});
						knownIssueLi.appendText(" that requires a fix from the Obsidian team (");
						knownIssueLi.createEl("a", {
							text: "related discussion",
							href: "https://github.com/uphy/obsidian-reminder/issues/73",
						});
						knownIssueLi.appendText("). Use \"In-app\" or \"Both\" as a workaround.");

						list.createEl("li", {
							text: "Obsidian cannot detect if your OS silently suppressed a notification (e.g., via Do Not Disturb). If the test fires but nothing appears, the OS is blocking it.",
						});
					});
				}
			}

			// Filter by assignment toggle (per-device)
			group.addSetting((setting) => {
				const vaultDefault = plugin.settings.vaultWideNotifications?.onlyNotifyIfAssignedToMe ?? false;
				const hasOverride = devicePrefs.hasFilterByAssignmentOverride();
				const effectiveValue = devicePrefs.getFilterByAssignment();
				const desc = hasOverride
					? `Per-device override active. Vault default: ${vaultDefault ? "on" : "off"}`
					: "Only receive notifications for tasks where you (or a group you belong to) are listed as an assignee.";
				setting
					.setName("Filter by assignment")
					.setDesc(desc)
					.addToggle((toggle) =>
						toggle
							.setValue(effectiveValue)
							.onChange((value) => {
								devicePrefs.updateScope({ filterByAssignment: value });
								renderSharedVaultTab(container, plugin, save);
							})
					);
			});

			// Show dependent settings only when filtering is enabled
			if (devicePrefs.getFilterByAssignment()) {
				// Include unassigned tasks toggle (per-device)
				group.addSetting((setting) => {
					setting
						.setName("Include unassigned tasks")
						.setDesc("Also receive notifications for tasks that have no assignee.")
						.addToggle((toggle) =>
							toggle
								.setValue(devicePrefs.getIncludeUnassignedTasks())
								.onChange((value) => {
									devicePrefs.updateScope({ includeUnassignedTasks: value });
								})
						);
				});

				// Current identity status
				const currentUser = plugin.userRegistry?.getCurrentUser();
				const currentUserDisplay = plugin.userRegistry?.getCurrentUserDisplayName();

				if (currentUser) {
					group.addSetting((setting) => {
						setting
							.setName("Your identity")
							.setDesc(`Filtering notifications for: ${currentUserDisplay || currentUser}`);
					});

					// Show person-specific reminder preferences (editable)
					if (plugin.personNoteService) {
						const prefs = plugin.personNoteService.getPreferences(currentUser);
						const hasCustom = plugin.personNoteService.hasCustomLeadTimes(currentUser);

						// Header with explanation + Edit in note button
						group.addSetting((setting) => {
							setting.setName("Person reminder preferences");
							setting.settingEl.dataset.cardId = "person-reminder-preferences";
							const descEl = setting.descEl;
							descEl.empty();
							descEl.appendText(
								"These preferences are stored in your person note and control how you get reminded about tasks. " +
								"They relate to the Global reminders configured in "
							);
							const linkEl = descEl.createEl("a", { text: "Task Properties \u2192 Reminders" });
							linkEl.style.cssText = "cursor: pointer; color: var(--text-accent)";
							linkEl.addEventListener("click", (e) => {
								e.preventDefault();
								navigateToReminders(plugin);
							});
							descEl.appendText(". Your personal settings can override or add to those global rules.");

							setting.addButton((btn) => {
								btn.setButtonText("Edit in note").onClick(async () => {
									let file = plugin.app.vault.getAbstractFileByPath(currentUser);
									if (!file) {
										const linkPath = currentUser.replace(/\.md$/, "");
										file = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, "");
									}
									if (file instanceof TFile) {
										(plugin.app as any).setting?.close();
										await plugin.app.workspace.getLeaf().openFile(file);
									} else {
										new Notice(`Person note not found: ${currentUser}`);
									}
								});
							});
						});

						// Availability window inputs
						group.addSetting((setting) => {
							setting
								.setName("Available from")
								.setDesc("Start of your typical availability. Day-or-longer reminders arrive at this time. Reminders computed before this time are deferred here.")
								.addText((text) => {
									text.setPlaceholder("09:00")
										.setValue(prefs.availableFrom)
										.onChange(async (value) => {
											if (/^\d{1,2}:\d{2}$/.test(value)) {
												await updatePersonFrontmatter(plugin, currentUser, (fm) => {
													fm.availableFrom = value;
													// Clean up legacy field if present
													if (fm.reminderTime !== undefined) {
														delete fm.reminderTime;
													}
												});
											}
										});
									text.inputEl.style.width = "80px";
								});
						});

						group.addSetting((setting) => {
							setting
								.setName("Available until")
								.setDesc("End of your typical availability. Reminders computed after this time are deferred to the next day's \"available from\" time.")
								.addText((text) => {
									text.setPlaceholder("17:00")
										.setValue(prefs.availableUntil)
										.onChange(async (value) => {
											if (/^\d{1,2}:\d{2}$/.test(value)) {
												await updatePersonFrontmatter(plugin, currentUser, (fm) => {
													fm.availableUntil = value;
												});
											}
										});
									text.inputEl.style.width = "80px";
								});
						});

						// Notifications enabled toggle
						group.addSetting((setting) => {
							setting
								.setName("Notifications enabled")
								.setDesc("Master switch for all reminders on this device's person")
								.addToggle((toggle) => {
									toggle.setValue(prefs.notificationEnabled).onChange(async (value) => {
										await updatePersonFrontmatter(plugin, currentUser, (fm) => {
											fm.notificationEnabled = value;
										});
									});
								});
						});

						// Override/additive toggle
						group.addSetting((setting) => {
							setting
								.setName("Override global reminders")
								.setDesc("When enabled, your personal reminders replace the global lead-time rules. When disabled, they're added alongside them.")
								.addToggle((toggle) => {
									toggle.setValue(prefs.overrideGlobalReminders).onChange(async (value) => {
										await updatePersonFrontmatter(plugin, currentUser, (fm) => {
											fm.overrideGlobalReminders = value;
										});
										renderSharedVaultTab(container, plugin, save);
									});
								});
						});

						// Personal global reminders header
						group.addSetting((setting) => {
							setting.setName("Personal global reminders");
							const overrideMode = prefs.overrideGlobalReminders ? "override" : "add to";
							setting.setDesc(
								hasCustom
									? `You have ${prefs.reminderLeadTimes.length} personal reminder(s). These ${overrideMode} the Global reminders in Task Properties \u2192 Reminders.`
									: "No personal reminders set \u2014 using the Global reminders from Task Properties \u2192 Reminders. Add your own below."
							);
						});

						// Existing lead times with delete buttons
						for (let i = 0; i < prefs.reminderLeadTimes.length; i++) {
							const lt = prefs.reminderLeadTimes[i];
							group.addSetting((setting) => {
								setting.setName(`${lt.value} ${lt.unit} before anchor`);
								setting.addButton((btn) => {
									btn.setIcon("x")
										.setTooltip("Remove this lead time")
										.onClick(async () => {
											await updatePersonFrontmatter(plugin, currentUser, (fm) => {
												if (Array.isArray(fm.reminderLeadTimes)) {
													fm.reminderLeadTimes = (fm.reminderLeadTimes as LeadTime[]).filter(
														(_: LeadTime, idx: number) => idx !== i
													);
													if ((fm.reminderLeadTimes as LeadTime[]).length === 0) {
														delete fm.reminderLeadTimes;
													}
												}
											});
											renderSharedVaultTab(container, plugin, save);
										});
								});
							});
						}

						// Add new lead time
						group.addSetting((setting) => {
							let newValue = 1;
							let newUnit: LeadTime["unit"] = "days";
							setting.setName("Add personal reminder");
							setting.addText((text) => {
								text.setPlaceholder("1")
									.setValue("1")
									.onChange((v) => {
										const parsed = parseInt(v, 10);
										if (!isNaN(parsed) && parsed > 0) newValue = parsed;
									});
								text.inputEl.style.width = "50px";
								text.inputEl.type = "number";
								text.inputEl.min = "1";
							});
							setting.addDropdown((dd) => {
								dd.addOption("minutes", "minutes")
									.addOption("hours", "hours")
									.addOption("days", "days")
									.addOption("weeks", "weeks")
									.setValue("days")
									.onChange((v) => {
										newUnit = v as LeadTime["unit"];
									});
							});
							setting.addButton((btn) => {
								btn.setButtonText("Add").setCta().onClick(async () => {
									await updatePersonFrontmatter(plugin, currentUser, (fm) => {
										if (!Array.isArray(fm.reminderLeadTimes)) {
											fm.reminderLeadTimes = [];
										}
										(fm.reminderLeadTimes as LeadTime[]).push({
											value: newValue,
											unit: newUnit,
										});
									});
									renderSharedVaultTab(container, plugin, save);
								});
							});
						});
					}
				} else {
					group.addSetting((setting) => {
						setting
							.setName("No identity registered")
							.setDesc("Register your device in 'Your identity' above to enable assignment filtering. Until then, all notifications will be shown.");
					});
				}
			}

			// Info text explaining the scope model
			group.addSetting((setting) => {
				setting
					.setName("How notification scope works")
					.setDesc(
						"When filtering is enabled, you receive reminders for tasks where your person note appears in the assignee field. " +
						"This includes direct assignment and group membership. " +
						"Future versions will support per-reminder targeting, allowing task creators to send specific reminders to specific people regardless of task assignment."
					);
			});
		}
	);
}

/**
 * Opens the file selector modal for choosing a person note
 * Filtered by personNotesFolder and personNotesTag settings
 */
function openPersonNoteSelector(
	plugin: TaskNotesPlugin,
	save: () => void,
	container: HTMLElement
): void {
	const folder = plugin.settings.personNotesFolder;
	const tag = plugin.settings.personNotesTag;

	openFileSelector(
		plugin,
		async (file) => {
			if (file && file instanceof TFile) {
				// Get display name from frontmatter title or filename
				const cache = plugin.app.metadataCache.getFileCache(file);
				const titleField = plugin.fieldMapper.toUserField("title");
				const displayName = cache?.frontmatter?.[titleField] || file.basename;

				await plugin.userRegistry.registerDevice(file.path, displayName);
				new Notice(plugin.i18n.translate("settings.teamAttribution.yourIdentity.registrationSuccess" as TranslationKey));
				renderSharedVaultTab(container, plugin, save);
			}
		},
		{
			title: plugin.i18n.translate("settings.teamAttribution.yourIdentity.selectPersonNote" as TranslationKey),
			placeholder: "Search for a person note...",
			filter: (file: TFile) => {
				// Only markdown files
				if (file.extension !== "md") return false;

				// Folder filter
				if (folder) {
					const normalizedFolder = folder.endsWith("/") ? folder : folder + "/";
					if (!file.path.startsWith(normalizedFolder) && file.path !== folder + ".md") {
						// Check if file is in the folder or is the folder note itself
						const fileFolder = file.parent?.path || "";
						if (!fileFolder.startsWith(folder.replace(/\/$/, ""))) {
							return false;
						}
					}
				}

				// Tag filter
				if (tag) {
					const cache = plugin.app.metadataCache.getFileCache(file);
					if (!cache) return false;

					// Check frontmatter tags
					const fmTags = cache.frontmatter?.tags;
					const hasFmTag = Array.isArray(fmTags)
						? fmTags.some((t: string) => t === tag || t === `#${tag}`)
						: typeof fmTags === "string" && (fmTags === tag || fmTags === `#${tag}`);

					// Check inline tags
					const inlineTags = cache.tags?.map((t) => t.tag.replace(/^#/, "")) || [];
					const hasInlineTag = inlineTags.includes(tag);

					if (!hasFmTag && !hasInlineTag) return false;
				}

				return true;
			},
			showAvatars: true,
			avatarSize: "sm",
		}
	);
}

/**
 * Renders the identity edit section with display name and color picker
 */
function renderIdentityEditSection(
	parentEl: HTMLElement,
	plugin: TaskNotesPlugin,
	mapping: DeviceUserMapping,
	save: () => void,
	container: HTMLElement
): void {
	const editSection = parentEl.createDiv({
		cls: "tasknotes-identity-edit",
	});

	// Display name input
	new Setting(editSection)
		.setName("Display name")
		.setDesc("Override the name shown in the avatar")
		.addText((text) => {
			text
				.setPlaceholder("Leave empty to use file name")
				.setValue(mapping.userDisplayName || "")
				.onChange(async (value) => {
					await plugin.userRegistry.updateMapping(mapping.deviceId, {
						userDisplayName: value || undefined,
					});
					save();
				});
		});

	// Color picker
	const defaultColor = getColorFromName(
		mapping.userDisplayName ||
		mapping.userNotePath.split("/").pop()?.replace(/\.md$/, "") ||
		"Unknown"
	);

	new Setting(editSection)
		.setName("Avatar color")
		.setDesc("Choose a custom color for the avatar")
		.addColorPicker((picker) => {
			picker
				.setValue(mapping.avatarColor || defaultColor)
				.onChange(async (value) => {
					await plugin.userRegistry.updateMapping(mapping.deviceId, {
						avatarColor: value,
					});
					save();
					// Re-render to show new color
					renderSharedVaultTab(container, plugin, save);
				});
		})
		.addButton((button) => {
			button
				.setButtonText("Reset")
				.onClick(async () => {
					await plugin.userRegistry.updateMapping(mapping.deviceId, {
						avatarColor: undefined,
					});
					save();
					renderSharedVaultTab(container, plugin, save);
				});
		});

	// Done button
	new Setting(editSection)
		.addButton((button) => {
			button
				.setButtonText("Done")
				.setCta()
				.onClick(() => {
					editSection.remove();
					// Re-render to apply changes
					renderSharedVaultTab(container, plugin, save);
				});
		});
}

/**
 * Mini form modal for creating a new person or group note.
 */
function openCreatePersonGroupModal(
	plugin: TaskNotesPlugin,
	type: "person" | "group",
	save: () => void,
	onCreated: () => void
): void {
	const modal = new Modal(plugin.app);
	modal.titleEl.setText(type === "person" ? "Create person note" : "Create group note");

	const { contentEl } = modal;
	contentEl.addClass("tasknotes-plugin");

	let name = "";
	let role = "";
	let department = "";

	// Name field (required)
	new Setting(contentEl)
		.setName("Name")
		.setDesc("Display name for the " + type)
		.addText((text) => {
			text.setPlaceholder(type === "person" ? "Jane Doe" : "Engineering Team");
			text.onChange((v) => { name = v.trim(); });
			// Auto-focus
			setTimeout(() => text.inputEl.focus(), 50);
		});

	if (type === "person") {
		new Setting(contentEl)
			.setName("Role (optional)")
			.addText((text) => {
				text.setPlaceholder("Software Engineer");
				text.onChange((v) => { role = v.trim(); });
			});

		new Setting(contentEl)
			.setName("Department (optional)")
			.addText((text) => {
				text.setPlaceholder("Engineering");
				text.onChange((v) => { department = v.trim(); });
			});
	}

	// Members picker (groups only)
	let selectedMemberPaths: string[] = [];
	let memberPicker: ReturnType<typeof createPersonGroupPicker> | null = null;
	if (type === "group") {
		const memberSetting = new Setting(contentEl)
			.setName("Members")
			.setDesc("Select persons or groups to add as members");

		const pickerContainer = memberSetting.controlEl.createDiv({ cls: "tn-group-member-picker" });
		pickerContainer.style.cssText = "width: 100%; min-width: 250px;";

		// Discover persons synchronously, groups async (same pattern as TaskModal)
		const persons = plugin.personNoteService?.discoverPersons() || [];

		memberPicker = createPersonGroupPicker({
			container: pickerContainer,
			persons,
			groups: [],
			multiSelect: true,
			placeholder: "Search for members...",
			initialSelection: [],
			onChange: (paths) => { selectedMemberPaths = paths; },
		});

		// Load groups async and recreate picker (same pattern as TaskModal)
		plugin.groupRegistry.discoverGroups().then((groupsAvailable) => {
			if (groupsAvailable.length > 0 && memberPicker) {
				const currentSelection = memberPicker.getSelection();
				memberPicker.destroy();
				pickerContainer.empty();
				memberPicker = createPersonGroupPicker({
					container: pickerContainer,
					persons,
					groups: groupsAvailable,
					multiSelect: true,
					placeholder: "Search for members...",
					initialSelection: currentSelection,
					onChange: (paths) => { selectedMemberPaths = paths; },
				});
			}
		});
	}

	// Create button
	new Setting(contentEl)
		.addButton((btn) => {
			btn.setButtonText("Create")
				.setCta()
				.onClick(async () => {
					if (!name) {
						new Notice("Name is required");
						return;
					}

					const typeProp = plugin.settings.identityTypePropertyName || "type";
					const typeValue = type === "person"
						? (plugin.settings.personTypeValue || "tn-person")
						: (plugin.settings.groupTypeValue || "tn-group");
					const folder = type === "person"
						? plugin.settings.personNotesFolder
						: (plugin.settings.groupNotesFolder || plugin.settings.personNotesFolder);

					if (!folder) {
						new Notice(`Configure ${type} notes folder first`);
						return;
					}

					// Build frontmatter
					const lines: string[] = ["---"];
					lines.push(`${typeProp}: ${typeValue}`);
					if (type === "person") {
						if (role) lines.push(`role: ${role}`);
						if (department) lines.push(`department: ${department}`);
					} else {
						// Convert selected member paths to wikilinks
						if (selectedMemberPaths.length > 0) {
							const wikilinks = selectedMemberPaths.map((p) => {
								const basename = p.replace(/\.md$/, "").split("/").pop() || p;
								return `"[[${basename}]]"`;
							});
							lines.push(`members: [${wikilinks.join(", ")}]`);
						} else {
							lines.push("members: []");
						}
					}
					lines.push("---");
					lines.push("");
					lines.push(`# ${name}`);
					lines.push("");

					const filePath = `${folder}/${name}.md`;

					// Check if file exists
					if (plugin.app.vault.getAbstractFileByPath(filePath)) {
						new Notice(`"${filePath}" already exists`);
						return;
					}

					// Ensure folder exists
					const folderObj = plugin.app.vault.getAbstractFileByPath(folder);
					if (!folderObj) {
						await plugin.app.vault.createFolder(folder);
					}

					await plugin.app.vault.create(filePath, lines.join("\n"));
					new Notice(`Created ${type} note: ${name}`);
					modal.close();
					onCreated();

					// Open the new note
					const file = plugin.app.vault.getAbstractFileByPath(filePath);
					if (file instanceof TFile) {
						await plugin.app.workspace.getLeaf().openFile(file);
					}
				});
		});

	// Clean up picker on close
	const origOnClose = modal.onClose.bind(modal);
	modal.onClose = () => {
		if (memberPicker) {
			memberPicker.destroy();
			memberPicker = null;
		}
		origOnClose();
	};

	modal.open();
}
