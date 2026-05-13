import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import prettier from "eslint-config-prettier";
import globals from "globals";

const englishLocaleSentenceCaseOptions = {
	allowAutoFix: true,
	brands: [
		"Bases",
		"Brazil",
		"CORS",
		"Discord",
		"Farsi",
		"Friday",
		"German",
		"GitHub",
		"Google",
		"Google Calendar",
		"GTD",
		"HH",
		"iCal",
		"ICS",
		"ISO",
		"JavaScript",
		"Kanban",
		"Markdown",
		"MCP",
		"Microsoft",
		"Microsoft Outlook",
		"Model Context Protocol",
		"Monday",
		"N/A",
		"NLP",
		"Obsidian",
		"Outlook Calendar",
		"Persian",
		"Pomodoro",
		"RRULE",
		"Saturday",
		"Slack",
		"Sunday",
		"TaskNotes",
		"Thursday",
		"Tuesday",
		"UID",
		"UTC",
		"Wednesday",
		"Yahoo Calendar",
		"YYMMDD",
		"fr-FR",
		"mdbase",
	],
	ignoreRegex: [
		"\\b(?:YYYY-MM-DD(?:-HHMMSS)?|YYMMDD|HH:MM|HH:mm(?::ss)?|AM/PM)\\b",
		"\\.(?:ics|ICS)\\b",
		"^\\+ Add a card$",
		"^\\d+\\s+[a-z]+(?:\\s+[a-z]+)*(?: \\(click to manage\\))?$",
		"^[a-z0-9_-]+(?:, [a-z0-9_-]+)*$",
		"^[a-z0-9_-]+/[a-z0-9_/-]+$",
		"^(?:this ungrouped list|estimated|tracked|short|long|completed today|minutes|hours|days|before|after|due date|scheduled date)$",
		"^(?:in your browser|to navigate|to schedule|to dismiss|to select|to cancel|to create new task| to create: |of the following are true:)$",
		"^(?:Projects/, Work/Active, Personal|Calendar/Events)$",
		"^[A-Za-z0-9 _./{}|-]+\\.[A-Za-z0-9]+$",
		"#[0-9a-fA-F]{6}",
		"\\[\\[[^\\]]+\\]\\]",
		"\\{[^}]+\\|n\\(",
		"[Ee]\\.g\\.,",
		"'Timeblock'",
		"literal:",
		"Make sure you have backups",
		"obsidian-frontmatter-markdown-links",
		"Settings > Integrations",
		"Warning: TaskNotes",
		"/mcp endpoint",
		"^https?://",
		"TaskNotes/Views/",
	],
};

const pluginReviewRules = {
	rules: {
		"require-eslint-directive-description": {
			meta: {
				type: "suggestion",
				docs: {
					description:
						"Require descriptions on ESLint directive comments, matching Obsidian plugin review output.",
				},
				messages: {
					missingDescription:
						"Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.",
				},
				schema: [],
			},
			create(context) {
				return {
					Program() {
						const sourceCode = context.sourceCode ?? context.getSourceCode();
						const directivePattern =
							/\beslint-(?:disable|disable-next-line|disable-line|enable)\b/u;

						for (const comment of sourceCode.getAllComments()) {
							const value = comment.value.trim();

							if (!directivePattern.test(value)) {
								continue;
							}

							const descriptionIndex = value.indexOf("--");
							const hasDescription =
								descriptionIndex >= 0 &&
								value.slice(descriptionIndex + 2).trim().length > 0;

							if (!hasDescription) {
								context.report({
									loc: comment.loc,
									messageId: "missingDescription",
								});
							}
						}
					},
				};
			},
		},
	},
};

export default [
	{
		ignores: [
			"node_modules/**",
			"main.js",
			"dist/**",
			"coverage/**",
			"docs/**",
			"docs-builder/**",
			"e2e/**",
			"scripts/**",
			"conformance/**",
			"**/*.test.ts",
			"**/*.spec.ts",
			"**/__tests__/**",
			"tests/**",
			"test/**",
		],
	},

	js.configs.recommended,

	...obsidianmd.configs.recommended,

	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.json",
				sourceType: "module",
			},
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2021,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
			"plugin-review": pluginReviewRules,
		},
		rules: {
			...tseslint.configs.recommended.rules,

			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ args: "none", varsIgnorePattern: "^_" },
			],
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/ban-ts-comment": [
				"warn",
				{
					"ts-expect-error": "allow-with-description",
					"ts-ignore": "allow-with-description",
					"ts-nocheck": "allow-with-description",
					"ts-check": false,
					minimumDescriptionLength: 10,
				},
			],
			"@typescript-eslint/no-explicit-any": [
				"warn",
				{ fixToUnknown: true },
			],
			"@typescript-eslint/no-inferrable-types": "warn",
			"no-constant-condition": "warn",
			"no-case-declarations": "warn",
			"no-undef": "warn",
			"no-new-func": "error",
			"@microsoft/sdl/no-inner-html": "warn",
			"plugin-review/require-eslint-directive-description": "warn",
			"obsidianmd/no-static-styles-assignment": "warn",
			"obsidianmd/rule-custom-message": "warn",
			"obsidianmd/ui/sentence-case": "warn",
			"obsidianmd/no-forbidden-elements": "warn",
			"obsidianmd/settings-tab": "off",
			"obsidianmd/platform": "off",

			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-misused-promises": "warn",
			"@typescript-eslint/no-floating-promises": "warn",
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/no-deprecated": "warn",
			"@typescript-eslint/no-base-to-string": "warn",
			"@typescript-eslint/no-redundant-type-constituents": "warn",
			"@typescript-eslint/restrict-template-expressions": "warn",
			"@typescript-eslint/prefer-promise-reject-errors": "warn",
			"@typescript-eslint/no-non-null-assertion": "warn",
			"@typescript-eslint/no-require-imports": "warn",
			"import/no-nodejs-modules": "warn",
		},
	},

	{
		files: ["src/editor/**/*.ts"],
		rules: {
			"import/no-extraneous-dependencies": "off",
		},
	},

	{
		files: ["src/i18n/resources/en.ts"],
		rules: {
			"obsidianmd/ui/sentence-case-locale-module": [
				"warn",
				englishLocaleSentenceCaseOptions,
			],
		},
	},

	prettier,
];
