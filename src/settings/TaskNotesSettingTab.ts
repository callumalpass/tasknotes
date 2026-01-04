import { App, PluginSettingTab, Platform, requireApiVersion } from "obsidian";
import TaskNotesPlugin from "../main";
import { debounce, DebouncedFunction } from "./components/settingHelpers";
import { renderGeneralTab } from "./tabs/generalTab";
import { renderTaskPropertiesTab } from "./tabs/taskPropertiesTab";
import { renderModalFieldsTab } from "./tabs/modalFieldsTab";
import { renderAppearanceTab } from "./tabs/appearanceTab";
import { renderFeaturesTab } from "./tabs/featuresTab";
import { renderIntegrationsTab } from "./tabs/integrationsTab";
import type { TranslationKey } from "../i18n";

interface TabConfig {
	id: string;
	nameKey: TranslationKey;
	renderFn: (container: HTMLElement, plugin: TaskNotesPlugin, save: () => void) => void;
}

export class TaskNotesSettingTab extends PluginSettingTab {
	plugin: TaskNotesPlugin;
	private activeTab = "general";
	private tabContents: Record<string, HTMLElement> = {};
	private debouncedSave: DebouncedFunction<() => Promise<void>> = debounce(
		() => this.plugin.saveSettings(),
		500
	);

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		// Set icon for settings sidebar (Obsidian 1.11.0+)
		if (requireApiVersion("1.11.0")) {
			this.icon = "tasknotes-simple";
		}

		this.plugin.registerEvent(
			this.plugin.i18n.on("locale-changed", () => {
				if (this.containerEl.isConnected) {
					this.display();
				}
			})
		);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("tasknotes-settings");
		containerEl.addClass("tasknotes-plugin");
		containerEl.addClass("settings-view");

		const translate = (key: TranslationKey) => this.plugin.i18n.translate(key);

		// Create tab navigation
		const tabNav = containerEl.createDiv("settings-tab-nav settings-view__tab-nav");

		// Define the 6-tab structure (defaults merged into task-properties)
		const allTabs: TabConfig[] = [
			{
				id: "general",
				nameKey: "settings.tabs.general",
				renderFn: renderGeneralTab,
			},
			{
				id: "task-properties",
				nameKey: "settings.tabs.taskProperties",
				renderFn: renderTaskPropertiesTab,
			},
			{
				id: "modal-fields",
				nameKey: "settings.tabs.modalFields",
				renderFn: renderModalFieldsTab,
			},
			{
				id: "appearance",
				nameKey: "settings.tabs.appearance",
				renderFn: renderAppearanceTab,
			},
			{
				id: "features",
				nameKey: "settings.tabs.features",
				renderFn: renderFeaturesTab,
			},
			{
				id: "integrations",
				nameKey: "settings.tabs.integrations",
				renderFn: renderIntegrationsTab,
			},
		];

		// Filter out integrations tab on mobile if it only contains API settings
		const tabs = Platform.isMobile
			? allTabs.filter((tab) => tab.id !== "integrations" || this.hasNonAPIIntegrations())
			: allTabs;

		// Reset active tab if it's filtered out on mobile
		if (
			Platform.isMobile &&
			this.activeTab === "integrations" &&
			!this.hasNonAPIIntegrations()
		) {
			this.activeTab = "general";
		}

		// Create tab buttons
		tabs.forEach((tab) => {
			const isActive = this.activeTab === tab.id;
			const label = translate(tab.nameKey);
			const tabButton = tabNav.createEl("button", {
				text: label,
				cls: isActive
					? "settings-tab-button settings-view__tab-button active settings-view__tab-button--active is-active vertical-tab-nav-item"
					: "settings-tab-button settings-view__tab-button vertical-tab-nav-item",
				attr: {
					role: "tab",
					"aria-selected": isActive.toString(),
					"aria-controls": `settings-tab-${tab.id}`,
					id: `tab-button-${tab.id}`,
					tabindex: isActive ? "0" : "-1",
				},
			});

			tabButton.addEventListener("click", () => {
				this.switchTab(tab.id);
			});

			tabButton.addEventListener("keydown", (e) => {
				if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
					e.preventDefault();
					const currentIndex = tabs.findIndex((t) => t.id === tab.id);
					const nextIndex =
						e.key === "ArrowRight"
							? (currentIndex + 1) % tabs.length
							: (currentIndex - 1 + tabs.length) % tabs.length;
					const nextTabId = tabs[nextIndex].id;
					this.switchTab(nextTabId);
				}
			});
		});

		// Add documentation link after tabs
		const docsHeader = containerEl.createDiv("settings-header");
		const docsLink = docsHeader.createEl("a", {
			text: translate("settings.header.documentation"),
			href: translate("settings.header.documentationUrl"),
			cls: "settings-header-link",
		});
		docsLink.setAttr("target", "_blank");

		// Create tab content containers
		const tabContentsEl = containerEl.createDiv(
			"settings-tab-contents settings-view__tab-contents"
		);

		// Create all tab content containers but only render the active one initially
		tabs.forEach((tab) => {
			const tabContent = tabContentsEl.createDiv(
				"settings-tab-content settings-view__tab-content"
			);
			tabContent.setAttribute("role", "tabpanel");
			tabContent.setAttribute("id", `settings-tab-${tab.id}`);
			tabContent.setAttribute("aria-labelledby", `tab-button-${tab.id}`);

			if (this.activeTab === tab.id) {
				tabContent.addClass("active");
				tabContent.addClass("settings-view__tab-content--active");
				// Render the active tab content
				tab.renderFn(tabContent, this.plugin, this.debouncedSave);
			}

			this.tabContents[tab.id] = tabContent;
		});
	}

	private switchTab(tabId: string): void {
		// Update active tab state
		// const previousTab = this.activeTab;
		this.activeTab = tabId;

		// Update tab button states
		this.containerEl.querySelectorAll(".settings-tab-button").forEach((button) => {
			const isActive = button.id === `tab-button-${tabId}`;
			button.classList.toggle("active", isActive);
			button.classList.toggle("settings-view__tab-button--active", isActive);
			button.classList.toggle("is-active", isActive);
			button.setAttribute("aria-selected", isActive.toString());
			button.setAttribute("tabindex", isActive ? "0" : "-1");
		});

		// Update tab content states
		this.containerEl.querySelectorAll(".settings-tab-content").forEach((content) => {
			const isActive = content.id === `settings-tab-${tabId}`;
			content.classList.toggle("active", isActive);
			content.classList.toggle("settings-view__tab-content--active", isActive);
		});

		// Render the new active tab content if it hasn't been rendered yet
		const activeTabContent = this.tabContents[tabId];
		if (activeTabContent && activeTabContent.children.length === 0) {
			// Find the tab configuration and render it
			const tabConfig = this.getTabConfigurations().find((tab) => tab.id === tabId);
			if (tabConfig) {
				tabConfig.renderFn(activeTabContent, this.plugin, this.debouncedSave);
			}
		}

		// Focus the newly active tab button
		setTimeout(() => {
			const activeTabButton = this.containerEl.querySelector(
				`#tab-button-${tabId}`
			) as HTMLElement;
			if (activeTabButton) {
				activeTabButton.focus();
			}
		}, 50);
	}

	private getTabConfigurations(): TabConfig[] {
		return [
			{
				id: "general",
				nameKey: "settings.tabs.general",
				renderFn: renderGeneralTab,
			},
			{
				id: "task-properties",
				nameKey: "settings.tabs.taskProperties",
				renderFn: renderTaskPropertiesTab,
			},
			{
				id: "modal-fields",
				nameKey: "settings.tabs.modalFields",
				renderFn: renderModalFieldsTab,
			},
			{
				id: "appearance",
				nameKey: "settings.tabs.appearance",
				renderFn: renderAppearanceTab,
			},
			{
				id: "features",
				nameKey: "settings.tabs.features",
				renderFn: renderFeaturesTab,
			},
			{
				id: "integrations",
				nameKey: "settings.tabs.integrations",
				renderFn: renderIntegrationsTab,
			},
		];
	}

	private hasNonAPIIntegrations(): boolean {
		// Check if there are integrations other than HTTP API that work on mobile
		// Currently: ICS subscriptions and plugin integrations work on mobile
		return true; // ICS subscriptions are always available
	}

	/**
	 * Called when the settings tab is hidden/closed.
	 * Flushes any pending debounced saves to ensure settings are persisted.
	 */
	hide(): void {
		this.debouncedSave.flush();
	}
}
