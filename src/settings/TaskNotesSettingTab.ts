import { msg } from "@lingui/core/macro";
import {
	App,
	PluginSettingTab,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from "obsidian";
import type TaskNotesPlugin from "../main";
import { SettingsContext } from "./native/SettingsContext";
import { makePageNamesUnique, preservePageNavigation } from "./native/preservePageNavigation";
import { generalDefinitions } from "./native/general";
import { featuresDefinitions } from "./native/features";
import { appearanceDefinitions } from "./native/appearance";
import { propertyDefinitions } from "./native/properties";
import { creationDefaults, filenameDefinitions, formDefinitions } from "./native/creation";
import { apiDefinitions, calendarDefinitions } from "./native/integrations";

export function openTaskPropertySettings(plugin: TaskNotesPlugin, property: "status" | "priority"): void {
	plugin.app.setting.open();
	const tab = plugin.app.setting.openTabById(plugin.manifest.id);
	tab.update();
	const heading = plugin.i18n.translate(property === "status"
		? msg({ message: "Statuses", context: "settings.native.statuses" })
		: msg({ message: "Priorities", context: "settings.native.priorities" }));
	const findDefinition = (items: SettingDefinitionItem[], path: string[] = []): { definition: SettingDefinitionItem; path: string[] } | undefined => {
		for (const item of items) {
			if ("heading" in item && item.heading === heading) return { definition: item, path };
			if ("items" in item) {
				const match = findDefinition(item.items ?? [], item.type === "page" ? [...path, item.name] : path);
				if (match) return match;
			}
		}
	};
	const match = findDefinition(tab.settingItems);
	if (match) {
		const navigation = plugin.app.setting as unknown as {
			navigateToPage?: (target: typeof tab, path: string[]) => void;
		};
		navigation.navigateToPage?.(tab, match.path);
		plugin.app.setting.scrollToDefinition(tab, match.definition);
		tab.getElementForDefinition(match.definition)?.querySelector<HTMLElement>(".extra-setting-button")?.focus();
	}
}

/** Native definitions are both the settings UI and Obsidian's search index. */
export class TaskNotesSettingTab extends PluginSettingTab {
	private readonly context: SettingsContext;
	private indexedSettings: TaskNotesPlugin["settings"] | undefined;
	constructor(
		app: App,
		readonly plugin: TaskNotesPlugin
	) {
		super(app, plugin);
		this.icon = "tasknotes-simple";
		this.context = new SettingsContext(
			plugin,
			() => this.refreshDomState(),
			() => this.update()
		);
		plugin.registerEvent(plugin.i18n.on("locale-changed", () => this.update()));
		plugin.registerEvent(
			plugin.emitter.on("settings-changed", () => {
				// Sync/external reload replaces the settings object. Rebind editors to it;
				// ordinary saves keep the same object and must not rerender every input.
				if (this.indexedSettings !== plugin.settings) this.update();
			})
		);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const ctx = this.context;
		this.indexedSettings = this.plugin.settings;
		ctx.begin();
		const t = this.plugin.i18n.translate.bind(this.plugin.i18n);
		const [storage, identification, bases, folders, language, frontmatter, releases] =
			generalDefinitions(ctx);
		const [
			inline,
			nlp,
			creation,
			templates,
			pomodoro,
			notifications,
			performance,
			tracking,
			recurring,
			timeblocking,
			diagnostics,
		] = featuresDefinitions(ctx);
		const [cards, formatting, calendar, visibility, times, interfaceElements, interaction] =
			appearanceDefinitions(ctx);
		const page = (
			name: string,
			desc: string,
			items: SettingDefinitionItem[]
		): SettingDefinitionPage => ({ type: "page", name, desc, items });
		const definitions: SettingDefinitionItem[] = [
			page(
				ctx.t(msg({ message: "Task files", context: "settings.native.taskFiles" })),
				ctx.t(msg({ message: "Task identification, folders, filenames, and frontmatter.", context: "settings.native.taskIdentificationFoldersFilenamesAndFrontmatter" })),
				[
					storage,
					identification,
					folders,
					{
						type: "group",
						heading: ctx.t(msg({ message: "Filenames", context: "settings.native.filenames" })),
						items: filenameDefinitions(ctx),
					},
					frontmatter,
				]
			),
			page(
				ctx.t(msg({ message: "Properties", context: "ui.filterBar.properties" })),
				ctx.t(msg({ message: "Property mappings, statuses, priorities, and custom properties.", context: "settings.native.propertyMappingsStatusesPrioritiesAndCustomProperties" })),
				propertyDefinitions(ctx)
			),
			page(
				ctx.t(msg({ message: "Task creation", context: "settings.features.taskCreation.header" })),
				ctx.t(msg({ message: "Defaults, templates, natural-language input, and form fields.", context: "settings.native.defaultsTemplatesNaturalLanguageInputAndFormFields" })),
				[
					creation,
					{
						type: "group",
						heading: ctx.t(msg({ message: "Defaults", context: "settings.native.defaults" })),
						items: creationDefaults(ctx),
					},
					{ ...templates, heading: ctx.t(msg({ message: "Templates", context: "settings.native.templates" })) },
					nlp,
					page(
						ctx.t(msg({ message: "Form fields", context: "settings.native.formFields" })),
						ctx.t(msg({ message: "Choose which fields appear when creating and editing tasks.", context: "settings.native.chooseWhichFieldsAppearWhenCreatingAndEditingTasks" })),
						formDefinitions(ctx)
					),
				]
			),
			page(
				ctx.t(msg({ message: "Appearance & interaction", context: "settings.native.appearanceInteraction" })),
				ctx.t(msg({ message: "Task cards, inline tasks, click behaviour, and view defaults.", context: "settings.native.taskCardsInlineTasksClickBehaviourAndViewDefaults" })),
				[
					cards,
					formatting,
					interaction,
					inline,
					interfaceElements,
					page(
						ctx.t(msg({ message: "Calendar defaults", context: "settings.native.calendarDefaults" })),
						ctx.t(
							msg({ message: "Defaults for calendar views. Individual Bases views may override these settings.", context: "settings.native.defaultsForCalendarViewsIndividualBasesViewsMayOverride" })
						),
						[calendar, visibility, times]
					),
					bases,
				]
			),
			page(
				ctx.t(msg({ message: "Time & reminders", context: "settings.native.timeReminders" })),
				ctx.t(msg({ message: "Notifications, time tracking, recurrence, Pomodoro, and timeblocking.", context: "settings.native.notificationsTimeTrackingRecurrencePomodoroAndTimeblocking" })),
				[notifications, tracking, recurring, pomodoro, timeblocking]
			),
			page(
				ctx.t(msg({ message: "Calendars & integrations", context: "settings.native.calendarsIntegrations" })),
				ctx.t(msg({ message: "Calendar accounts, subscriptions, task export, and interoperability.", context: "settings.native.calendarAccountsSubscriptionsTaskExportAndInteroperability" })),
				[
					...calendarDefinitions(ctx),
					ctx.field(
						this.plugin.settings,
						"enableMdbaseSpec",
						"enableMdbaseSpec",
						t(msg({ message: "Generate mdbase type definitions", context: "settings.integrations.mdbaseSpec.enable.name" })),
						{ desc: t(msg({ message: "Generate and maintain mdbase type files (mdbase.yaml and _types/task.md) at the vault root as your settings change.", context: "settings.integrations.mdbaseSpec.enable.description" })) }
					),
					{
						name: t(msg({ message: "Learn more about mdbase-spec", context: "settings.integrations.mdbaseSpec.learnMore" })),
						action: () => window.open("https://mdbase.dev", "_blank"),
					},
				]
			),
			page(
				ctx.t(msg({ message: "Advanced", context: "settings.native.advanced" })),
				ctx.t(msg({ message: "Indexing, HTTP API, webhooks, and diagnostics.", context: "settings.native.indexingHTTPAPIWebhooksAndDiagnostics" })),
				[performance, diagnostics, apiDefinitions(ctx)]
			),
			language,
			page(t(msg({ message: "Release notes", context: "settings.general.releaseNotes.header" })), this.plugin.manifest.version, [
				releases,
			]),
			{
				name: t(msg({ message: "Documentation", context: "settings.header.documentation" })),
				action: () => window.open("https://tasknotes.dev", "_blank"),
			},
		];
		makePageNamesUnique(definitions);
		preservePageNavigation(this.app, this, this.settingItems ?? [], definitions);
		return definitions;
	}

	/** Obsidian rebuilds the active page on update. Keep an in-progress edit focused. */
	update(): void {
		const focused = this.containerEl.ownerDocument.activeElement;
		const pane = focused?.closest<HTMLElement>(".vertical-tab-content");
		const controls = pane
			? Array.from(
					pane.querySelectorAll<
						HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
					>("input, textarea, select:not(.is-measuring)")
				)
			: [];
		const index = controls.findIndex((control) => control === focused);
		const input = index >= 0 ? controls[index] : undefined;
		const selection =
			input && "selectionStart" in input
				? [input.selectionStart, input.selectionEnd]
				: undefined;
		super.update();
		// Native page display is asynchronous. Do not steal focus if the user has
		// moved elsewhere while the replacement controls were being rendered.
		pane?.ownerDocument.defaultView?.requestAnimationFrame(() => {
			if (
				!input ||
				input.isConnected ||
				!pane.isConnected ||
				pane.ownerDocument.activeElement !== pane.ownerDocument.body
			)
				return;
			const replacement = pane.querySelectorAll<
				HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
			>("input, textarea, select:not(.is-measuring)")[index];
			if (replacement && replacement.tagName === input.tagName) {
				replacement.focus({ preventScroll: true });
				if (
					selection &&
					selection[0] !== null &&
					selection[1] !== null &&
					"setSelectionRange" in replacement
				)
					replacement.setSelectionRange(selection[0], selection[1]);
			}
		});
	}

	getControlValue(key: string): unknown {
		return this.context.read(key);
	}
	async setControlValue(key: string, value: unknown): Promise<void> {
		await this.context.write(key, value);
	}

	hide(): void {
		super.hide();
		void this.context.flush().catch(() => {
			/* The save failure has already been reported. */
		});
	}
}
