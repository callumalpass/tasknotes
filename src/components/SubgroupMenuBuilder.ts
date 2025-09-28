import { Menu } from "obsidian";
import { FilterOptions, FilterQuery, TaskGroupKey } from "../types";

/**
 * Builder for the SUBGROUP section of the sort/group context menu.
 * Kept independent for ease of testing and minimal integration surface.
 */
export class SubgroupMenuBuilder {
	/**
	 * Build the available subgroup options based on built-in keys and user properties,
	 * excluding the current primary group key. Always includes 'none'.
	 */
	static buildOptions(
		primaryKey: TaskGroupKey,
		filterOptions: FilterOptions
	): Record<string, string> {
		const builtIn: Record<TaskGroupKey, string> = {
			none: "None",
			status: "Status",
			priority: "Priority",
			context: "Context",
			project: "Project",
			due: "Due Date",
			scheduled: "Scheduled Date",
			tags: "Tags",
			completedDate: "Completed Date",
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
		onSelect: (key: TaskGroupKey) => void
	): void {
		const primary = (currentQuery.groupKey || "none") as TaskGroupKey;
		const subKey = (currentQuery.subgroupKey || "none") as TaskGroupKey;
		const options = SubgroupMenuBuilder.buildOptions(primary, filterOptions);

		// Visual separator and header
		menu.addSeparator();
		menu.addItem((item: any) => {
			item.setTitle("SUBGROUP");
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
