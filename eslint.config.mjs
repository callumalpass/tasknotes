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
		},
		rules: {
			...tseslint.configs.recommended.rules,

			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ args: "none", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-inferrable-types": "warn",
			"no-constant-condition": "warn",
			"no-case-declarations": "warn",
			"no-undef": "warn",
			"no-restricted-globals": "warn",
			"@microsoft/sdl/no-inner-html": "warn",
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
			"@typescript-eslint/no-misused-promises": "off",
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
			"@typescript-eslint/no-deprecated": "off",
			"@typescript-eslint/no-base-to-string": "off",
			"@typescript-eslint/no-redundant-type-constituents": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			"@typescript-eslint/no-non-null-assertion": "warn",
			"@typescript-eslint/no-require-imports": "warn",
			"import/no-nodejs-modules": "off",
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
