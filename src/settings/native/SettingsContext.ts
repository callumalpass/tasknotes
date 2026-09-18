import { Notice, type SettingDefinition, type SettingControl } from "obsidian";
import type TaskNotesPlugin from "../../main";

interface ValueOptions<T> {
	name: string;
	desc?: string;
	getValue: () => T;
	setValue: (value: T) => void | Promise<void>;
	placeholder?: string;
	ariaLabel?: string;
	debounceMs?: number;
	validate?: (value: T) => string | void;
}
interface Binding {
	read: () => unknown;
	write: (value: unknown) => void | Promise<void>;
}

/** Small binding adapter for Obsidian's definitions. No DOM or service work during indexing. */
export class SettingsContext {
	private bindings = new Map<string, Binding>();
	private pending = new Set<Promise<void>>();
	private saveError: Error | undefined;
	private readonly aliases: Record<string, string[]> = {
		tasksFolder: ["location", "directory", "where tasks are saved"],
		archiveFolder: ["archive location", "directory"],
		storeTitleInFilename: ["rename", "note name"],
		enableNaturalLanguageInput: ["NLP", "quick capture", "parse dates"],
		disableNoteIndexing: ["performance", "index", "cache"],
	};
	constructor(
		readonly plugin: TaskNotesPlugin,
		readonly refresh: () => void,
		readonly rebuild: () => void
	) {}

	readonly t = (key: string, params?: Record<string, string | number>): string =>
		this.plugin.i18n.translate(key, params);

	readonly save = (): void => {
		const pending = this.plugin
			.saveSettings()
			.then(() => {
				this.saveError = undefined;
			})
			.catch((error: unknown) => {
				this.saveError = error instanceof Error ? error : new Error(String(error));
				new Notice(
					this.t("settings.native.saveError", {
						error: error instanceof Error ? error.message : String(error),
					})
				);
			})
			.finally(() => this.pending.delete(pending));
		this.pending.add(pending);
	};

	async flush(): Promise<void> {
		await Promise.all(this.pending);
		if (this.saveError) throw this.saveError;
	}

	begin(): void {
		this.bindings.clear();
	}

	read(key: string): unknown {
		return this.bindings.get(key)?.read();
	}
	async write(key: string, value: unknown): Promise<void> {
		const binding = this.bindings.get(key);
		if (!binding) throw new Error(`Unknown setting: ${key}`);
		await binding.write(value);
		await this.flush();
		this.refresh();
	}

	private bind<T extends string | number | boolean>(
		key: string,
		options: ValueOptions<T>,
		control: SettingControl,
		accepts: (value: unknown) => value is T,
		disabled?: () => boolean
	): SettingDefinition {
		if (this.bindings.has(key)) throw new Error(`Duplicate setting binding: ${key}`);
		this.bindings.set(key, {
			read: options.getValue,
			write: async (value) => {
				if (!accepts(value)) throw new Error(`Invalid value for ${key}`);
				const error = options.validate?.(value);
				if (error) throw new Error(error);
				await options.setValue(value);
			},
		});
		return {
			name: options.name,
			desc: options.desc,
			aliases: [
				key,
				key.replace(/([A-Z])/g, " $1").replace(/\./g, " "),
				...(this.aliases[key] ?? []),
			],
			control: { ...control, disabled },
		};
	}

	toggle(
		key: string,
		options: ValueOptions<boolean>,
		disabled?: () => boolean
	): SettingDefinition {
		return this.bind(
			key,
			options,
			{ type: "toggle", key },
			(v): v is boolean => typeof v === "boolean",
			disabled
		);
	}
	text(key: string, options: ValueOptions<string>, disabled?: () => boolean): SettingDefinition {
		const type = /^(tasksFolder|archiveFolder|inlineTaskConvertFolder)$/.test(key)
			? "folder"
			: /bodyTemplate$/i.test(key)
				? "file"
				: "text";
		return this.bind(
			key,
			options,
			{ type, key, placeholder: options.placeholder, validate: options.validate },
			(v): v is string => typeof v === "string",
			disabled
		);
	}
	dropdown(
		key: string,
		options: ValueOptions<string> & { options: Array<{ value: string; label: string }> },
		disabled?: () => boolean
	): SettingDefinition {
		const choices = Object.fromEntries(options.options.map((o) => [o.value, o.label]));
		return this.bind(
			key,
			options,
			{ type: "dropdown", key, options: choices },
			(v): v is string =>
				typeof v === "string" && Object.prototype.hasOwnProperty.call(choices, v),
			disabled
		);
	}
	number(
		key: string,
		options: ValueOptions<number> & { min?: number; max?: number; step?: number },
		disabled?: () => boolean
	): SettingDefinition {
		const validate = (value: number): string | void => {
			if (
				!Number.isFinite(value) ||
				(options.min !== undefined && value < options.min) ||
				(options.max !== undefined && value > options.max)
			) {
				return this.t("settings.native.numberRange", {
					min: options.min ?? "−∞",
					max: options.max ?? "∞",
				});
			}
			return options.validate?.(value);
		};
		return this.bind(
			key,
			{ ...options, validate },
			{
				type: "number",
				key,
				min: options.min,
				max: options.max,
				step: options.step,
				validate,
			},
			(v): v is number => typeof v === "number",
			disabled
		);
	}
	button(
		_key: string,
		options: {
			name: string;
			desc?: string;
			buttonText: string;
			onClick: () => void | Promise<void>;
		},
		disabled?: () => boolean
	): SettingDefinition {
		let busy = false;
		return {
			name: options.name,
			desc: options.desc,
			disabled: () => busy || (disabled?.() ?? false),
			action: () => {
				void (async () => {
					if (busy || disabled?.()) return;
					busy = true;
					this.refresh();
					try {
						await options.onClick();
						await this.flush();
					} catch (error) {
						new Notice(error instanceof Error ? error.message : String(error));
					} finally {
						busy = false;
						this.refresh();
					}
				})();
			},
		};
	}
	field<T extends object, K extends keyof T>(
		object: T,
		property: K,
		key: string,
		name: string,
		config: {
			type?: "text" | "toggle" | "number" | "dropdown" | "file" | "folder";
			desc?: string;
			options?: Record<string, string>;
			min?: number;
			max?: number;
			validate?: (value: string) => string | void;
			disabled?: () => boolean;
			onChange?: () => void;
		} = {}
	): SettingDefinition {
		const type =
			config.type ??
			(typeof object[property] === "boolean"
				? "toggle"
				: typeof object[property] === "number"
					? "number"
					: "text");
		const set = (value: string | number | boolean) => {
			object[property] = value as T[K];
			config.onChange?.();
			this.save();
		};
		if (type === "toggle")
			return this.toggle(
				key,
				{
					name,
					desc: config.desc,
					getValue: () => Boolean(object[property]),
					setValue: set,
				},
				config.disabled
			);
		if (type === "number")
			return this.number(
				key,
				{
					name,
					desc: config.desc,
					getValue: () => Number(object[property] ?? 0),
					setValue: set,
					min: config.min,
					max: config.max,
				},
				config.disabled
			);
		if (type === "dropdown")
			return this.dropdown(
				key,
				{
					name,
					desc: config.desc,
					getValue: () => String(object[property] ?? ""),
					setValue: set,
					options: Object.entries(config.options ?? {}).map(([value, label]) => ({
						value,
						label,
					})),
				},
				config.disabled
			);
		const result = this.text(
			key,
			{
				name,
				desc: config.desc,
				getValue: () => String(object[property] ?? ""),
				setValue: set,
				validate: config.validate,
			},
			config.disabled
		);
		if ("control" in result && result.control && (type === "file" || type === "folder"))
			result.control = { type, key, disabled: config.disabled, validate: config.validate };
		return result;
	}
}
