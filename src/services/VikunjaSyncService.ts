
import { TFile, Notice } from "obsidian";
import { format, parseISO, addSeconds } from "date-fns";
import TaskNotesPlugin from "../main";
import { VikunjaService } from "./VikunjaService";
import { TaskInfo, EVENT_TASK_UPDATED, Reminder } from "../types";

export class VikunjaSyncService {
    plugin: TaskNotesPlugin;
    vikunjaService: VikunjaService;
    private syncIntervalId: number | null = null;
    private isSyncing = false;

    constructor(plugin: TaskNotesPlugin, vikunjaService: VikunjaService) {
        this.plugin = plugin;
        this.vikunjaService = vikunjaService;
    }

    // --- Helpers ---

    private toVikunjaDate(dateStr?: string): string | null {
        if (!dateStr) return null;
        try {
            // Tasknotes stores YYYY-MM-DD. Vikunja needs ISO with time.
            const date = parseISO(dateStr);
            // Set to noon or specific time? Vikunja might accept date-only or 00:00.
            // Using T12:00:00 to avoid timezone shifts making it previous day.
            return format(date, "yyyy-MM-dd'T'12:00:00xxx");
        } catch (e) {
            console.error("Vikunja Sync: Date parse error", e);
            return null;
        }
    }

    private fromVikunjaDate(isoStr?: string): string | undefined {
        if (!isoStr) return undefined;
        // Vikunja might return "0001-01-01T00:00:00Z" for empty dates
        if (isoStr.startsWith("0001-") || isoStr.startsWith("0000-")) return undefined;
        try {
            return format(parseISO(isoStr), "yyyy-MM-dd");
        } catch (e) {
            return undefined;
        }
    }

    private toVikunjaPriority(priority?: string): number {
        switch (priority?.toLowerCase()) {
            case "low": return 1;
            case "normal": return 2;
            case "high": return 4; // Vikunja 3=High? 4=Urgent? Usually 1-5. Assumed: 1=Low, 2=Normal, 3=High, 4=Urgent, 5=Do Now
            case "critical": return 5;
            default: return 2;
        }
    }

    private fromVikunjaPriority(priority?: number): string {
        if (!priority) return "normal";
        if (priority <= 1) return "low";
        if (priority === 2) return "normal";
        if (priority >= 3) return "high"; // Map 3, 4, 5 to high for simplicity or critical?
        return "normal";
    }

    private toVikunjaRecurrence(recurrence?: string): number | null {
        if (!recurrence) return null;
        // Simple mapping from RFC string to seconds
        if (recurrence.includes("FREQ=DAILY")) return 86400;
        if (recurrence.includes("FREQ=WEEKLY")) return 604800;
        if (recurrence.includes("FREQ=MONTHLY")) return 2592000; // Approx 30 days
        if (recurrence.includes("FREQ=YEARLY")) return 31536000;
        return null;
    }

    private fromVikunjaRecurrence(seconds?: number): string | undefined {
        if (!seconds) return undefined;
        if (seconds >= 86000 && seconds <= 90000) return "FREQ=DAILY";
        if (seconds >= 600000 && seconds <= 610000) return "FREQ=WEEKLY";
        if (seconds >= 2400000 && seconds <= 2700000) return "FREQ=MONTHLY";
        if (seconds >= 31000000) return "FREQ=YEARLY";
        return undefined;
    }

    private toVikunjaDateTime(dateStr?: string): string | null {
        if (!dateStr) return null;
        try {
            const date = parseISO(dateStr);
            // Preserve time for reminders
            return format(date, "yyyy-MM-dd'T'HH:mm:ssxxx");
        } catch (e) {
            console.error("Vikunja Sync: Date parse error", e);
            return null;
        }
    }





    // --- End Helpers ---

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
        const payload: any = {
            title: task.title,
            description: task.details || "",
            done: task.status === "done",
            priority: this.toVikunjaPriority(task.priority),
        };

        const dueDate = this.toVikunjaDate(task.due);
        if (dueDate) payload.due_date = dueDate;

        const startDate = this.toVikunjaDate(task.scheduled);
        if (startDate) payload.start_date = startDate;

        const repeatAfter = this.toVikunjaRecurrence(task.recurrence);
        if (repeatAfter) {
            payload.repeat_after = repeatAfter;
            payload.repeat_mode = 0; // 0 = Period (e.g. every 7 days from completion), 1 = Date (e.g. every Monday) - using Period for safety
        }

        const reminders = this.toVikunjaReminders(task.reminders);
        if (reminders) payload.reminders = reminders;

        return payload;
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
                priority: this.fromVikunjaPriority(vTask.priority),
                due: this.fromVikunjaDate(vTask.due_date),
                scheduled: this.fromVikunjaDate(vTask.start_date),
                recurrence: this.fromVikunjaRecurrence(vTask.repeat_after),
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
            // Update status
            const newStatus = vTask.done ? "done" : "open";
            if (frontmatter["status"] !== newStatus) frontmatter["status"] = newStatus;

            // Map other fields
            const newPriority = this.fromVikunjaPriority(vTask.priority);
            if (frontmatter["priority"] !== newPriority) frontmatter["priority"] = newPriority;

            const newDue = this.fromVikunjaDate(vTask.due_date);
            if (frontmatter["due"] !== newDue) {
                if (newDue) frontmatter["due"] = newDue;
                else delete frontmatter["due"];
            }

            const newScheduled = this.fromVikunjaDate(vTask.start_date);
            if (frontmatter["scheduled"] !== newScheduled) {
                if (newScheduled) frontmatter["scheduled"] = newScheduled;
                else delete frontmatter["scheduled"];
            }

            const newRecurrence = this.fromVikunjaRecurrence(vTask.repeat_after);
            if (frontmatter["recurrence"] !== newRecurrence) {
                if (newRecurrence) frontmatter["recurrence"] = newRecurrence;
                else delete frontmatter["recurrence"];
            }

            // Reminders sync
            const newReminders = this.fromVikunjaReminders(vTask.reminders);
            // Simple comparison using JSON stringify to avoid deep object checking complexity
            if (JSON.stringify(frontmatter["reminders"]) !== JSON.stringify(newReminders)) {
                console.log(`Vikunja Sync: Updating reminders for ${file.path}. Old: ${JSON.stringify(frontmatter["reminders"])}, New: ${JSON.stringify(newReminders)}`);
                if (newReminders) frontmatter["reminders"] = newReminders;
                else delete frontmatter["reminders"];
            }

            frontmatter["vikunja_last_sync"] = Date.now();
        });
        // If description changed, we'd need to update file body, which is more complex (read, replace, write)
    }

    // --- Helpers for Duration ---
    private durationToSeconds(isoDuration?: string): number | null {
        if (!isoDuration) return null;
        // Simple regex for PT#M / PT#H / PT#S - simplified coverage
        const matches = isoDuration.match(/PT(\d+)([HMS])/);
        if (!matches) return 0; // Default to 0 if 0M or similar
        const val = parseInt(matches[1]);
        const unit = matches[2];
        if (unit === 'H') return val * 3600;
        if (unit === 'M') return val * 60;
        if (unit === 'S') return val;
        return 0;
    }

    private secondsToDuration(seconds: number): string {
        if (seconds === 0) return "PT0M"; // Standard "at time of"
        // Convert to minutes if divisible, else seconds
        if (seconds % 3600 === 0) return `PT${seconds / 3600}H`;
        if (seconds % 60 === 0) return `PT${seconds / 60}M`;
        return `PT${seconds}S`;
    }

    private toVikunjaReminders(reminders?: Reminder[]): any[] | null {
        if (!reminders || reminders.length === 0) return null;

        console.log("Vikunja Sync: Converting reminders to push:", JSON.stringify(reminders));

        const mapped = reminders.map(r => {
            if (r.type === "absolute" && r.absoluteTime) {
                return { reminder: this.toVikunjaDateTime(r.absoluteTime) };
            } else if (r.type === "relative") {
                const seconds = this.durationToSeconds(r.offset);
                let relTo = "due_date";
                if (r.relatedTo === "scheduled") relTo = "start_date";
                // If seconds is null (parse fail), skip? Or default 0?
                // Vikunja needs reminder set too? No, usually relative_period + relative_to is enough
                return {
                    relative_period: seconds || 0,
                    relative_to: relTo
                };
            }
            return null;
        }).filter(r => r !== null);

        console.log("Vikunja Sync: Mapped reminders payload:", JSON.stringify(mapped));
        return mapped.length > 0 ? mapped : null;
    }

    // ... 

    private fromVikunjaReminders(vReminders?: any[]): Reminder[] | undefined {
        if (!vReminders || !Array.isArray(vReminders) || vReminders.length === 0) return undefined;

        console.log("Vikunja Sync: Processing reminders from remote:", JSON.stringify(vReminders));

        const reminders: Reminder[] = [];
        for (const vr of vReminders) {
            // Generate a stable ID if missing (or use existing)
            // If Vikunja doesn't send ID, use hash of content or random. Use random for now as stability is hard without guaranteed properties.
            const remId = vr.id ? String(vr.id) : `rem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

            // Check if relative
            if (vr.relative_to) {
                let relatedTo: "due" | "scheduled" = "due";
                if (vr.relative_to === "start_date") relatedTo = "scheduled";

                reminders.push({
                    id: remId,
                    type: "relative",
                    relatedTo: relatedTo,
                    offset: this.secondsToDuration(vr.relative_period || 0),
                    description: "Synced from Vikunja"
                });
            }
            // Else Absolute (fallback to absolute logic if reminder date exists)
            else if (vr.reminder) {
                const dateStr = this.fromVikunjaDate(vr.reminder);
                if (dateStr) {
                    const iso = vr.reminder;
                    if (!iso.startsWith("0001") && !iso.startsWith("0000")) {
                        reminders.push({
                            id: remId,
                            type: "absolute",
                            absoluteTime: iso
                        });
                    }
                }
            }
        }
        console.log("Vikunja Sync: Mapped local reminders:", JSON.stringify(reminders));
        return reminders.length > 0 ? reminders : undefined;
    }

    unload() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
    }
}
