import TaskNotesPlugin from "../main";

/**
 * Utility functions for task grouping functionality
 * Shared between TaskListView and subtask widget
 */
export class GroupingUtils {
	/**
	 * Format group name for display with proper labels
	 */
	static formatGroupName(groupName: string, plugin: TaskNotesPlugin): string {
		// Check if it's a priority value
		const priorityConfig = plugin.priorityManager.getPriorityConfig(groupName);
		if (priorityConfig) {
			return `${priorityConfig.label} priority`;
		}

		// Check if it's a status value
		const statusConfig = plugin.statusManager.getStatusConfig(groupName);
		if (statusConfig) {
			return statusConfig.label;
		}

		switch (groupName) {
			case "all":
				return "All tasks";
			case "no-status":
				return "No status assigned";
			case "No Status":
				return "No Status";
			case "No Priority":
				return "No Priority";
			case "No Context":
				return "No Context";
			case "No Project":
				return "No Project";
			case "No Due Date":
				return "No Due Date";
			case "No Scheduled Date":
				return "No Scheduled Date";
			default:
				// For project names that may come from consolidation, return as-is
				// since they should already be cleaned by FilterService.consolidateProjectName
				return groupName;
		}
	}

	/**
	 * Get group display name with task count
	 */
	static getGroupDisplayName(
		groupKey: string,
		taskCount: number,
		plugin: TaskNotesPlugin
	): string {
		const formattedName = GroupingUtils.formatGroupName(groupKey, plugin);
		return `${formattedName} (${taskCount})`;
	}

	/**
	 * Check if a group should be collapsed initially
	 */
	static isGroupCollapsed(
		viewType: string,
		groupingKey: string,
		groupName: string,
		plugin: TaskNotesPlugin
	): boolean {
		try {
			const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
			const collapsed = prefs.collapsedGroups || {};
			return !!collapsed?.[groupingKey]?.[groupName];
		} catch {
			return false;
		}
	}

	/**
	 * Set the collapsed state for a group
	 */
	static setGroupCollapsed(
		viewType: string,
		groupingKey: string,
		groupName: string,
		collapsed: boolean,
		plugin: TaskNotesPlugin
	): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...prefs };
		if (!next.collapsedGroups) next.collapsedGroups = {};
		if (!next.collapsedGroups[groupingKey]) next.collapsedGroups[groupingKey] = {};
		next.collapsedGroups[groupingKey][groupName] = collapsed;
		plugin.viewStateManager.setViewPreferences(viewType, next);
	}

	/**
	 * Expand all groups for a specific view and grouping key
	 */
	static expandAllGroups(viewType: string, groupingKey: string, plugin: TaskNotesPlugin): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...(prefs.collapsedGroups || {}) } as Record<
			string,
			Record<string, boolean>
		>;
		next[groupingKey] = {};
		plugin.viewStateManager.setViewPreferences(viewType, { ...prefs, collapsedGroups: next });
	}

	/**
	 * Collapse all groups for a specific view and grouping key
	 */
	static collapseAllGroups(
		viewType: string,
		groupingKey: string,
		groupNames: string[],
		plugin: TaskNotesPlugin
	): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...(prefs.collapsedGroups || {}) } as Record<
			string,
			Record<string, boolean>
		>;
		const collapsed: Record<string, boolean> = {};
		groupNames.forEach((name) => {
			collapsed[name] = true;
		});
		next[groupingKey] = collapsed;
		plugin.viewStateManager.setViewPreferences(viewType, { ...prefs, collapsedGroups: next });
	}

	// ========================= Subgroup helpers =========================

	/**
	 * Check if a specific subgroup is collapsed for given primary group
	 */
	static isSubgroupCollapsed(
		viewType: string,
		subgroupKey: string,
		primaryGroup: string,
		subgroupName: string,
		plugin: TaskNotesPlugin
	): boolean {
		try {
			const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
			const collapsed = prefs.collapsedSubgroups || {};
			return !!collapsed?.[subgroupKey]?.[primaryGroup]?.[subgroupName];
		} catch {
			return false;
		}
	}

	/**
	 * Set collapsed state for a specific subgroup within a primary group
	 */
	static setSubgroupCollapsed(
		viewType: string,
		subgroupKey: string,
		primaryGroup: string,
		subgroupName: string,
		collapsed: boolean,
		plugin: TaskNotesPlugin
	): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...prefs } as any;
		if (!next.collapsedSubgroups) next.collapsedSubgroups = {};
		if (!next.collapsedSubgroups[subgroupKey]) next.collapsedSubgroups[subgroupKey] = {};
		if (!next.collapsedSubgroups[subgroupKey][primaryGroup])
			next.collapsedSubgroups[subgroupKey][primaryGroup] = {};
		next.collapsedSubgroups[subgroupKey][primaryGroup][subgroupName] = collapsed;
		plugin.viewStateManager.setViewPreferences(viewType, next);
	}

	/**
	 * Expand all subgroups within a primary group (clear collapsed flags)
	 */
	static expandAllSubgroups(
		viewType: string,
		primaryGroup: string,
		subgroupKey: string,
		plugin: TaskNotesPlugin
	): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...prefs } as any;
		if (!next.collapsedSubgroups) next.collapsedSubgroups = {};
		if (!next.collapsedSubgroups[subgroupKey]) next.collapsedSubgroups[subgroupKey] = {};
		next.collapsedSubgroups[subgroupKey][primaryGroup] = {};
		plugin.viewStateManager.setViewPreferences(viewType, next);
	}

	/**
	 * Collapse all given subgroups within a primary group
	 */
	static collapseAllSubgroups(
		viewType: string,
		primaryGroup: string,
		subgroupKey: string,
		subgroupNames: string[],
		plugin: TaskNotesPlugin
	): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...prefs } as any;
		if (!next.collapsedSubgroups) next.collapsedSubgroups = {};
		if (!next.collapsedSubgroups[subgroupKey]) next.collapsedSubgroups[subgroupKey] = {};
		const collapsed: Record<string, boolean> = {};
		subgroupNames.forEach((name) => {
			collapsed[name] = true;
		});
		next.collapsedSubgroups[subgroupKey][primaryGroup] = collapsed;
		plugin.viewStateManager.setViewPreferences(viewType, next);
	}

	/**
	 * Expand all subgroups globally for a subgroup key
	 */
	static expandAllSubgroupsGlobally(
		viewType: string,
		subgroupKey: string,
		plugin: TaskNotesPlugin
	): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...prefs } as any;
		if (!next.collapsedSubgroups) next.collapsedSubgroups = {};
		next.collapsedSubgroups[subgroupKey] = {};
		plugin.viewStateManager.setViewPreferences(viewType, next);
	}

	/**
	 * Collapse all subgroups globally for specific primary/subgroup pairs
	 */
	static collapseAllSubgroupsGlobally(
		viewType: string,
		subgroupKey: string,
		items: { primaryGroup: string; subgroupName: string }[],
		plugin: TaskNotesPlugin
	): void {
		const prefs = plugin.viewStateManager.getViewPreferences<any>(viewType) || {};
		const next = { ...prefs } as any;
		if (!next.collapsedSubgroups) next.collapsedSubgroups = {};
		if (!next.collapsedSubgroups[subgroupKey]) next.collapsedSubgroups[subgroupKey] = {};

		for (const { primaryGroup, subgroupName } of items) {
			if (!next.collapsedSubgroups[subgroupKey][primaryGroup]) {
				next.collapsedSubgroups[subgroupKey][primaryGroup] = {};
			}
			next.collapsedSubgroups[subgroupKey][primaryGroup][subgroupName] = true;
		}

		plugin.viewStateManager.setViewPreferences(viewType, next);
	}
}
