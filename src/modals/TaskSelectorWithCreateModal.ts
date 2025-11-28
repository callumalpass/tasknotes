import { App, SuggestModal, TFile, Notice, setIcon, debounce } from "obsidian";
import { TaskInfo, TaskCreationData } from "../types";
import { combineDateAndTime, getCurrentTimestamp } from "../utils/dateUtils";
import { filterEmptyProjects, sanitizeTags } from "../utils/helpers";
import type TaskNotesPlugin from "../main";
import { TranslationKey } from "../i18n";
import {
	NaturalLanguageParser,
	ParsedTaskData,
} from "../services/NaturalLanguageParser";
import { createTaskCard } from "../ui/TaskCard";

export type TaskSelectorWithCreateResult =
	| { type: "selected"; task: TaskInfo }
	| { type: "created"; task: TaskInfo }
	| { type: "cancelled" };

export interface TaskSelectorWithCreateOptions {
	/** Callback when a task is selected or created */
	onResult: (result: TaskSelectorWithCreateResult) => void;
	/** Optional placeholder text override */
	placeholder?: string;
	/** Optional title override */
	title?: string;
}

/**
 * A fuzzy selector modal that allows users to either:
 * 1. Select an existing task from the list
 * 2. Create a new task via NLP parsing by pressing Shift+Enter
 *
 * Features:
 * - Real-time NLP preview in footer as user types
 * - Shift+Enter to create a new task from the current query
 * - Standard Enter to select highlighted existing task
 */
export class TaskSelectorWithCreateModal extends SuggestModal<TaskInfo> {
	private tasks: TaskInfo[];
	private options: TaskSelectorWithCreateOptions;
	private plugin: TaskNotesPlugin;
	private translate: (key: TranslationKey, variables?: Record<string, any>) => string;
	private nlParser: NaturalLanguageParser;
	private createFooterEl: HTMLElement | null = null;
	private currentQuery: string = "";
	private resultHandled: boolean = false;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		tasks: TaskInfo[],
		options: TaskSelectorWithCreateOptions
	) {
		super(app);
		this.plugin = plugin;
		this.tasks = tasks;
		this.options = options;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
		this.nlParser = NaturalLanguageParser.fromPlugin(plugin);

		// Set placeholder
		this.setPlaceholder(
			options.placeholder || this.translate("modals.taskSelectorWithCreate.placeholder")
		);

		// Set instructions
		this.setInstructions([
			{ command: "↑↓", purpose: this.translate("modals.taskSelector.instructions.navigate") },
			{ command: "↵", purpose: this.translate("modals.taskSelector.instructions.select") },
			{
				command: "⇧↵",
				purpose: this.translate("modals.taskSelectorWithCreate.instructions.create"),
			},
			{ command: "esc", purpose: this.translate("modals.taskSelector.instructions.dismiss") },
		]);

		// Set modal title for accessibility
		this.titleEl.setText(
			options.title || this.translate("modals.taskSelectorWithCreate.title")
		);
		this.titleEl.setAttribute("id", "task-selector-with-create-title");

		// Set aria attributes on the modal
		this.containerEl.setAttribute("aria-labelledby", "task-selector-with-create-title");
		this.containerEl.setAttribute("role", "dialog");
		this.containerEl.setAttribute("aria-modal", "true");
		this.containerEl.addClass("task-selector-with-create-modal");
		// Add tasknotes-plugin class so task card styles apply
		this.containerEl.addClass("tasknotes-plugin");
	}

	onOpen(): void {
		super.onOpen();

		// Add keydown listener for Shift+Enter on the modal container to catch it before Obsidian
		this.scope.register(["Shift"], "Enter", (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.createNewTask();
			return false;
		});

		// Add input listener for real-time preview updates
		this.inputEl.addEventListener("input", this.handleInputChange);

		// Create footer after DOM is ready.
		// SuggestModal builds its DOM asynchronously, so we defer to the next tick.
		setTimeout(() => this.createFooter(), 0);
	}

	private createFooter(): void {
		// The SuggestModal structure is: modalEl > .prompt > [input, results]
		// We want to append our footer inside the modalEl, after .prompt
		const modalContentEl = this.modalEl.querySelector(".prompt")?.parentElement || this.modalEl;

		this.createFooterEl = createDiv({ cls: "task-selector-create-footer" });
		this.createFooterEl.style.display = "none";
		modalContentEl.appendChild(this.createFooterEl);
	}

	private handleInputChange = (): void => {
		const query = this.inputEl.value.trim();
		this.currentQuery = query;
		this.updateCreateFooter(query);
	};

	private updateCreateFooter(query: string): void {
		if (!this.createFooterEl) return;

		if (!query) {
			this.createFooterEl.style.display = "none";
			this.createFooterEl.empty();
			return;
		}

		const parsed = this.nlParser.parseInput(query);

		if (parsed.title && parsed.title !== "Untitled Task") {
			this.createFooterEl.empty();
			this.createFooterEl.style.display = "flex";

			// Icon
			const iconDiv = this.createFooterEl.createDiv({ cls: "task-selector-create-footer__icon" });
			setIcon(iconDiv, "plus-circle");

			// Content
			const contentDiv = this.createFooterEl.createDiv({ cls: "task-selector-create-footer__content" });

			// Title line
			const titleLine = contentDiv.createDiv({ cls: "task-selector-create-footer__title-line" });
			titleLine.createSpan({
				cls: "task-selector-create-footer__title",
				text: parsed.title,
			});

			// Metadata chips (if any parsed attributes)
			const metaParts = this.buildMetadataParts(parsed);
			if (metaParts.length > 0) {
				const metaLine = contentDiv.createDiv({ cls: "task-selector-create-footer__meta" });
				metaParts.forEach((part) => {
					const chipEl = metaLine.createSpan({
						cls: `task-selector-create-footer__chip task-selector-create-footer__chip--${part.type}`
					});
					const chipIconEl = chipEl.createSpan({ cls: "task-selector-create-footer__chip-icon" });
					setIcon(chipIconEl, part.icon);
					chipEl.createSpan({ cls: "task-selector-create-footer__chip-text", text: part.text });
				});
			}

			// Shortcut hint
			const hintLine = contentDiv.createDiv({ cls: "task-selector-create-footer__hint" });
			hintLine.createSpan({
				cls: "task-selector-create-footer__shortcut",
				text: "⇧↵",
			});
			hintLine.createSpan({
				cls: "task-selector-create-footer__hint-text",
				text: this.translate("modals.taskSelectorWithCreate.footer.createLabel"),
			});
		} else {
			this.createFooterEl.style.display = "none";
			this.createFooterEl.empty();
		}
	}

	private buildMetadataParts(parsed: ParsedTaskData): Array<{ icon: string; text: string; type: string }> {
		const parts: Array<{ icon: string; text: string; type: string }> = [];

		// Due date
		if (parsed.dueDate) {
			const dateStr = parsed.dueTime ? `${parsed.dueDate} ${parsed.dueTime}` : parsed.dueDate;
			parts.push({ icon: "calendar", text: dateStr, type: "due" });
		}

		// Scheduled date
		if (parsed.scheduledDate) {
			const dateStr = parsed.scheduledTime ? `${parsed.scheduledDate} ${parsed.scheduledTime}` : parsed.scheduledDate;
			parts.push({ icon: "calendar-clock", text: dateStr, type: "scheduled" });
		}

		// Priority
		if (parsed.priority && parsed.priority !== "normal") {
			parts.push({ icon: "flag", text: parsed.priority, type: "priority" });
		}

		// Status
		if (parsed.status) {
			const statusConfig = this.plugin.statusManager.getStatusConfig(parsed.status);
			parts.push({
				icon: "circle-dot",
				text: statusConfig?.label || parsed.status,
				type: "status"
			});
		}

		// Contexts
		if (parsed.contexts && parsed.contexts.length > 0) {
			parsed.contexts.forEach(ctx => {
				parts.push({ icon: "at-sign", text: ctx, type: "context" });
			});
		}

		// Projects
		if (parsed.projects && parsed.projects.length > 0) {
			parsed.projects.forEach(proj => {
				parts.push({ icon: "folder", text: proj.replace(/^\[\[|\]\]$/g, ""), type: "project" });
			});
		}

		// Tags
		if (parsed.tags && parsed.tags.length > 0) {
			parsed.tags.forEach(tag => {
				parts.push({ icon: "hash", text: tag, type: "tag" });
			});
		}

		// Recurrence
		if (parsed.recurrence) {
			parts.push({ icon: "repeat", text: parsed.recurrence, type: "recurrence" });
		}

		// Time estimate
		if (parsed.estimate && parsed.estimate > 0) {
			const hours = Math.floor(parsed.estimate / 60);
			const mins = parsed.estimate % 60;
			const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
			parts.push({ icon: "timer", text: timeStr, type: "estimate" });
		}

		// Details (truncated)
		if (parsed.details) {
			const truncated = parsed.details.length > 30
				? parsed.details.substring(0, 30) + "..."
				: parsed.details;
			parts.push({ icon: "file-text", text: truncated, type: "details" });
		}

		// User fields - look up display names from settings
		if (parsed.userFields) {
			const userFieldDefs = this.plugin.settings.userFields || [];
			for (const [fieldId, value] of Object.entries(parsed.userFields)) {
				const fieldDef = userFieldDefs.find((f) => f.id === fieldId);
				const displayName = fieldDef?.displayName || fieldId;
				const displayValue = Array.isArray(value) ? value.join(", ") : value;
				parts.push({ icon: "sliders-horizontal", text: `${displayName}: ${displayValue}`, type: "userfield" });
			}
		}

		return parts;
	}

	private async createNewTask(): Promise<void> {
		const query = this.inputEl.value.trim();
		if (!query) {
			new Notice(this.translate("modals.taskSelectorWithCreate.notices.emptyQuery"));
			return;
		}

		try {
			// Parse the query using NLP
			const parsed = this.nlParser.parseInput(query);

			if (!parsed.title || parsed.title === "Untitled Task") {
				new Notice(this.translate("modals.taskSelectorWithCreate.notices.invalidTitle"));
				return;
			}

			// Build task creation data
			const taskData = this.buildTaskDataFromParsed(parsed);

			// Create the task
			const result = await this.plugin.taskService.createTask(taskData);

			new Notice(
				this.translate("modals.taskCreation.notices.success", { title: result.taskInfo.title })
			);

			// Close modal and return result
			this.resultHandled = true;
			this.close();
			this.options.onResult({ type: "created", task: result.taskInfo });
		} catch (error) {
			console.error("Failed to create task:", error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(this.translate("modals.taskCreation.notices.failure", { message }));
		}
	}

	private buildTaskDataFromParsed(parsed: ParsedTaskData): TaskCreationData {
		const now = getCurrentTimestamp();

		const taskData: TaskCreationData = {
			title: parsed.title.trim(),
			status: parsed.status || this.plugin.settings.defaultTaskStatus,
			priority: parsed.priority || this.plugin.settings.defaultTaskPriority,
			dateCreated: now,
			dateModified: now,
		};

		// Handle due date with time
		if (parsed.dueDate) {
			taskData.due = parsed.dueTime
				? combineDateAndTime(parsed.dueDate, parsed.dueTime)
				: parsed.dueDate;
		}

		// Handle scheduled date with time
		if (parsed.scheduledDate) {
			taskData.scheduled = parsed.scheduledTime
				? combineDateAndTime(parsed.scheduledDate, parsed.scheduledTime)
				: parsed.scheduledDate;
		}

		if (parsed.contexts && parsed.contexts.length > 0) {
			taskData.contexts = parsed.contexts;
		}

		if (parsed.projects && parsed.projects.length > 0) {
			taskData.projects = parsed.projects;
		}

		if (parsed.tags && parsed.tags.length > 0) {
			taskData.tags = parsed.tags.map((t) => sanitizeTags(t));
		}

		if (parsed.details) {
			taskData.details = parsed.details;
		}

		if (parsed.recurrence) {
			taskData.recurrence = parsed.recurrence;
		}

		if (parsed.estimate && parsed.estimate > 0) {
			taskData.timeEstimate = parsed.estimate;
		}

		// Handle user-defined fields - convert to customFrontmatter using the frontmatter key
		if (parsed.userFields) {
			const customFrontmatter: Record<string, any> = {};
			const userFieldDefs = this.plugin.settings.userFields || [];

			for (const [fieldId, value] of Object.entries(parsed.userFields)) {
				const fieldDef = userFieldDefs.find((f) => f.id === fieldId);
				if (fieldDef) {
					// Use the frontmatter key from the field definition
					const frontmatterKey = fieldDef.key;
					customFrontmatter[frontmatterKey] = Array.isArray(value) ? value.join(", ") : value;
				}
			}

			if (Object.keys(customFrontmatter).length > 0) {
				taskData.customFrontmatter = customFrontmatter;
			}
		}

		return taskData;
	}

	getSuggestions(query: string): TaskInfo[] {
		this.currentQuery = query;
		return this.getFilteredTasks(query);
	}

	private getFilteredTasks(query: string): TaskInfo[] {
		const lowerQuery = query.toLowerCase();

		return this.tasks
			.filter((task) => !task.archived)
			.filter((task) => {
				if (!query) return true;

				// Search in title
				if (task.title && task.title.toLowerCase().includes(lowerQuery)) return true;

				// Search in due date
				if (task.due && task.due.toLowerCase().includes(lowerQuery)) return true;

				// Search in priority
				if (task.priority && task.priority !== "normal" && task.priority.toLowerCase().includes(lowerQuery))
					return true;

				// Search in contexts (filter out null/undefined values)
				if (task.contexts?.some((c) => c && c.toLowerCase().includes(lowerQuery))) return true;

				// Search in projects (filter out null/undefined values)
				const filteredProjects = filterEmptyProjects(task.projects || []);
				if (filteredProjects.some((p) => p && p.toLowerCase().includes(lowerQuery))) return true;

				return false;
			})
			.sort((a, b) => {
				// Sort by completion status first (incomplete tasks come first)
				const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
				const bCompleted = this.plugin.statusManager.isCompletedStatus(b.status);
				if (aCompleted !== bCompleted) {
					return aCompleted ? 1 : -1;
				}

				// Sort by due date second
				if (a.due && !b.due) return -1;
				if (!a.due && b.due) return 1;
				if (a.due && b.due) {
					const dateCompare = a.due.localeCompare(b.due);
					if (dateCompare !== 0) return dateCompare;
				}

				// Then by priority
				const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
				const aPriority = priorityOrder[a.priority] ?? 1;
				const bPriority = priorityOrder[b.priority] ?? 1;
				if (aPriority !== bPriority) return aPriority - bPriority;

				// Finally by title
				return a.title.localeCompare(b.title);
			});
	}

	renderSuggestion(task: TaskInfo, el: HTMLElement): void {
		// Use TaskCard component with default layout for full styling
		const taskCard = createTaskCard(task, this.plugin, undefined, { layout: "default" });

		// Add modal-specific class for any additional styling
		taskCard.classList.add("task-selector-modal__suggestion");

		// Clone the element to remove TaskCard's event listeners
		// This allows the modal's selection handling to work properly
		const cleanCard = taskCard.cloneNode(true) as HTMLElement;

		el.appendChild(cleanCard);
	}

	onChooseSuggestion(task: TaskInfo, evt: MouseEvent | KeyboardEvent): void {
		// Select existing task
		this.resultHandled = true;
		this.options.onResult({ type: "selected", task });
	}

	onClose(): void {
		// Remove event listeners
		this.inputEl.removeEventListener("input", this.handleInputChange);

		// Clean up footer element
		if (this.createFooterEl) {
			this.createFooterEl.remove();
			this.createFooterEl = null;
		}

		// Obsidian's SuggestModal calls onClose() BEFORE onChooseSuggestion().
		// Defer the cancelled check to the next tick so onChooseSuggestion() can set resultHandled first.
		setTimeout(() => {
			if (!this.resultHandled) {
				this.options.onResult({ type: "cancelled" });
			}
		}, 0);

		super.onClose();
	}
}

/**
 * Helper function to open the task selector with create modal
 */
export async function openTaskSelectorWithCreate(
	plugin: TaskNotesPlugin,
	options?: Partial<TaskSelectorWithCreateOptions>
): Promise<TaskSelectorWithCreateResult> {
	const tasks = await plugin.cacheManager.getAllTasks();

	return new Promise((resolve) => {
		const modal = new TaskSelectorWithCreateModal(plugin.app, plugin, tasks, {
			onResult: resolve,
			...options,
		});
		modal.open();
	});
}

/**
 * Helper function to open a task selector with create capability.
 * This is a drop-in replacement for TaskSelectorModal with a simpler callback pattern.
 * Users can select an existing task OR create a new one via Shift+Enter.
 *
 * @param plugin - The TaskNotes plugin instance
 * @param tasks - Array of tasks to choose from
 * @param onChooseTask - Callback when a task is selected or created (null if cancelled)
 * @param options - Optional configuration (placeholder, title)
 */
export function openTaskSelector(
	plugin: TaskNotesPlugin,
	tasks: TaskInfo[],
	onChooseTask: (task: TaskInfo | null) => void,
	options?: { placeholder?: string; title?: string }
): void {
	const modal = new TaskSelectorWithCreateModal(plugin.app, plugin, tasks, {
		placeholder: options?.placeholder,
		title: options?.title,
		onResult: (result) => {
			if (result.type === "selected" || result.type === "created") {
				onChooseTask(result.task);
			} else {
				onChooseTask(null);
			}
		},
	});
	modal.open();
}
