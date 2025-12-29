/**
 * Type declarations for Obsidian 1.11.0 APIs
 * These augment the existing obsidian module types
 */

import "obsidian";

declare module "obsidian" {
	/**
	 * A group of related settings with a heading
	 * @since Obsidian 1.11.0
	 */
	export class SettingGroup {
		/**
		 * Creates a new setting group
		 * @param containerEl - The container element to add the group to
		 */
		constructor(containerEl: HTMLElement);

		/**
		 * Sets the heading text for the group
		 * @param text - The heading text or a DocumentFragment
		 */
		setHeading(text: string | DocumentFragment): this;

		/**
		 * Adds a CSS class to the group element
		 * @param cls - The class name to add
		 */
		addClass(cls: string): this;

		/**
		 * Adds a setting to the group
		 * @param cb - Callback that receives the Setting to configure
		 */
		addSetting(cb: (setting: Setting) => void): this;
	}

	interface Setting {
		/**
		 * Adds a custom component to the setting
		 * @since Obsidian 1.11.0
		 * @param cb - Callback that receives the setting element and returns a component
		 */
		addComponent<T extends BaseComponent>(cb: (el: HTMLElement) => T): this;
	}

	interface SettingTab {
		/**
		 * The icon to display in the settings sidebar
		 * @since Obsidian 1.11.0
		 */
		icon?: IconName;
	}
}
