import { Platform, Scope, Setting } from "obsidian";
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

export function pushKeyboardShortcutCaptureScope(
	plugin: TaskNotesPlugin,
	onEscape: () => void
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
		onEscape();
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
						setting.addButton((button) => {
							button
								.setButtonText(formatTaskListShortcut(shortcut, Platform.isMacOS))
								.setTooltip(translate("settings.keyboardShortcuts.remove"))
								.onClick(() => {
									plugin.settings.taskListShortcuts[action] = shortcuts[action].filter(
										(value) => value !== shortcut
									);
									save();
									renderKeyboardShortcutsTab(container, plugin, save);
								});
						});
					}

					setting.addButton((button) => {
						button
							.setButtonText(translate("settings.keyboardShortcuts.add"))
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
									if (event.key === "Escape") {
										stopCapture();
										renderKeyboardShortcutsTab(container, plugin, save);
										return;
									}
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
								popCaptureScope = pushKeyboardShortcutCaptureScope(plugin, () => {
									stopCapture();
									renderKeyboardShortcutsTab(container, plugin, save);
								});
								activeCaptureCleanup.set(container, stopCapture);
								buttonEl.focus();
							});
					});

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
