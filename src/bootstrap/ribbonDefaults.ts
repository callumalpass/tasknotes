export type RibbonConfiguration = {
	items: Array<{ id: string; hidden: boolean }>;
	onChange(save: boolean): void;
};

/** Apply defaults only once. Obsidian's ribbon menu owns all subsequent choices. */
export function applyNewInstallRibbonDefaults(
	ribbon: RibbonConfiguration | undefined,
	firstInstall: boolean,
	optionalIds: ReadonlySet<string>
): void {
	if (!firstInstall || !ribbon) return;
	for (const item of ribbon.items) {
		if (optionalIds.has(item.id)) item.hidden = true;
	}
	ribbon.onChange(true);
}
