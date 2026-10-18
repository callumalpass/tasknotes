import { App } from "obsidian";
import { createI18nService } from "../../../src/i18n";
import { createFieldManager } from "../../../src/settings/components/FieldManagerComponent";
import { renderModalFieldsTab } from "../../../src/settings/tabs/modalFieldsTab";
import { showConfirmationModal } from "../../../src/modals/ConfirmationModal";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskModalFieldsConfig } from "../../../src/types/settings";

jest.mock("../../../src/modals/ConfirmationModal", () => ({
	showConfirmationModal: jest.fn(),
}));

function createPlugin(): TaskNotesPlugin {
	const config: TaskModalFieldsConfig = {
		version: 1,
		groups: [
			{
				id: "custom",
				displayName: "My saved group",
				order: 0,
				collapsible: false,
				defaultCollapsed: false,
			},
		],
		fields: ["core", "user", "dependency", "organization"].map((fieldType, order) => ({
			id: `saved-${fieldType}`,
			fieldType: fieldType as "core" | "user" | "dependency" | "organization",
			group: "custom",
			displayName: `My ${fieldType} label`,
			order,
			enabled: true,
			visibleInCreation: true,
			visibleInEdit: true,
		})),
	};
	return {
		app: new App(),
		i18n: createI18nService({ initialLocale: "zh" }),
		settings: {
			modalFieldsConfig: config,
			userFields: [
				{
					id: "saved-user",
					displayName: "My user label",
					key: "my_property_key",
					type: "text",
				},
			],
		},
	} as unknown as TaskNotesPlugin;
}

describe("Modal fields settings rendering", () => {
	let container: HTMLElement;
	let plugin: TaskNotesPlugin;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = document.body.createDiv();
		plugin = createPlugin();
	});

	it("translates visible chrome and badges without changing saved names, keys, or identifiers", () => {
		const config = plugin.settings.modalFieldsConfig!;
		const originalConfig = JSON.stringify(config);
		renderModalFieldsTab(container, plugin, jest.fn());

		expect(container.textContent).toContain("任务模态框的字段配置");
		for (const label of ["已启用：", "创建任务时显示：", "编辑任务时显示：", "分组："]) {
			expect(container.textContent).toContain(label);
		}
		expect(container.querySelector(".field-manager__tab")?.textContent).toBe("My saved group");
		for (const [type, label] of Object.entries({
			core: "核心",
			user: "用户",
			dependency: "依赖",
			organization: "组织",
		})) {
			const card = container.querySelector(`[data-card-id="saved-${type}"]`)!;
			expect(card.textContent).toContain(`My ${type} label`);
			expect(card.querySelector(`.field-card__type--${type}`)?.textContent).toBe(label);
		}
		expect(container.querySelector('[data-card-id="saved-user"]')?.textContent).toContain(
			"键：my_property_key"
		);
		expect(container.querySelector('[data-card-id="saved-core"]')?.textContent).toContain(
			"ID：saved-core"
		);
		expect(JSON.stringify(config)).toBe(originalConfig);
	});

	it("translates the missing-property-key fallback", () => {
		plugin.settings.userFields[0].key = "";
		renderModalFieldsTab(container, plugin, jest.fn());
		expect(container.querySelector('[data-card-id="saved-user"]')?.textContent).toContain(
			"未设置键"
		);
	});

	it("translates the empty-group and invalid-configuration states", () => {
		const config = plugin.settings.modalFieldsConfig!;
		createFieldManager(container, plugin, { ...config, fields: [] }, jest.fn(), plugin.app);
		expect(container.textContent).toContain("此分组中暂无字段");
		createFieldManager(container, plugin, {} as TaskModalFieldsConfig, jest.fn(), plugin.app);
		expect(container.textContent).toContain("错误：字段配置无效。请重置为默认值。");
	});

	it("passes translated reset text to the dialog and preserves configuration when cancelled", async () => {
		const save = jest.fn();
		const originalConfig = JSON.stringify(plugin.settings.modalFieldsConfig);
		jest.mocked(showConfirmationModal).mockResolvedValue(false);
		renderModalFieldsTab(container, plugin, save);
		const reset = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "重置为默认值"
		)!;
		reset.click();
		await Promise.resolve();
		expect(showConfirmationModal).toHaveBeenCalledWith(plugin.app, {
			title: "字段配置重置",
			message: "确定要将字段配置重置为默认值吗？这将移除所有自定义字段配置。",
			confirmText: "重置",
			cancelText: "取消",
			isDestructive: true,
		});
		expect(JSON.stringify(plugin.settings.modalFieldsConfig)).toBe(originalConfig);
		expect(save).not.toHaveBeenCalled();
	});
});
