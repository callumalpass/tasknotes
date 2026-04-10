/**
 * Type declarations for Obsidian 1.12.2 CLI APIs
 * These augment the existing obsidian module types
 */

import "obsidian";

declare module "obsidian" {
	export interface CliData {
		[key: string]: string | "true";
	}

	export interface CliFlag {
		value?: string;
		description: string;
		required?: boolean;
	}

	export type CliFlags = Record<string, CliFlag>;
	export type CliHandler = (params: CliData) => string | Promise<string>;

	interface Plugin {
		/**
		 * Register a CLI handler to handle a command from the CLI.
		 * @since Obsidian 1.12.2
		 */
		registerCliHandler(
			command: string,
			description: string,
			flags: CliFlags | null,
			handler: CliHandler
		): void;
	}
}
