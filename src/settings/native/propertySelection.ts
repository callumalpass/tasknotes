import type { SettingDefinitionPage } from "obsidian";
import { getAvailableProperties } from "../../utils/propertyHelpers";
import { SettingsContext } from "./SettingsContext";
import { reorder } from "./properties";

/** Native toggles and list ordering replace the separate property-selection modal. */
export function propertySelectionPage(
	ctx: SettingsContext,
	key: "defaultVisibleProperties" | "inlineVisibleProperties",
	name: string,
	desc: string
): SettingDefinitionPage {
	const { plugin, save } = ctx;
	const available = getAvailableProperties(plugin);
	const read = () => plugin.settings[key] ?? [];
	const order = [...new Set([...read(), ...available.map((property) => property.id)])];
	return {
		type: "page",
		name,
		desc,
		displayValue: () =>
			read()
				.map((id) => available.find((property) => property.id === id)?.label ?? id)
				.join(", "),
		items: [
			{
				type: "list",
				heading: name,
				onReorder: (from, to) => {
					plugin.settings[key] = reorder(order, from, to).filter((id) =>
						read().includes(id)
					);
					save();
					ctx.rebuild();
				},
				items: order.map((id) =>
					ctx.toggle(`${key}.${id}`, {
						name: available.find((property) => property.id === id)?.label ?? id,
						getValue: () => read().includes(id),
						setValue: (enabled) => {
							plugin.settings[key] = order.filter((candidate) =>
								candidate === id ? enabled : read().includes(candidate)
							);
							save();
						},
					})
				),
			},
		],
	};
}
