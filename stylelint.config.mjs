import stylelint from "stylelint";

const { createPlugin, utils } = stylelint;

const noHasRuleName = "tasknotes/no-has";
const obsidianBrowserSupportRuleName = "tasknotes/obsidian-browser-support";

const noHasRule = createPlugin(noHasRuleName, (enabled) => {
	return (root, result) => {
		if (!enabled) {
			return;
		}

		root.walkRules((ruleNode) => {
			const selector = ruleNode.selector ?? "";
			let searchIndex = 0;

			while (searchIndex < selector.length) {
				const index = selector.indexOf(":has(", searchIndex);

				if (index === -1) {
					break;
				}

				utils.report({
					message:
						"Avoid :has - it can cause significant performance issues due to broad selector invalidation.",
					node: ruleNode,
					result,
					ruleName: noHasRuleName,
					index,
					endIndex: index + ":has".length,
				});

				searchIndex = index + ":has(".length;
			}
		});
	};
});

const partiallySupportedFeatures = [
	{
		feature: "css-display-contents",
		matches: (declaration) =>
			declaration.prop.toLowerCase() === "display" &&
			/\bcontents\b/iu.test(declaration.value),
	},
	{
		feature: "multicolumn",
		matches: (declaration) => {
			const property = declaration.prop.toLowerCase();

			return (
				property === "columns" ||
				property.startsWith("column-") ||
				property === "break-inside"
			);
		},
	},
	{
		feature: "text-decoration",
		matches: (declaration) => {
			const property = declaration.prop.toLowerCase();

			return (
				property === "text-decoration-line" ||
				property === "text-decoration-thickness"
			);
		},
	},
];

const obsidianBrowserSupportRule = createPlugin(
	obsidianBrowserSupportRuleName,
	(enabled) => {
		return (root, result) => {
			if (!enabled) {
				return;
			}

			root.walkDecls((declaration) => {
				for (const { feature, matches } of partiallySupportedFeatures) {
					if (!matches(declaration)) {
						continue;
					}

					utils.report({
						message: `Unexpected browser feature "${feature}" is only partially supported by Obsidian 1.11.4,144,146,148`,
						node: declaration,
						result,
						ruleName: obsidianBrowserSupportRuleName,
					});
				}
			});
		};
	}
);

const warning = { severity: "warning" };

export default {
	plugins: [noHasRule, obsidianBrowserSupportRule],
	rules: {
		"color-hex-length": [
			"long",
			{
				...warning,
				message: "Use the full 6-digit hex format for consistency.",
			},
		],
		"declaration-block-no-duplicate-properties": [true, warning],
		"declaration-no-important": [
			true,
			{
				...warning,
				message:
					"Avoid !important - override styles by increasing selector specificity or using CSS variables instead.",
			},
		],
		"no-duplicate-selectors": [true, warning],
		[noHasRuleName]: [true, warning],
		[obsidianBrowserSupportRuleName]: [true, warning],
	},
};
