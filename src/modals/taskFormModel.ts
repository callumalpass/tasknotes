import type { Reminder } from "../types";

export interface TaskFormValues {
	title: string;
	details: string;
	dueDate: string;
	scheduledDate: string;
	priority: string;
	status: string;
	contexts: string;
	projects: string;
	tags: string;
	timeEstimate: number;
	recurrenceRule: string;
	recurrenceAnchor: "scheduled" | "completion";
	reminders: Reminder[];
	userFields: Record<string, unknown>;
}

export type TaskFormField = keyof TaskFormValues;
export type TaskFormErrorField = "title" | "timeEstimate";

/** Values the natural language input currently contributes to the form. */
export type TaskFormNaturalLanguageLayer = Partial<Omit<TaskFormValues, "userFields" | "projects">> & {
	userFields?: Record<string, unknown>;
};

const USER_FIELD_PREFIX = "userFields.";

/**
 * The single source of truth for a task modal. Controls write here and render from here,
 * so manual edits, natural language input and validation cannot disagree.
 */
export class TaskFormModel {
	readonly values: TaskFormValues;
	private readonly errors = new Map<TaskFormErrorField, string>();
	private readonly listeners = new Set<() => void>();
	private readonly manuallyEdited = new Set<string>();
	// What each field held before natural language took it over, so deleting the
	// text that set a field restores the field.
	private readonly naturalLanguageBase = new Map<string, unknown>();
	private cleanSnapshot = "";

	constructor(values: TaskFormValues) {
		this.values = values;
		this.markClean();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Apply values that did not come from the person editing the form. */
	patch(values: Partial<TaskFormValues>): void {
		Object.assign(this.values, values);
		this.notify();
	}

	/** Record a manual edit. Natural language no longer overrides this field. */
	edit<K extends TaskFormField>(field: K, value: TaskFormValues[K]): void {
		this.values[field] = value;
		this.claimField(field);
		if (field === "title" || field === "timeEstimate") this.errors.delete(field);
		this.notify();
	}

	editUserField(key: string, value: unknown): void {
		this.values.userFields[key] = value;
		this.claimField(USER_FIELD_PREFIX + key);
		this.notify();
	}

	/** Hand a field back to natural language, for example after it was cleared by hand. */
	releaseField(field: TaskFormField): void {
		this.manuallyEdited.delete(field);
	}

	applyNaturalLanguage(layer: TaskFormNaturalLanguageLayer): void {
		const { userFields, ...fields } = layer;
		const next = new Map<string, unknown>(Object.entries(fields));
		for (const [key, value] of Object.entries(userFields ?? {})) {
			next.set(USER_FIELD_PREFIX + key, value);
		}

		for (const [key, base] of this.naturalLanguageBase) {
			if (next.has(key)) continue;
			this.writeKey(key, base);
			this.naturalLanguageBase.delete(key);
		}

		for (const [key, value] of next) {
			if (this.manuallyEdited.has(key)) continue;
			if (!this.naturalLanguageBase.has(key)) {
				this.naturalLanguageBase.set(key, this.readKey(key));
			}
			this.writeKey(key, value);
			if (key === "title" || key === "timeEstimate") this.errors.delete(key);
		}

		this.notify();
	}

	setError(field: TaskFormErrorField, message: string | null): void {
		if (message) {
			this.errors.set(field, message);
		} else {
			this.errors.delete(field);
		}
		this.notify();
	}

	getError(field: TaskFormErrorField): string | undefined {
		return this.errors.get(field);
	}

	hasErrors(): boolean {
		return this.errors.size > 0;
	}

	markClean(): void {
		this.cleanSnapshot = JSON.stringify(this.values);
	}

	isDirty(): boolean {
		return JSON.stringify(this.values) !== this.cleanSnapshot;
	}

	private claimField(key: string): void {
		this.manuallyEdited.add(key);
		this.naturalLanguageBase.delete(key);
	}

	private readKey(key: string): unknown {
		return key.startsWith(USER_FIELD_PREFIX)
			? this.values.userFields[key.slice(USER_FIELD_PREFIX.length)]
			: this.values[key as TaskFormField];
	}

	private writeKey(key: string, value: unknown): void {
		if (key.startsWith(USER_FIELD_PREFIX)) {
			const userFieldKey = key.slice(USER_FIELD_PREFIX.length);
			if (value === undefined) {
				delete this.values.userFields[userFieldKey];
			} else {
				this.values.userFields[userFieldKey] = value;
			}
			return;
		}
		(this.values as unknown as Record<string, unknown>)[key] = value;
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
