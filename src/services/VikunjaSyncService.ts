
import { TFile, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { VikunjaService } from "./VikunjaService";
import { TaskInfo, EVENT_TASK_UPDATED } from "../types";

export class VikunjaSyncService {
    plugin: TaskNotesPlugin;
    vikunjaService: VikunjaService;
    private syncIntervalId: number | null = null;
    private isSyncing = false;

    constructor(plugin: TaskNotesPlugin, vikunjaService: VikunjaService) {
        this.plugin = plugin;
        this.vikunjaService = vikunjaService;
    }

    initialize() {
        // Register event listener for task updates (Push)
        this.plugin.registerEvent(
            this.plugin.emitter.on(EVENT_TASK_UPDATED, this.onTaskUpdated.bind(this))
        );

        // Start polling if enabled
        this.updateSyncInterval();
    }

    updateSyncInterval() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }

        if (this.plugin.settings.vikunja.enabled && this.plugin.settings.vikunja.enableTwoWaySync) {
            const intervalMs = this.plugin.settings.vikunja.syncInterval * 60 * 1000;
            this.syncIntervalId = window.setInterval(() => {
                this.syncFromVikunja();
            }, intervalMs);
            console.log(`Vikunja Sync: Polling started every ${this.plugin.settings.vikunja.syncInterval} minutes.`);
        }
    }

    private async onTaskUpdated(data: { path: string; updatedTask?: TaskInfo; originalTask?: TaskInfo }) {
        if (!this.plugin.settings.vikunja.enabled) return;

        const { path, updatedTask } = data;
        if (!updatedTask) return; // Task deleted, handle separately if needed

        // Check if we should sync this task
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return;

        const cache = this.plugin.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;

        if (frontmatter?.vikunja_ignore) return;

        try {
            const vikunjaId = frontmatter?.vikunja_id;
            console.log(`Vikunja Sync: Processing ${path}. ID in frontmatter: ${vikunjaId}`);

            if (vikunjaId) {
                // Update existing task
                const isCompleted = updatedTask.status === "done";
                const shouldSyncUpdate = this.plugin.settings.vikunja.syncOnTaskUpdate;
                const shouldSyncComplete = this.plugin.settings.vikunja.syncOnTaskComplete && isCompleted;

                if (shouldSyncUpdate || shouldSyncComplete) {
                    await this.updateVikunjaTask(vikunjaId, updatedTask);
                }
            } else {
                // Create new task
                if (this.plugin.settings.vikunja.syncOnTaskCreate) {
                    await this.createVikunjaTask(updatedTask);
                }
            }
        } catch (error) {
            console.error(`Vikunja Sync Error for ${path}:`, error);
        }
    }

    private async createVikunjaTask(task: TaskInfo) {
        if (!this.plugin.settings.vikunja.defaultListId) {
            console.warn("Vikunja Sync: No default list ID set.");
            return;
        }

        const payload = this.mapTaskToPayload(task);
        const response = await this.vikunjaService.createTask(this.plugin.settings.vikunja.defaultListId, payload);

        if (response && response.id) {
            console.log(`Vikunja Sync: Created task ${response.id} for ${task.title}`);
            await this.saveVikunjaId(task.path, response.id);
            new Notice(`Task created in Vikunja: ${task.title}`);
        } else {
            console.warn("Vikunja Sync: Task creation response missing ID:", response);
        }
    }

    private async updateVikunjaTask(vikunjaId: number, task: TaskInfo) {
        const payload = this.mapTaskToPayload(task);
        await this.vikunjaService.updateTask(vikunjaId, payload);
    }

    private mapTaskToPayload(task: TaskInfo): any {
        return {
            title: task.title,
            description: task.details || "", // Assuming content is body
            done: task.status === "done",
            // Add other fields mapping here (priority, due_date, etc.)
        };
    }

    private async saveVikunjaId(path: string, id: number) {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter["vikunja_id"] = id;
                frontmatter["vikunja_last_sync"] = Date.now();
            });
        }
    }

    async syncFromVikunja() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        console.log("Vikunja Sync: Starting pull...");

        try {
            // Basic implementation: fetch recent tasks
            // In a real scenario, we'd use filter_by=updated and filter_value > lastSync
            // For now, let's just fetch default list tasks to demonstrate structure
            if (!this.plugin.settings.vikunja.defaultListId) return;

            const tasks = await this.vikunjaService.getTasks(this.plugin.settings.vikunja.defaultListId, {
                sort_by: ["updated"],
                order_by: ["desc"],
                page: 1
            });

            console.log(`Vikunja Sync: Fetched ${Array.isArray(tasks) ? tasks.length : 0} tasks.`);

            if (Array.isArray(tasks)) {
                for (const vTask of tasks) {
                    await this.processRemoteTask(vTask);
                }
            } else {
                console.warn("Vikunja Sync: getTasks returned non-array:", tasks);
            }

        } catch (error) {
            console.error("Vikunja Pull Error:", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async processRemoteTask(vTask: any) {
        // 1. Find local task with this vikunja_id
        const localTask = await this.findTaskByVikunjaId(vTask.id);

        if (localTask) {
            // 2. Compare and update if remote is newer
            // Simplification: Always update local from remote in this polling cycle
            // In reality, check timestamps
            await this.updateLocalTask(localTask, vTask);
        } else {
            // 3. Create local task if configured to import
            if (this.plugin.settings.vikunja.enableTwoWaySync) {
                await this.createLocalTaskFromVikunja(vTask);
            }
        }
    }

    private async createLocalTaskFromVikunja(vTask: any) {
        try {
            // Avoid loop: ignore if we just pushed this
            // But we don't have a reliable way to know "we just pushed it" without complex state using current ID.
            // For now, relies on vikunja_id check prevention.

            const taskData: any = {
                title: vTask.title,
                status: vTask.done ? "done" : "open",
                details: vTask.description,
                priority: "normal", // Default, or map from vTask.priority
                customFrontmatter: {
                    vikunja_id: vTask.id,
                    vikunja_last_sync: Date.now()
                }
            };

            await this.plugin.taskService.createTask(taskData);
            console.log(`Vikunja Sync: Created local task for Vikunja ID ${vTask.id}`);
        } catch (error) {
            console.error(`Vikunja Sync: Failed to create local task for ${vTask.id}`, error);
        }
    }

    private async findTaskByVikunjaId(id: number): Promise<TFile | null> {
        // Inefficient search for now, would need an index map in production
        const files = this.plugin.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.plugin.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.vikunja_id === id) {
                return file;
            }
        }
        return null;
    }

    private async updateLocalTask(file: TFile, vTask: any) {
        await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
            // Only update if changes
            if (frontmatter["title"] !== vTask.title) frontmatter["title"] = vTask.title;
            // Update status
            // Mapping 'done' to status 'done' or 'open'
            const newStatus = vTask.done ? "done" : "open";
            if (frontmatter["status"] !== newStatus) frontmatter["status"] = newStatus;

            frontmatter["vikunja_last_sync"] = Date.now();
        });
        // If description changed, we'd need to update file body, which is more complex (read, replace, write)
    }

    unload() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
    }
}
