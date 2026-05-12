import { Menu } from "obsidian";
import { FilterOptions, FilterQuery, TaskGroupKey } from "../types";
import type TaskNotesPlugin from "../main";

/**
 * Builder for the SUBGROUP section of the sort/group context menu.
 * Kept independent for ease of testing and minimal integration surface.
 */
export class SubgroupMenuBuilder {
	private static translate(plugin: TaskNotesPlugin, key: string, fallback: string): string {
		const translator = plugin?.i18n?.translate?.bind(plugin.i18n);
		try {
			const value = translator ? translator(key) : undefined;
			if (typeof value === "string" && value.trim().length > 0) {
				return value;
			}
		} catch {
			// Ignore translation errors and use fallback
		}
		return fallback;
	}

	/**
	 * Build the available subgroup options based on built-in keys and user properties,
	 * excluding the current primary group key. Always includes 'none'.
	 */
	static buildOptions(
		primaryKey: TaskGroupKey,
		filterOptions: FilterOptions,
		plugin: TaskNotesPlugin
	): Record<string, string> {
		const builtIn: Record<TaskGroupKey, string> = {
			none: SubgroupMenuBuilder.translate(plugin, "ui.filterBar.group.none", "None"),
			status: SubgroupMenuBuilder.translate(plugin, "ui.filterBar.group.status", "Status"),
			priority: SubgroupMenuBuilder.translate(
				plugin,
				"ui.filterBar.group.priority",
				"Priority"
			),
			context: SubgroupMenuBuilder.translate(plugin, "ui.filterBar.group.context", "Context"),
			project: SubgroupMenuBuilder.translate(plugin, "ui.filterBar.group.project", "Project"),
			due: SubgroupMenuBuilder.translate(plugin, "ui.filterBar.group.dueDate", "Due Date"),
			scheduled: SubgroupMenuBuilder.translate(
				plugin,
				"ui.filterBar.group.scheduledDate",
				"Scheduled Date"
			),
			tags: SubgroupMenuBuilder.translate(plugin, "ui.filterBar.group.tags", "Tags"),
			completedDate: SubgroupMenuBuilder.translate(
				plugin,
				"ui.filterBar.group.completedDate",
				"Completed Date"
			),
		} as const;

		const options: Record<string, string> = {};

		// Always include None first
		options["none"] = builtIn["none"];

		// Add built-ins except the current primary
		(Object.keys(builtIn) as TaskGroupKey[]).forEach((k) => {
			if (k === "none") return; // already included as first option
			if (k === primaryKey) return; // exclude the current primary key
			options[k] = builtIn[k];
		});

		// Add user properties (id starts with 'user:') except if equal to primary
		const userProps = filterOptions.userProperties || [];
		for (const p of userProps) {
			const id = p?.id as TaskGroupKey | undefined;
			if (!id || typeof id !== "string") continue;
			if (!id.startsWith("user:")) continue;
			if (id === primaryKey) continue;
			options[id] = p.label || id.replace(/^user:/, "");
		}

		return options;
	}

	/**
	 * Append a SUBGROUP section to the given Obsidian Menu instance.
	 * The onSelect callback receives the chosen subgroup key.
	 */
	static addToMenu(
		menu: Menu,
		currentQuery: Pick<FilterQuery, "groupKey" | "subgroupKey">,
		filterOptions: FilterOptions,
		onSelect: (key: TaskGroupKey) => void,
		plugin: TaskNotesPlugin
	): void {
		const primary = (currentQuery.groupKey || "none") as TaskGroupKey;
		const subKey = (currentQuery.subgroupKey || "none") as TaskGroupKey;
		const options = SubgroupMenuBuilder.buildOptions(primary, filterOptions, plugin);

		// Visual separator and header
		menu.addSeparator();
		menu.addItem((item: any) => {
			item.setTitle(
				SubgroupMenuBuilder.translate(plugin, "ui.filterBar.subgroupLabel", "SUBGROUP")
			);
			if (typeof item.setDisabled === "function") item.setDisabled(true);
		});

		Object.entries(options).forEach(([key, label]) => {
			menu.addItem((item: any) => {
				item.setTitle(label);
				if (subKey === key) item.setIcon("check");
				item.onClick(() => onSelect(key as TaskGroupKey));
			});
		});
	}
}
