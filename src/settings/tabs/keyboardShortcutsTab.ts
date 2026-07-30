import { Platform, Scope, Setting, setIcon } from "obsidian";
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
								save();
								renderKeyboardShortcutsTab(container, plugin, save);
							})
					);
			});
		}
	);
}
