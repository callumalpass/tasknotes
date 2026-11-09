import { showToast } from "../../ui/kit/toast";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { changeTaskProperty, updateTaskProjectsWithUndo } from "../../ui/taskPropertyPickers";
import { Menu, TFile, type TAbstractFile } from "obsidian";
import TaskNotesPlugin from "../../main";
import { TaskDependency, TaskInfo } from "../../types";
import { addTaskToProject, assignTaskAsSubtask } from "../../services/taskRelationshipActions";
import { showTextInputModal } from "../../modals/TextInputModal";
import { TagSuggest } from "../../modals/taskModalSuggests";
import { openTaskSelector } from "../../modals/TaskSelectorWithCreateModal";
import { ProjectSelectModal } from "../../modals/ProjectSelectModal";
import {
	DEFAULT_DEPENDENCY_RELTYPE,
	extractDependencyUid,
	formatDependencyLink,
	normalizeDependencyEntry,
} from "../../utils/dependencyUtils";
import { generateLink } from "../../utils/linkUtils";
import {
	addTagsToList,
	clearEditableTagsFromList,
	getEditableTaskTags,
	parseTaskTagInput,
	removeTagsFromList,
} from "../../utils/taskTagList";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";
import type { TaskContextMenuOptions } from "./types";
import {
	getSubmenu,
	toMenuTitle,
	addContextToList,
	toggleContextInList,
	normalizeContextList,
} from "./helpers";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/TaskContextMenu" });
export class TaskRelationshipMenu {
	constructor(
		private options: TaskContextMenuOptions,
		private menu: Menu
	) {}
	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}
	addDependencyMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		menu.addItem((subItem) => {
			subItem.setTitle(
				this.t(
					msg({
						message: "Add “blocked by”…",
						context: "contextMenus.task.dependencies.addBlockedBy",
					})
				)
			);
			subItem.setIcon("link-2");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockedBySelector(task, plugin);
			});
		});

		const blockedByEntries = task.blockedBy ?? [];
		if (blockedByEntries.length > 0) {
			menu.addItem((subItem) => {
				subItem.setTitle(
					this.t(
						msg({
							message: "Remove blocked-by…",
							context: "contextMenus.task.dependencies.removeBlockedBy",
						})
					)
				);
				subItem.setIcon("unlink");
				const innerMenu = getSubmenu(subItem);
				blockedByEntries.forEach((entry, index) => {
					innerMenu.addItem((item) => {
						const uid = toMenuTitle(
							extractDependencyUid(entry),
							this.t(
								msg({
									message: "Unknown",
									context: "contextMenus.task.dependencies.unknownDependency",
								})
							)
						);
						item.setTitle(uid);
						item.onClick(async () => {
							try {
								const remaining = blockedByEntries.filter((_, i) => i !== index);
								const [updatedTask] = await changeTaskProperty(
									plugin,
									[task],
									"blockedBy",
									remaining.length > 0 ? remaining : undefined
								);
								Object.assign(task, updatedTask);
								this.options.onUpdate?.();
							} catch (error) {
								tasknotesLogger.error("Failed to remove blocked-by dependency:", {
									category: "persistence",
									operation: "remove-blocked-by-dependency",
									error: error,
								});
								showToast({
									message: this.t(
										msg({
											message: "Failed to update dependencies",
											context:
												"contextMenus.task.dependencies.notices.updateFailed",
										})
									),
								});
							}
						});
					});
				});
			});
		}

		menu.addSeparator();

		menu.addItem((subItem) => {
			subItem.setTitle(
				this.t(
					msg({
						message: "Add “blocking”…",
						context: "contextMenus.task.dependencies.addBlocking",
					})
				)
			);
			subItem.setIcon("git-branch-plus");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockingSelector(task, plugin);
			});
		});

		const blockingEntries = task.blocking ?? [];
		if (blockingEntries.length > 0) {
			menu.addItem((subItem) => {
				subItem.setTitle(
					this.t(
						msg({
							message: "Remove blocking…",
							context: "contextMenus.task.dependencies.removeBlocking",
						})
					)
				);
				subItem.setIcon("git-branch-minus");
				const innerMenu = getSubmenu(subItem);
				blockingEntries.forEach((path) => {
					const file = plugin.app.vault.getAbstractFileByPath(path);
					const label =
						file instanceof TFile
							? plugin.app.metadataCache.fileToLinktext(file, task.path, false)
							: path.split("/").pop() || path;
					innerMenu.addItem((item) => {
						item.setTitle(label);
						item.onClick(async () => {
							try {
								await plugin.taskService.updateBlockingRelationships(
									task,
									[],
									[path],
									{},
									async (blockedTask, updates) =>
										changeTaskProperty(
											plugin,
											[blockedTask],
											"blockedBy",
											updates.blockedBy
										)
								);
								const refreshed = await plugin.cacheManager.getTaskInfo(task.path);
								if (refreshed) {
									Object.assign(task, refreshed);
								}
								this.options.onUpdate?.();
							} catch (error) {
								tasknotesLogger.error("Failed to remove blocking dependency:", {
									category: "persistence",
									operation: "remove-blocking-dependency",
									error: error,
								});
								showToast({
									message: this.t(
										msg({
											message: "Failed to update dependencies",
											context:
												"contextMenus.task.dependencies.notices.updateFailed",
										})
									),
								});
							}
						});
					});
				});
			});
		}
	}

	dedupeDependencyEntries(entries: Array<TaskDependency | string>): TaskDependency[] {
		const seen = new Map<string, TaskDependency>();
		for (const entry of entries) {
			const normalized = normalizeDependencyEntry(entry);
			if (!normalized) {
				continue;
			}
			const key = this.getDependencyKey(normalized);
			if (!seen.has(key)) {
				seen.set(key, normalized);
			}
		}
		return Array.from(seen.values());
	}

	async openBlockedBySelector(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		const existingUids = new Set(
			(Array.isArray(task.blockedBy) ? task.blockedBy : []).map(
				(dependency) => dependency.uid
			)
		);
		await this.openTaskDependencySelector(
			plugin,
			(candidate) => {
				if (candidate.path === task.path) return false;
				const candidateUid = formatDependencyLink(
					plugin.app,
					task.path,
					candidate.path,
					plugin.settings.useFrontmatterMarkdownLinks
				);
				return !existingUids.has(candidateUid);
			},
			async (selected) => {
				await this.handleBlockedBySelection(task, plugin, selected);
			}
		);
	}

	async openBlockingSelector(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		const existingPaths = new Set(task.blocking ?? []);
		await this.openTaskDependencySelector(
			plugin,
			(candidate) => {
				if (candidate.path === task.path) return false;
				return !existingPaths.has(candidate.path);
			},
			async (selected) => {
				await this.handleBlockingSelection(task, plugin, selected);
			}
		);
	}

	async openTaskDependencySelector(
		plugin: TaskNotesPlugin,
		filter: (candidate: TaskInfo) => boolean,
		onSelect: (selected: TaskInfo) => Promise<void>
	): Promise<void> {
		try {
			const allTasks = await plugin.cacheManager.getAllTasks();
			const candidates = allTasks.filter(filter);

			if (candidates.length === 0) {
				showToast({
					message: this.t(
						msg({
							message: "No matching tasks available",
							context: "contextMenus.task.dependencies.notices.noEligibleTasks",
						})
					),
				});
				return;
			}

			openTaskSelector(plugin, candidates, (task) => {
				if (!task) return;
				void onSelect(task);
			});
		} catch (error) {
			tasknotesLogger.error("Failed to open task selector for dependencies:", {
				category: "persistence",
				operation: "open-task-selector-dependencies",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to update dependencies",
						context: "contextMenus.task.dependencies.notices.updateFailed",
					})
				),
			});
		}
	}

	async handleBlockedBySelection(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		selectedTask: TaskInfo
	): Promise<void> {
		if (selectedTask.path === task.path) {
			return;
		}

		try {
			const dependency: TaskDependency = {
				uid: formatDependencyLink(
					plugin.app,
					task.path,
					selectedTask.path,
					plugin.settings.useFrontmatterMarkdownLinks
				),
				reltype: DEFAULT_DEPENDENCY_RELTYPE,
			};
			const existing = Array.isArray(task.blockedBy) ? task.blockedBy : [];
			const combined = this.dedupeDependencyEntries([...existing, dependency]);
			if (combined.length === existing.length) {
				return;
			}

			const [updatedTask] = await changeTaskProperty(plugin, [task], "blockedBy", combined);
			Object.assign(task, updatedTask);
			this.options.onUpdate?.();
		} catch (error) {
			tasknotesLogger.error("Failed to add blocked-by dependency via selector:", {
				category: "persistence",
				operation: "add-blocked-by-dependency-via-selector",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to update dependencies",
						context: "contextMenus.task.dependencies.notices.updateFailed",
					})
				),
			});
		}
	}

	async handleBlockingSelection(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		selectedTask: TaskInfo
	): Promise<void> {
		const blockedPath = selectedTask.path;
		if (blockedPath === task.path) {
			return;
		}
		if (task.blocking?.includes(blockedPath)) {
			return;
		}

		try {
			const rawEntry: TaskDependency = {
				uid: formatDependencyLink(
					plugin.app,
					blockedPath,
					task.path,
					plugin.settings.useFrontmatterMarkdownLinks
				),
				reltype: DEFAULT_DEPENDENCY_RELTYPE,
			};
			await plugin.taskService.updateBlockingRelationships(
				task,
				[blockedPath],
				[],
				{
					[blockedPath]: rawEntry,
				},
				async (blockedTask, updates) =>
					changeTaskProperty(plugin, [blockedTask], "blockedBy", updates.blockedBy)
			);

			const refreshed = await plugin.cacheManager.getTaskInfo(task.path);
			if (refreshed) {
				Object.assign(task, refreshed);
			}

			this.options.onUpdate?.();
		} catch (error) {
			tasknotesLogger.error("Failed to add blocking dependency via selector:", {
				category: "persistence",
				operation: "add-blocking-dependency-via-selector",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to update dependencies",
						context: "contextMenus.task.dependencies.notices.updateFailed",
					})
				),
			});
		}
	}

	getDependencyKey(entry: TaskDependency): string {
		return `${entry.uid}::${entry.reltype}::${entry.gap ?? ""}`;
	}

	addOrganizationMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		// Contexts
		menu.addItem((subItem) => {
			subItem.setTitle(
				this.t(
					msg({ message: "Contexts", context: "contextMenus.task.organization.contexts" })
				)
			);
			subItem.setIcon("at-sign");
			const contextMenu = getSubmenu(subItem);
			this.addContextMenuItems(contextMenu, task, plugin);
		});

		menu.addSeparator();

		// Add to project
		menu.addItem((subItem) => {
			subItem.setTitle(
				this.t(
					msg({
						message: "Add to project…",
						context: "contextMenus.task.organization.addToProject",
					})
				)
			);
			subItem.setIcon("folder-plus");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openProjectSelector(task, plugin);
			});
		});

		// Add subtasks
		menu.addItem((subItem) => {
			subItem.setTitle(
				this.t(
					msg({
						message: "Add subtasks…",
						context: "contextMenus.task.organization.addSubtasks",
					})
				)
			);
			subItem.setIcon("indent");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openSubtaskAssignmentSelector(task, plugin);
			});
		});
	}

	addContextMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const currentContexts = normalizeContextList(task.contexts);
		const contextOptions = this.getContextOptions(task, plugin);

		menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({
						message: "Add context…",
						context: "contextMenus.task.organization.addContext",
					})
				)
			);
			item.setIcon("plus");
			item.onClick(() => {
				this.menu.hide();
				void this.openContextInput(task, plugin);
			});
		});

		if (contextOptions.length > 0) {
			menu.addSeparator();
			for (const context of contextOptions) {
				menu.addItem((item) => {
					const selected = currentContexts.includes(context);
					item.setTitle(
						selected
							? this.t(
									msg({
										message: "✓ {context}",
										context: "contextMenus.task.organization.contextSelected",
									}),
									{
										context,
									}
								)
							: context
					);
					item.setIcon(selected ? "check" : "at-sign");
					item.onClick(async () => {
						await this.updateTaskContexts(
							task,
							plugin,
							toggleContextInList(task.contexts, context)
						);
					});
				});
			}
		}

		if (currentContexts.length > 0) {
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle(
					this.t(
						msg({
							message: "Clear contexts",
							context: "contextMenus.task.organization.clearContexts",
						})
					)
				);
				item.setIcon("x");
				item.onClick(async () => {
					await this.updateTaskContexts(task, plugin, undefined);
				});
			});
		}
	}

	getContextOptions(task: TaskInfo, plugin: TaskNotesPlugin): string[] {
		const knownContexts = plugin.cacheManager.getAllContexts?.() ?? [];
		const options = normalizeContextList([...knownContexts, ...(task.contexts ?? [])]);
		return options.sort((a, b) => a.localeCompare(b));
	}

	async openContextInput(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		const context = await showTextInputModal(plugin.app, {
			title: this.t(
				msg({
					message: "Add context…",
					context: "contextMenus.task.organization.addContext",
				})
			),
			placeholder: this.t(
				msg({
					message: "context",
					context: "contextMenus.task.organization.contextPlaceholder",
				})
			),
			confirmText: this.t(msg({ message: "Confirm", context: "common.confirm" })),
			cancelText: this.t(msg({ message: "Cancel", context: "common.cancel" })),
		});

		if (!context) return;
		await this.updateTaskContexts(task, plugin, addContextToList(task.contexts, context));
	}

	async updateTaskContexts(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		contexts: string[] | undefined
	): Promise<void> {
		try {
			await changeTaskProperty(plugin, [task], "contexts", contexts);
			const updatedTask = await plugin.cacheManager.getTaskInfo(task.path);
			if (updatedTask) Object.assign(task, updatedTask);
			this.options.onUpdate?.();
		} catch (error) {
			tasknotesLogger.error("Failed to update task contexts:", {
				category: "validation",
				operation: "update-task-contexts",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to update contexts",
						context: "contextMenus.task.organization.notices.updateContextsFailed",
					})
				),
			});
		}
	}

	addTagOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const editableTags = getEditableTaskTags(task, plugin.settings);

		submenu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Add tag…", context: "contextMenus.task.addTag" }))
			);
			item.setIcon("plus");
			item.onClick(() => {
				this.menu.hide();
				void this.openTagInput(task, plugin, "add");
			});
		});

		if (editableTags.length > 0) {
			submenu.addSeparator();
			for (const tag of editableTags) {
				submenu.addItem((item) => {
					item.setTitle(
						this.t(
							msg({
								message: "Remove {tag}",
								context: "contextMenus.task.removeTag",
							}),
							{ tag: `#${tag}` }
						)
					);
					item.setIcon("x");
					item.onClick(async () => {
						await this.updateTaskTags(
							task,
							plugin,
							removeTagsFromList(task.tags, [tag])
						);
					});
				});
			}

			submenu.addSeparator();
			submenu.addItem((item) => {
				item.setTitle(
					this.t(msg({ message: "Clear tags", context: "contextMenus.task.clearTags" }))
				);
				item.setIcon("eraser");
				item.onClick(async () => {
					await this.updateTaskTags(
						task,
						plugin,
						clearEditableTagsFromList(task.tags, plugin.settings)
					);
				});
			});
		}
	}

	async openTagInput(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		mode: "add" | "remove"
	): Promise<void> {
		const input = await showTextInputModal(plugin.app, {
			title:
				mode === "add"
					? this.t(msg({ message: "Add tag…", context: "contextMenus.task.addTag" }))
					: this.t(
							msg({
								message: "Remove tag…",
								context: "contextMenus.task.removeTagInput",
							})
						),
			placeholder: this.t(
				msg({ message: "Tag or #tag", context: "contextMenus.task.tagPlaceholder" })
			),
			confirmText: this.t(msg({ message: "Confirm", context: "common.confirm" })),
			cancelText: this.t(msg({ message: "Cancel", context: "common.cancel" })),
			onInputReady: (inputEl) => {
				new TagSuggest(plugin.app, inputEl, plugin);
			},
		});

		const tags = parseTaskTagInput(input);
		if (tags.length === 0) return;

		const nextTags =
			mode === "add" ? addTagsToList(task.tags, tags) : removeTagsFromList(task.tags, tags);
		await this.updateTaskTags(task, plugin, nextTags);
	}

	async updateTaskTags(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		tags: string[] | undefined
	): Promise<void> {
		try {
			await changeTaskProperty(plugin, [task], "tags", tags);
			const updatedTask = await plugin.cacheManager.getTaskInfo(task.path);
			if (updatedTask) Object.assign(task, updatedTask);
			this.options.onUpdate?.();
		} catch (error) {
			tasknotesLogger.error("Failed to update task tags:", {
				category: "validation",
				operation: "update-task-tags",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to update tags",
						context: "contextMenus.task.notices.updateTagsFailed",
					})
				),
			});
		}
	}

	async openProjectSelector(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		try {
			const selector = new ProjectSelectModal(plugin.app, plugin, (projectFile) => {
				if (!projectFile) return;
				void this.addTaskToProject(task, plugin, projectFile);
			});
			selector.open();
		} catch (error) {
			tasknotesLogger.error("Failed to open project selector:", {
				category: "persistence",
				operation: "open-project-selector",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to open project selector",
						context: "contextMenus.task.organization.notices.projectSelectFailed",
					})
				),
			});
		}
	}

	async openSubtaskAssignmentSelector(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		try {
			const allTasks = await plugin.cacheManager.getAllTasks();

			// Filter out the current task
			const candidates = allTasks.filter((candidate) => candidate.path !== task.path);

			if (candidates.length === 0) {
				showToast({
					message: this.t(
						msg({
							message: "No eligible tasks available to assign as subtasks",
							context: "contextMenus.task.organization.notices.noEligibleSubtasks",
						})
					),
				});
				return;
			}

			openTaskSelector(plugin, candidates, (subtask) => {
				if (!subtask) return;
				void this.assignTaskAsSubtask(task, plugin, subtask);
			});
		} catch (error) {
			tasknotesLogger.error("Failed to open subtask assignment selector:", {
				category: "persistence",
				operation: "open-subtask-assignment-selector",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to open subtask selector",
						context: "contextMenus.task.organization.notices.subtaskSelectFailed",
					})
				),
			});
		}
	}

	async addTaskToProject(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		projectFile: TAbstractFile
	): Promise<void> {
		try {
			if (!(projectFile instanceof TFile)) {
				showToast({
					message: this.t(
						msg({
							message: "Failed to open project selector",
							context: "contextMenus.task.organization.notices.projectSelectFailed",
						})
					),
				});
				return;
			}

			const updatedTask = await addTaskToProject(
				plugin,
				task,
				projectFile,
				updateTaskProjectsWithUndo(plugin),
				(message) => {
					showToast({ message });
				}
			);
			if (updatedTask) {
				Object.assign(task, updatedTask);
				this.options.onUpdate?.();
			}
		} catch (error) {
			tasknotesLogger.error("Failed to add task to project:", {
				category: "persistence",
				operation: "add-task-project",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to add task to project",
						context: "contextMenus.task.organization.notices.addToProjectFailed",
					})
				),
			});
		}
	}

	async assignTaskAsSubtask(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		subtask: TaskInfo
	): Promise<void> {
		try {
			const currentTaskFile = plugin.app.vault.getAbstractFileByPath(task.path);
			if (!(currentTaskFile instanceof TFile)) {
				showToast({
					message: this.t(
						msg({
							message: "Current task file not found",
							context: "contextMenus.task.organization.notices.currentTaskNotFound",
						})
					),
				});
				return;
			}

			const updatedSubtask = await assignTaskAsSubtask(
				plugin,
				currentTaskFile,
				subtask,
				updateTaskProjectsWithUndo(plugin),
				(message) => {
					showToast({ message });
				}
			);
			if (updatedSubtask) {
				Object.assign(subtask, updatedSubtask);
				this.options.onUpdate?.();
			}
		} catch (error) {
			tasknotesLogger.error("Failed to assign task as subtask:", {
				category: "persistence",
				operation: "assign-task-as-subtask",
				error: error,
			});
			showToast({
				message: this.t(
					msg({
						message: "Failed to add task as subtask",
						context: "contextMenus.task.organization.notices.addAsSubtaskFailed",
					})
				),
			});
		}
	}

	buildProjectReference(targetFile: TFile, sourcePath: string, plugin: TaskNotesPlugin): string {
		return generateLink(
			plugin.app,
			targetFile,
			sourcePath,
			"",
			"",
			plugin.settings.useFrontmatterMarkdownLinks
		);
	}
}
