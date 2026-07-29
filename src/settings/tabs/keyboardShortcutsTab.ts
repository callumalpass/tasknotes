import { Platform, Setting } from "obsidian";
import type TaskNotesPlugin from "../../main";
import {
	DEFAULT_TASK_LIST_SHORTCUTS,
	TASK_LIST_KEYBOARD_ACTIONS,
	findTaskListShortcutConflicts,
	formatTaskListShortcut,
	keyboardEventToTaskListShortcut,
	type TaskListKeyboardAction,
} from "../../bases/taskListKeyboardActions";
import { createSettingGroup } from "../components/settingHelpers";
import type { TranslationKey } from "../../i18n";

function actionKey(action: TaskListKeyboardAction): TranslationKey {
	return `settings.keyboardShortcuts.actions.${action}`;
}

export function renderKeyboardShortcutsTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
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
								const buttonEl = button.buttonEl;
								buttonEl.setText(translate("settings.keyboardShortcuts.recording"));
								buttonEl.addClass("mod-cta");
								const capture = (event: KeyboardEvent) => {
									event.preventDefault();
									event.stopPropagation();
									const shortcut = keyboardEventToTaskListShortcut(event);
									if (!shortcut) return;
									buttonEl.removeEventListener("keydown", capture);
									if (!shortcuts[action].includes(shortcut)) {
										plugin.settings.taskListShortcuts[action] = [
											...shortcuts[action],
											shortcut,
										];
										save();
									}
									renderKeyboardShortcutsTab(container, plugin, save);
								};
								buttonEl.addEventListener("keydown", capture);
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
