import { App, FuzzySuggestModal, Platform, Scope, Setting, setIcon } from "obsidian";
import type TaskNotesPlugin from "../../main";
import {
	DEFAULT_TASK_LIST_SHORTCUTS,
	TASK_LIST_KEYBOARD_ACTIONS,
	findTaskListShortcutConflicts,
	findTaskListShortcutOwners,
	formatTaskListShortcut,
	keyboardEventToTaskListShortcut,
	replaceTaskListShortcut,
	type TaskListKeyboardAction,
} from "../../bases/taskListKeyboardActions";
import { createSettingGroup } from "../components/settingHelpers";
import type { TranslationKey } from "../../i18n";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import type { UserMappedField } from "../../types/settings";

/** Lets users add one configured user field to the task-list shortcut registry. */
class UserFieldShortcutSuggestModal extends FuzzySuggestModal<UserMappedField> {
	constructor(
		app: App,
		private readonly plugin: TaskNotesPlugin,
		private readonly onChoose: (field: UserMappedField) => void
	) {
		super(app);
	}

	/** Lists configured fields that have not yet been added to the shortcut page. */
	getItems(): UserMappedField[] {
		const configured = this.plugin.settings.userFields ?? [];
		return configured.filter((field) => !(field.id in (this.plugin.settings.taskListUserFieldShortcuts ?? {})));
	}

	/** Supplies the display label used by Obsidian's fuzzy matcher. */
	getItemText(field: UserMappedField): string {
		return `${field.displayName} (${field.key})`;
	}

	/** Persists the selected field through the settings-page callback. */
	onChooseItem(field: UserMappedField): void {
		this.onChoose(field);
	}
}

/** Converts an NLP trigger glyph to the normalized task-list shortcut format. */
function getDefaultUserFieldShortcut(trigger: string | undefined): string {
	const first = trigger?.trim().charAt(0).toLowerCase() ?? "";
	if (first === "#" || first === "@") return `shift+${first}`;
	if (first === "+") return "shift+plus";
	return first;
}

const activeCaptureCleanup = new WeakMap<HTMLElement, () => void>();

/**
 * Temporarily outranks the Settings modal's Escape handler while recording.
 * Escape is forwarded as a candidate shortcut instead of dismissing the
 * underlying settings UI.
 */
export function pushKeyboardShortcutCaptureScope(
	plugin: TaskNotesPlugin,
	onEscape: (event: KeyboardEvent) => void
): () => void {
	const captureScope = new Scope(plugin.app.scope);
	let active = true;
	const stop = () => {
		if (!active) return;
		active = false;
		plugin.app.keymap.popScope(captureScope);
	};
	captureScope.register([], "Escape", (event) => {
		event.preventDefault();
		event.stopPropagation();
		stop();
		onEscape(event);
		return false;
	});
	plugin.app.keymap.pushScope(captureScope);
	return stop;
}

function actionKey(action: TaskListKeyboardAction): TranslationKey {
	return `settings.keyboardShortcuts.actions.${action}`;
}

/** Formats a shortcut owner for conflict prompts using its user-facing label and stable ID. */
export function formatShortcutOwnerLabel(
	owner: string,
	fields: readonly UserMappedField[],
	translate: (key: TranslationKey) => string
): string {
	if ((TASK_LIST_KEYBOARD_ACTIONS as readonly string[]).includes(owner)) {
		return translate(actionKey(owner as TaskListKeyboardAction));
	}

	// Dynamic shortcut maps are keyed by stable field IDs, so resolve that ID
	// back to the configured display name while retaining the ID for diagnosis.
	const field = fields.find((candidate) => candidate.id === owner);
	return field ? `${field.displayName} (${field.id})` : owner;
}

export function renderKeyboardShortcutsTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	activeCaptureCleanup.get(container)?.();
	container.empty();
	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);
	const shortcuts = plugin.settings.taskListShortcuts;
	const conflicts = findTaskListShortcutConflicts(shortcuts);

	createSettingGroup(
		container,
		{
			heading: translate("settings.keyboardShortcuts.header"),
			description: translate("settings.keyboardShortcuts.description"),
		},
		(group) => {
			for (const action of TASK_LIST_KEYBOARD_ACTIONS) {
				group.addSetting((setting) => {
					setting.setName(translate(actionKey(action)));
					setting.settingEl.addClass("tasknotes-settings__shortcut-setting");
					const actionConflicts = shortcuts[action]
						.filter((shortcut) => conflicts.has(shortcut))
						.map((shortcut) => formatTaskListShortcut(shortcut, Platform.isMacOS));
					setting.setDesc(
						actionConflicts.length
							? translate("settings.keyboardShortcuts.conflict", {
									shortcuts: actionConflicts.join(", "),
								})
							: translate("settings.keyboardShortcuts.actionDescription")
					);
					if (actionConflicts.length) setting.settingEl.addClass("has-conflict");

					for (const shortcut of shortcuts[action]) {
						const shortcutButton = setting.controlEl.createEl("button", {
							cls: "tasknotes-settings__shortcut-binding setting-hotkey",
							attr: {
								type: "button",
								"aria-label": translate("settings.keyboardShortcuts.remove"),
							},
						});
						shortcutButton.createSpan({
							cls: "tasknotes-settings__shortcut-value",
							text: formatTaskListShortcut(shortcut, Platform.isMacOS),
						});
						const removeIcon = shortcutButton.createSpan({
							cls: "tasknotes-settings__shortcut-remove-icon",
						});
						setIcon(removeIcon, "circle-x");
						shortcutButton.addEventListener("click", () => {
							plugin.settings.taskListShortcuts[action] = shortcuts[action].filter(
								(value) => value !== shortcut
							);
							save();
							renderKeyboardShortcutsTab(container, plugin, save);
						});
					}

					setting.addExtraButton((button) => {
						button
							.setIcon("rotate-ccw")
							.setTooltip(translate("settings.keyboardShortcuts.resetAction"))
							.onClick(() => {
								plugin.settings.taskListShortcuts[action] = [
									...DEFAULT_TASK_LIST_SHORTCUTS[action],
								];
								save();
								renderKeyboardShortcutsTab(container, plugin, save);
							});
					});

					setting.addButton((button) => {
						button.buttonEl.addClass(
							"tasknotes-settings__shortcut-add",
							"clickable-icon"
						);
						setIcon(button.buttonEl, "circle-plus");
						button
							.setTooltip(translate("settings.keyboardShortcuts.captureHint"))
							.onClick(() => {
								activeCaptureCleanup.get(container)?.();
								const buttonEl = button.buttonEl;
								buttonEl.setText(translate("settings.keyboardShortcuts.recording"));
								buttonEl.addClass("mod-cta");
								let stopped = false;
								let popCaptureScope = () => {};
								const stopCapture = () => {
									if (stopped) return;
									stopped = true;
									buttonEl.removeEventListener("keydown", captureListener);
									popCaptureScope();
									if (activeCaptureCleanup.get(container) === stopCapture) {
										activeCaptureCleanup.delete(container);
									}
								};
								const capture = async (event: KeyboardEvent) => {
									event.preventDefault();
									event.stopPropagation();
									const shortcut = keyboardEventToTaskListShortcut(event);
									if (!shortcut) return;
									stopCapture();
									if (!shortcuts[action].includes(shortcut)) {
										const owners = findTaskListShortcutOwners(
											shortcuts,
											shortcut,
											action
										);
										if (owners.length > 0) {
											// Shortcut ownership is exclusive. Replacing a
											// duplicate removes it from the prior actions in
											// one immutable shortcut-map update.
											const replace = await showConfirmationModal(plugin.app, {
												title: translate(
													"settings.keyboardShortcuts.duplicateTitle"
												),
												message: translate(
													"settings.keyboardShortcuts.duplicateMessage",
													{
														shortcut: formatTaskListShortcut(
															shortcut,
															Platform.isMacOS
														),
														actions: owners
															.map((owner) => translate(actionKey(owner)))
															.join(", "),
													}
												),
												confirmText: translate(
													"settings.keyboardShortcuts.replace"
												),
												cancelText: translate("common.cancel"),
												isDestructive: true,
											});
											if (!replace) {
												renderKeyboardShortcutsTab(container, plugin, save);
												return;
											}
											plugin.settings.taskListShortcuts =
												replaceTaskListShortcut(shortcuts, action, shortcut);
										} else {
											// Every captured chord, including Escape, is
											// confirmed before it is persisted.
											const confirmed = await showConfirmationModal(plugin.app, {
												title: translate(
													"settings.keyboardShortcuts.confirmTitle"
												),
												message: translate(
													"settings.keyboardShortcuts.confirmMessage",
													{
														shortcut: formatTaskListShortcut(
															shortcut,
															Platform.isMacOS
														),
														action: translate(actionKey(action)),
													}
												),
												confirmText: translate(
													"settings.keyboardShortcuts.confirm"
												),
												cancelText: translate("common.cancel"),
											});
											if (!confirmed) {
												renderKeyboardShortcutsTab(container, plugin, save);
												return;
											}
											plugin.settings.taskListShortcuts[action] = [
												...shortcuts[action],
												shortcut,
											];
										}
										save();
									}
									renderKeyboardShortcutsTab(container, plugin, save);
								};
								const captureListener = (event: KeyboardEvent) => void capture(event);
								buttonEl.addEventListener("keydown", captureListener);
								popCaptureScope = pushKeyboardShortcutCaptureScope(
									plugin,
									(event) => void capture(event)
								);
								activeCaptureCleanup.set(container, stopCapture);
								buttonEl.focus();
							});
					});
				});
			}

			for (const field of plugin.settings.userFields ?? []) {
				const fieldShortcuts = plugin.settings.taskListUserFieldShortcuts?.[field.id];
				if (!fieldShortcuts) continue;
				group.addSetting((setting) => {
					setting.setName(field.displayName);
					setting.setDesc(`Edit ${field.key}`);
					for (const shortcut of fieldShortcuts) {
						const shortcutButton = setting.controlEl.createEl("button", {
							cls: "tasknotes-settings__shortcut-binding setting-hotkey",
							attr: { type: "button", "aria-label": translate("settings.keyboardShortcuts.remove") },
						});
						shortcutButton.createSpan({
							cls: "tasknotes-settings__shortcut-value",
							text: formatTaskListShortcut(shortcut, Platform.isMacOS),
						});
						const removeIcon = shortcutButton.createSpan({ cls: "tasknotes-settings__shortcut-remove-icon" });
						setIcon(removeIcon, "circle-x");
						shortcutButton.addEventListener("click", () => {
							plugin.settings.taskListUserFieldShortcuts[field.id] = fieldShortcuts.filter(
								(value) => value !== shortcut
							);
							save();
							renderKeyboardShortcutsTab(container, plugin, save);
						});
					}
					setting.addExtraButton((button) =>
						button.setIcon("rotate-ccw").setTooltip(translate("settings.keyboardShortcuts.resetAction")).onClick(() => {
							const trigger = plugin.settings.nlpTriggers.triggers.find(
								(candidate) => candidate.propertyId === field.id || candidate.propertyId === field.key
							)?.trigger;
							const candidate = getDefaultUserFieldShortcut(trigger);
							const occupied = new Set([
								...Object.values(plugin.settings.taskListShortcuts).flat(),
								...Object.entries(plugin.settings.taskListUserFieldShortcuts ?? {})
									.filter(([id]) => id !== field.id)
									.flatMap(([, values]) => values),
							]);
							plugin.settings.taskListUserFieldShortcuts[field.id] = candidate && !occupied.has(candidate) ? [candidate] : [];
							save();
							renderKeyboardShortcutsTab(container, plugin, save);
						})
					);
					setting.addButton((button) => {
						button.buttonEl.addClass("tasknotes-settings__shortcut-add", "clickable-icon");
						setIcon(button.buttonEl, "circle-plus");
						button.setTooltip(translate("settings.keyboardShortcuts.captureHint")).onClick(() => {
							const buttonEl = button.buttonEl;
							buttonEl.setText(translate("settings.keyboardShortcuts.recording"));
							let stopped = false;
							let popCaptureScope = () => {};
							const stopCapture = () => {
								if (stopped) return;
								stopped = true;
								buttonEl.removeEventListener("keydown", captureListener);
								popCaptureScope();
							};
							const capture = (event: KeyboardEvent) => {
								event.preventDefault();
								event.stopPropagation();
								const shortcut = keyboardEventToTaskListShortcut(event);
								if (!shortcut) return;
								stopCapture();
								const owners = [
									...Object.entries(plugin.settings.taskListShortcuts)
										.filter(([, values]) => values.includes(shortcut))
										.map(([action]) => action),
									...Object.entries(plugin.settings.taskListUserFieldShortcuts ?? {})
										.filter(([id, values]) => id !== field.id && values.includes(shortcut))
										.map(([id]) => id),
								];
								if (owners.length > 0) {
									void showConfirmationModal(plugin.app, {
										title: translate("settings.keyboardShortcuts.duplicateTitle"),
										message: translate("settings.keyboardShortcuts.duplicateMessage", {
											shortcut: formatTaskListShortcut(shortcut, Platform.isMacOS),
											actions: owners
												.map((owner) =>
													formatShortcutOwnerLabel(
														owner,
														plugin.settings.userFields ?? [],
														translate
													)
												)
												.join(", "),
										}),
										confirmText: translate("settings.keyboardShortcuts.replace"),
										cancelText: translate("common.cancel"),
									}).then((replace) => {
										if (!replace) return;
										for (const action of owners) {
											if (action in plugin.settings.taskListShortcuts) {
												const key = action as keyof typeof plugin.settings.taskListShortcuts;
												plugin.settings.taskListShortcuts[key] = plugin.settings.taskListShortcuts[key].filter((value) => value !== shortcut);
											} else {
												plugin.settings.taskListUserFieldShortcuts[action] = plugin.settings.taskListUserFieldShortcuts[action].filter((value) => value !== shortcut);
											}
										}
										plugin.settings.taskListUserFieldShortcuts[field.id] = [shortcut];
										save();
										renderKeyboardShortcutsTab(container, plugin, save);
									});
									return;
								}
								plugin.settings.taskListUserFieldShortcuts[field.id] = [
									...(plugin.settings.taskListUserFieldShortcuts[field.id] ?? []),
									shortcut,
								];
								save();
								renderKeyboardShortcutsTab(container, plugin, save);
							};
							const captureListener = (event: KeyboardEvent) => capture(event);
							buttonEl.addEventListener("keydown", captureListener);
							popCaptureScope = pushKeyboardShortcutCaptureScope(plugin, capture);
							buttonEl.focus();
						});
					});
				});
			}

			// Keep the add control after every configured user-field shortcut so the
			// field list reads as one contiguous section.
			group.addSetting((setting: Setting) => {
				setting
					.setName(translate("settings.keyboardShortcuts.addUserField"))
					.setDesc(translate("settings.keyboardShortcuts.addUserFieldDescription"))
					.addButton((button) =>
						button.setButtonText(translate("settings.keyboardShortcuts.addUserField")).onClick(() => {
							new UserFieldShortcutSuggestModal(plugin.app, plugin, (field) => {
								const trigger = plugin.settings.nlpTriggers.triggers.find(
									(candidate) => candidate.propertyId === field.id || candidate.propertyId === field.key
								)?.trigger;
								const candidate = getDefaultUserFieldShortcut(trigger);
								const occupied = new Set([
									...Object.values(plugin.settings.taskListShortcuts).flat(),
									...Object.values(plugin.settings.taskListUserFieldShortcuts ?? {}).flat(),
								]);
								plugin.settings.taskListUserFieldShortcuts[field.id] =
									candidate && !occupied.has(candidate) ? [candidate] : [];
								save();
								renderKeyboardShortcutsTab(container, plugin, save);
							}).open();
						})
					);
			});

			group.addSetting((setting: Setting) => {
				setting
					.setName(translate("settings.keyboardShortcuts.resetAll"))
					.setDesc(translate("settings.keyboardShortcuts.resetAllDescription"))
					.addButton((button) =>
						button
							.setButtonText(translate("settings.keyboardShortcuts.resetAll"))
							.setWarning()
							.onClick(() => {
						plugin.settings.taskListShortcuts = Object.fromEntries(
									TASK_LIST_KEYBOARD_ACTIONS.map((action) => [
										action,
										[...DEFAULT_TASK_LIST_SHORTCUTS[action]],
									])
						) as typeof plugin.settings.taskListShortcuts;
						plugin.settings.taskListUserFieldShortcuts = {};
								save();
								renderKeyboardShortcutsTab(container, plugin, save);
							})
					);
			});
		}
	);
}
