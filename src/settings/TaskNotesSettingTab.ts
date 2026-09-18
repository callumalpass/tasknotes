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
				ctx.t("settings.native.taskFiles"),
				ctx.t("settings.native.taskIdentificationFoldersFilenamesAndFrontmatter"),
				[
					storage,
					identification,
					folders,
					page(
						ctx.t("settings.native.filenames"),
						ctx.t("settings.native.namesForTaskNotesAndRecurringOccurrences"),
						filenameDefinitions(ctx)
					),
					frontmatter,
				]
			),
			page(
				ctx.t("ui.filterBar.properties"),
				ctx.t("settings.native.propertyMappingsStatusesPrioritiesAndCustomProperties"),
				propertyDefinitions(ctx)
			),
			page(
				ctx.t("settings.features.taskCreation.header"),
				ctx.t("settings.native.defaultsTemplatesNaturalLanguageInputAndFormFields"),
				[
					creation,
					page(
						ctx.t("settings.native.defaults"),
						ctx.t("settings.native.valuesToUseWhenCreatingATask"),
						creationDefaults(ctx)
					),
					page(
						ctx.t("settings.native.templates"),
						ctx.t("settings.native.taskBodiesAndRecurringOccurrenceNotes"),
						[templates]
					),
					nlp,
					page(
						ctx.t("settings.native.formFields"),
						ctx.t("settings.native.chooseWhichFieldsAppearWhenCreatingAndEditingTasks"),
						formDefinitions(ctx)
					),
				]
			),
			page(
				ctx.t("settings.native.appearanceInteraction"),
				ctx.t("settings.native.taskCardsInlineTasksClickBehaviourAndViewDefaults"),
				[
					cards,
					formatting,
					interaction,
					inline,
					interfaceElements,
					page(
						ctx.t("settings.native.calendarDefaults"),
						ctx.t(
							"settings.native.defaultsForCalendarViewsIndividualBasesViewsMayOverride"
						),
						[calendar, visibility, times]
					),
					page(
						ctx.t("settings.integrations.basesIntegration.viewCommands.header"),
						ctx.t(
							"settings.native.configureViewCommandsChangeFiltersSortingAndGroupingInside"
						),
						[bases]
					),
				]
			),
			page(
				ctx.t("settings.native.timeReminders"),
				ctx.t("settings.native.notificationsTimeTrackingRecurrencePomodoroAndTimeblocking"),
				[
					page(
						ctx.t("settings.features.notifications.header"),
						ctx.t("settings.native.reminderDeliveryAndSounds"),
						[notifications]
					),
					tracking,
					recurring,
					page(
						ctx.t("views.pomodoro.title"),
						ctx.t("settings.native.timerDurationsSoundsHistoryAndMobilePlacement"),
						[pomodoro]
					),
					page(
						ctx.t("settings.features.timeblocking.header"),
						ctx.t("settings.native.calendarBlocksAndAttachments"),
						[timeblocking]
					),
				]
			),
			page(
				ctx.t("settings.native.calendarsIntegrations"),
				ctx.t("settings.native.calendarAccountsSubscriptionsTaskExportAndInteroperability"),
				[
					...calendarDefinitions(ctx),
					ctx.field(
						this.plugin.settings,
						"enableMdbaseSpec",
						"enableMdbaseSpec",
						t("settings.integrations.mdbaseSpec.enable.name"),
						{ desc: t("settings.integrations.mdbaseSpec.enable.description") }
					),
					{
						name: t("settings.integrations.mdbaseSpec.learnMore"),
						action: () => window.open("https://mdbase.dev", "_blank"),
					},
				]
			),
			page(
				ctx.t("settings.native.advanced"),
				ctx.t("settings.native.indexingHTTPAPIWebhooksAndDiagnostics"),
				[performance, diagnostics, apiDefinitions(ctx)]
			),
			language,
			page(t("settings.general.releaseNotes.header"), this.plugin.manifest.version, [
				releases,
			]),
			{
				name: t("settings.header.documentation"),
				action: () => window.open(t("settings.header.documentationUrl"), "_blank"),
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
