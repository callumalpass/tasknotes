import { Setting, type SettingDefinition, type SettingDefinitionGroup } from "obsidian";
import { flattenSettings, settingsFixture, settle } from "../../helpers/native-settings";
import { tasknotesAppDefinitions } from "../../../src/settings/native/tasknotesApp";
import { ConfirmationModal } from "../../../src/modals/ConfirmationModal";
import type { PendingV02MigrationRecovery } from "../../../src/services/MdbaseSpecService";

describe("TaskNotes App sync setup", () => {
	test("offers independent desktop and Obsidian plugin install buttons", () => {
		const { ctx } = settingsFixture();
		const definitions = tasknotesAppDefinitions(ctx);
		const option = flattenSettings(definitions.items!).find(
			(item) => "name" in item && item.name === "2. Choose a sync option"
		) as SettingDefinition;
		const setting = new Setting(document.createElement("div"));
		const open = jest.spyOn(window, "open").mockReturnValue(null);

		expect(option.desc).toContain("you only need one of them");
		expect(option.action).toBeUndefined();
		option.render!(setting);
		const buttons = setting.controlEl.querySelectorAll("button");
		expect(Array.from(buttons, (button) => button.textContent)).toEqual([
			"Desktop app",
			"Obsidian plugin",
		]);
		buttons[0].click();
		expect(open).toHaveBeenNthCalledWith(1, "https://mdbase.dev/downloads/", "_blank");
		buttons[1].click();
		expect(open).toHaveBeenNthCalledWith(2, "obsidian://show-plugin?id=mdbase-sync", "_blank");
		expect(open).toHaveBeenCalledTimes(2);
	});

	test.each([false, true])("does not infer plugin sync state from desktop state %s", async (added) => {
		const { ctx, plugin } = settingsFixture();
		plugin.settings.enableMdbaseSpec = true;
		const exists = jest.spyOn(plugin.app.vault.adapter, "exists").mockResolvedValue(added);
		const definitions = tasknotesAppDefinitions(ctx);
		const status = flattenSettings(definitions.items!).find(
			(item) => "name" in item && item.name === "This vault" && "render" in item
		) as SettingDefinition;
		const setting = new Setting(document.createElement("div"));

		status.render!(setting);
		await settle();
		expect(exists).toHaveBeenCalledWith(".mdbase/state");
		expect(setting.descEl.textContent).toBe(
			added
				? "Added to mdbase Connect on a computer. Open TaskNotes App and sign in with the same account."
				: "Use either sync option below."
		);
		expect(setting.descEl.textContent).not.toContain("Not added");
	});

	test("keeps vault setup instructions for both sync options", () => {
		const { ctx } = settingsFixture();
		const definitions = tasknotesAppDefinitions(ctx);
		const addVault = flattenSettings(definitions.items!).find(
			(item) => "name" in item && item.name === "3. Add this vault"
		) as SettingDefinition;
		expect(addVault.desc).toBe(
			"Desktop app: add this vault’s folder and turn on sync. Obsidian plugin: follow the setup steps in the plugin to sync this vault."
		);
	});

	test("hides metadata upgrade recovery controls when no migration recovery is pending", () => {
		const { ctx } = settingsFixture();
		const definitions = tasknotesAppDefinitions(ctx);
		const recoveryGroup = definitions.items!.find(
			(item) => "type" in item && item.type === "group" && item.heading === "Metadata upgrade recovery"
		) as SettingDefinitionGroup;

		expect(recoveryGroup).toBeDefined();
		expect((recoveryGroup.visible as () => boolean)()).toBe(false);
		expect(definitions.desc).toBe("Use your tasks on the web, iPhone and Android.");
	});

	test("renders blocked file, backup folder, and explicit recovery actions when migration recovery is pending", async () => {
		const { ctx, plugin } = settingsFixture();
		let recovery: PendingV02MigrationRecovery | null = {
			pendingPath: ".tasknotes/migrations/mdbase-v0.2-pending.json",
			backupFolder: ".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z",
			blockedPaths: ["_types/task.md"],
			reason: "concurrent-change",
			canRestoreBackup: true,
			diagnostic: "Refusing to overwrite a concurrent change to _types/task.md",
		};
		const keepCurrentFilesAndResumeV02Migration = jest.fn().mockImplementation(async () => {
			recovery = null;
			return {
				action: "keep-current",
				synced: true,
				backupFolder: ".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z",
			};
		});
		const restoreV02MigrationBackup = jest.fn().mockImplementation(async () => {
			recovery = null;
			return {
				action: "restore-backup",
				synced: false,
				backupFolder: ".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z",
			};
		});
		(plugin as any).mdbaseSpecService = {
			getPendingV02MigrationRecovery: () => recovery,
			keepCurrentFilesAndResumeV02Migration,
			restoreV02MigrationBackup,
		};

		const definitions = tasknotesAppDefinitions(ctx);
		expect(definitions.desc).toBe("Metadata upgrade recovery needed.");

		const recoveryGroup = definitions.items!.find(
			(item) => "type" in item && item.type === "group" && item.heading === "Metadata upgrade recovery"
		) as SettingDefinitionGroup;
		expect((recoveryGroup.visible as () => boolean)()).toBe(true);

		const statusItem = recoveryGroup.items![0] as SettingDefinition;
		const setting = new Setting(document.createElement("div"));
		statusItem.render!(setting);
		expect(setting.descEl.textContent).toContain("_types/task.md");
		expect(setting.descEl.textContent).toContain(
			".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z"
		);
		expect(setting.descEl.textContent).not.toContain("Error:");

		const keepAction = recoveryGroup.items![1] as SettingDefinition;
		const restoreAction = recoveryGroup.items![2] as SettingDefinition;
		expect(keepAction.name).toBe("Keep current files and resume");
		expect(restoreAction.name).toBe("Restore v0.2 backup");
		expect((restoreAction.visible as () => boolean)()).toBe(true);

		const showSpy = jest.spyOn(ConfirmationModal.prototype, "show");
		try {
			// Cancelling confirmation does nothing.
			showSpy.mockResolvedValueOnce(false);
			keepAction.action!();
			await settle();
			expect(keepCurrentFilesAndResumeV02Migration).not.toHaveBeenCalled();

			// Confirming runs keep-current recovery and rebuilds settings.
			showSpy.mockResolvedValueOnce(true);
			keepAction.action!();
			await settle();
			expect(keepCurrentFilesAndResumeV02Migration).toHaveBeenCalledTimes(1);
			expect(ctx.rebuild).toHaveBeenCalled();
			expect((recoveryGroup.visible as () => boolean)()).toBe(false);
		} finally {
			showSpy.mockRestore();
		}
	});

	test("hides Restore v0.2 backup when backup verification failed and confirms before restoring when verified", async () => {
		const { ctx, plugin } = settingsFixture();
		let recovery: PendingV02MigrationRecovery | null = {
			pendingPath: ".tasknotes/migrations/mdbase-v0.2-pending.json",
			backupFolder: ".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z",
			blockedPaths: [],
			reason: "backup-mismatch",
			canRestoreBackup: false,
			diagnostic: "The migration recovery copies do not match the pending record.",
		};
		const restoreV02MigrationBackup = jest.fn().mockImplementation(async () => {
			recovery = null;
			return {
				action: "restore-backup",
				synced: false,
				backupFolder: ".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z",
			};
		});
		(plugin as any).mdbaseSpecService = {
			getPendingV02MigrationRecovery: () => recovery,
			keepCurrentFilesAndResumeV02Migration: jest.fn(),
			restoreV02MigrationBackup,
		};

		const definitions = tasknotesAppDefinitions(ctx);
		const recoveryGroup = definitions.items!.find(
			(item) => "type" in item && item.type === "group" && item.heading === "Metadata upgrade recovery"
		) as SettingDefinitionGroup;
		const restoreAction = recoveryGroup.items![2] as SettingDefinition;

		expect((restoreAction.visible as () => boolean)()).toBe(false);

		// When verified, confirming executes restoreV02MigrationBackup.
		recovery = {
			pendingPath: ".tasknotes/migrations/mdbase-v0.2-pending.json",
			backupFolder: ".tasknotes/migrations/mdbase-v0.2-2026-08-24T12-34-56-789Z",
			blockedPaths: ["_types/task.md"],
			reason: "concurrent-change",
			canRestoreBackup: true,
			diagnostic: "Refusing to overwrite a concurrent change to _types/task.md",
		};
		expect((restoreAction.visible as () => boolean)()).toBe(true);

		const showSpy = jest.spyOn(ConfirmationModal.prototype, "show");
		try {
			showSpy.mockResolvedValueOnce(false);
			restoreAction.action!();
			await settle();
			expect(restoreV02MigrationBackup).not.toHaveBeenCalled();

			showSpy.mockResolvedValueOnce(true);
			restoreAction.action!();
			await settle();
			expect(restoreV02MigrationBackup).toHaveBeenCalledTimes(1);
			expect(ctx.rebuild).toHaveBeenCalled();
		} finally {
			showSpy.mockRestore();
		}
	});
});
