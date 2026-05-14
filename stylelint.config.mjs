import stylelint from "stylelint";
import selectorParser from "postcss-selector-parser";

const { createPlugin, utils } = stylelint;

const noHasRuleName = "tasknotes/no-has";
const obsidianBrowserSupportRuleName = "tasknotes/obsidian-browser-support";
const scopedSelectorsRuleName = "tasknotes/scoped-selectors";
const noFixedPositionRuleName = "tasknotes/no-fixed-position";

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

const ownedSelectorPatterns = [
	/^tasknotes(?:-|$)/u,
	/^task-/u,
	/^tn-/u,
	/^nlp-/u,
	/^advanced-calendar-view(?:__|$)/u,
	/^agenda-view(?:__|$)/u,
	/^calendar-view(?:__|$)/u,
	/^mini-calendar-view(?:__|$)/u,
	/^kanban-view(?:__|$)/u,
	/^filter-(?:bar|heading|toggle)/u,
	/^note-card(?:__|$)/u,
	/^pomodoro(?:-|$)/u,
	/^stats-view(?:__|$)/u,
	/^status-bar$/u,
	/^modal-form(?:__|$)/u,
	/^date-picker(?:__|$)/u,
	/^file-selector/u,
	/^unscheduled-tasks-selector/u,
	/^reminder-/u,
	/^time-entry-editor/u,
	/^webhook-/u,
	/^ics-/u,
	/^base-/u,
	/^bases-/u,
	/^fc-/u,
	/^timeblock-/u,
	/^attachment-/u,
	/^settings-status-indicator$/u,
	/^date-picker-/u,
	/^mini-calendar-note-preview$/u,
	/^preview-/u,
	/^autocomplete-/u,
	/^hide-today-highlight$/u,
	/^filter-date-help-tooltip$/u,
	/^no-reminders$/u,
	/^default-projects-list-container$/u,
	/^field-mapping-input$/u,
	/^icon-suggestion-/u,
	/^google-calendar-/u,
	/^microsoft-calendar-/u,
	/^cm-widget-cursor-fix$/u,
	/^cm-content$/u,
];

const allowedGlobalContextClasses = new Set([
	"theme-dark",
	"theme-light",
	"is-mobile",
	"is-readable-line-width",
	"mod-tasknotes",
	"minimalist-task-modal",
	"suggestion-item",
	"modal",
]);

const scopedContextClasses = new Set(["mod-tasknotes"]);

const allowedHostClassesInScopedContext = new Set([
	"modal",
	"modal-button-container",
	"mod-cta",
]);

const ignoredSelectorFiles = new Set([
	"variables.css",
	"static-style-utilities.css",
	"index.css",
]);

function isOwnedClassOrId(name) {
	return ownedSelectorPatterns.some((pattern) => pattern.test(name));
}

function isScopedSelector(selectorNode) {
	let hasOwnedSelector = false;
	let hasOnlyAllowedGlobals = true;
	let hasClassOrId = false;
	let hasScopedContext = false;
	let hasOnlyScopedContextHostClasses = true;

	selectorNode.walk((node) => {
		if (node.type !== "class" && node.type !== "id") {
			return;
		}

		hasClassOrId = true;

		if (isOwnedClassOrId(node.value)) {
			hasOwnedSelector = true;
			return;
		}

		if (scopedContextClasses.has(node.value)) {
			hasScopedContext = true;
		}

		if (!allowedGlobalContextClasses.has(node.value)) {
			hasOnlyAllowedGlobals = false;
		}

		if (
			!scopedContextClasses.has(node.value) &&
			!allowedHostClassesInScopedContext.has(node.value) &&
			!allowedGlobalContextClasses.has(node.value)
		) {
			hasOnlyScopedContextHostClasses = false;
		}
	});

	if (hasOwnedSelector) {
		return true;
	}

	if (hasScopedContext && hasOnlyScopedContextHostClasses) {
		return true;
	}

	return !hasClassOrId && hasOnlyAllowedGlobals;
}

const scopedSelectorsRule = createPlugin(scopedSelectorsRuleName, (enabled) => {
	return (root, result) => {
		if (!enabled) {
			return;
		}

		const filePath = root.source?.input?.file ?? "";
		const fileName = filePath.split(/[\\/]/u).pop() ?? "";

		if (
			!filePath.includes("/styles/") ||
			filePath.includes("/docs-builder/") ||
			ignoredSelectorFiles.has(fileName)
		) {
			return;
		}

		root.walkRules((ruleNode) => {
			if (ruleNode.parent?.type === "atrule" && ruleNode.parent.name === "keyframes") {
				return;
			}

			let parsedSelector;
			try {
				parsedSelector = selectorParser().astSync(ruleNode.selector);
			} catch {
				return;
			}

			parsedSelector.each((selectorNode) => {
				if (isScopedSelector(selectorNode)) {
					return;
				}

				utils.report({
					message:
						"Scope plugin CSS with a TaskNotes-owned selector or an explicit allowed global context.",
					node: ruleNode,
					result,
					ruleName: scopedSelectorsRuleName,
				});
			});
		});
	};
});

const fixedPositionAllowSelectors = [
	/date-picker-modal/u,
	/stats-view__modal-backdrop/u,
	/tn-selection-indicator/u,
	/tn-fixed/u,
];

const noFixedPositionRule = createPlugin(noFixedPositionRuleName, (enabled) => {
	return (root, result) => {
		if (!enabled) {
			return;
		}

		const filePath = root.source?.input?.file ?? "";
		if (filePath.includes("/docs-builder/")) {
			return;
		}

		root.walkDecls("position", (declaration) => {
			if (declaration.value.toLowerCase() !== "fixed") {
				return;
			}

			const selector = declaration.parent?.selector ?? "";
			if (fixedPositionAllowSelectors.some((pattern) => pattern.test(selector))) {
				return;
			}

			utils.report({
				message:
					"Avoid fixed positioning in plugin CSS unless there is a narrowly reviewed exception.",
				node: declaration,
				result,
				ruleName: noFixedPositionRuleName,
			});
		});
	};
});

const warning = { severity: "warning" };

export default {
	plugins: [
		noHasRule,
		obsidianBrowserSupportRule,
		scopedSelectorsRule,
		noFixedPositionRule,
	],
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
		"property-no-unknown": [true, warning],
		"selector-pseudo-class-no-unknown": [
			true,
			{
				...warning,
				ignorePseudoClasses: ["global"],
			},
		],
		"selector-type-no-unknown": [
			true,
			{
				...warning,
				ignoreTypes: ["pro"],
			},
		],
		[noHasRuleName]: [true, warning],
		[obsidianBrowserSupportRuleName]: [true, warning],
		[scopedSelectorsRuleName]: [true, warning],
		[noFixedPositionRuleName]: [true, warning],
	},
};
