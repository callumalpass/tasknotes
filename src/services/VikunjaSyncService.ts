
import { TFile, Notice } from "obsidian";
import { format, parseISO, addSeconds } from "date-fns";
import TaskNotesPlugin from "../main";
import { VikunjaService } from "./VikunjaService";
import { TaskInfo, EVENT_TASK_UPDATED, Reminder } from "../types";
import TurndownService from "turndown";
import showdown from "showdown";
import { parseLinkToPath } from "../utils/linkUtils";

export class VikunjaSyncService {
    plugin: TaskNotesPlugin;
    vikunjaService: VikunjaService;
    private syncIntervalId: number | null = null;
    private isSyncing = false;
    private turndownService: TurndownService;
    private showdownConverter: showdown.Converter;
    private isInternalUpdate = false;
    private debouncedPush = new Map<string, number>();

    constructor(plugin: TaskNotesPlugin, vikunjaService: VikunjaService) {
        this.plugin = plugin;
        this.vikunjaService = vikunjaService;
        this.turndownService = new TurndownService({
            headingStyle: "atx",
            hr: "---",
            bulletListMarker: "-",
            codeBlockStyle: "fenced",
        });
        this.showdownConverter = new showdown.Converter();
        this.turndownService.addRule('github-task-list', {
            filter: 'li',
            replacement: function (content, node) {
                const item = node as HTMLLIElement;
                if (item.classList.contains('task-list-item') || (item.querySelector('input[type="checkbox"]'))) {
                    const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
                    const checked = checkbox && checkbox.checked ? 'x' : ' ';
                    return '- [' + checked + '] ' + content + '\n';
                }
                return '- ' + content + '\n';
            }
        });
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
        if (!priority) return 0; // Unset in Vikunja
        switch (priority.toLowerCase()) {
            case "low": return 1;
            case "normal": return 2;
            case "medium": return 2; // Alias for normal
            case "high": return 4;
            case "critical": return 5;
            default: return 0; // Unset for unknown values
        }
    }

    private fromVikunjaPriority(priority?: number): string {
        if (priority === undefined || priority === null || priority === 0) return ""; // Unset
        if (priority <= 1) return "low";
        if (priority === 2) return "normal";
        if (priority >= 3) return "high"; // Map 3, 4, 5 to high for simplicity
        return "";
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

        // Register vault modify listener for manual edits
        this.plugin.registerEvent(
            this.plugin.app.vault.on("modify", (file) => {
                if (file instanceof TFile && file.extension === "md") {
                    this.handleFileModification(file);
                }
            })
        );

        // Start polling if enabled
        this.updateSyncInterval();
    }

    private handleFileModification(file: TFile) {
        if (this.isInternalUpdate) return;

        // Debounce
        if (this.debouncedPush.has(file.path)) {
            window.clearTimeout(this.debouncedPush.get(file.path));
        }

        const timeoutId = window.setTimeout(async () => {
            // Fetch fresh task info
            // Construct a partial TaskInfo or trigger onTaskUpdated logic
            // Since onTaskUpdated handles reading the file, we can just call it passing the path
            // But onTaskUpdated expects {path, updatedTask}
            // We can construct a minimal updatedTask to trigger the flow

            // We need to verify if it's a monitored task
            const cache = this.plugin.app.metadataCache.getFileCache(file);
            if (!cache?.frontmatter?.vikunja_id) return;

            // Mimic TaskInfo structure - we only really need path and status for current logic, 
            // but onTaskUpdated re-reads the file body anyway.
            // We need 'status' to determine if we should sync based on settings (syncOnComplete).
            // Let's rely on cache frontmatter for status.
            const status = cache.frontmatter.status || "open";

            const dummyTaskInfo: TaskInfo = {
                path: file.path,
                title: cache.frontmatter.title || file.basename,
                status: status,
                priority: cache.frontmatter.priority,
                // Add other required fields
                due: cache.frontmatter.due,
                scheduled: cache.frontmatter.scheduled,
                recurrence: cache.frontmatter.recurrence,
                tags: cache.frontmatter.tags,
                projects: cache.frontmatter.projects,
                reminders: cache.frontmatter.reminders,
            } as any;

            await this.onTaskUpdated({ path: file.path, updatedTask: dummyTaskInfo });

            this.debouncedPush.delete(file.path);
        }, 2000); // 2 second debounce for typing

        this.debouncedPush.set(file.path, timeoutId);
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
            // Read actual file body for description
            const content = await this.plugin.app.vault.read(file);
            const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
            const body = content.replace(frontmatterRegex, "").trim();

            // Update task info with actual body
            updatedTask.details = body;

            const vikunjaId = frontmatter?.vikunja_id;

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
            if (task.tags && task.tags.length > 0) {
                await this.syncTagsToVikunja(response.id, task.tags);
            }
            // Sync parent relation
            await this.syncParentRelation(response.id, task);
            new Notice(`Task created in Vikunja: ${task.title}`);
        } else {
            console.warn("Vikunja Sync: Task creation response missing ID:", response);
        }
    }

    private async updateVikunjaTask(vikunjaId: number, task: TaskInfo) {
        const payload = this.mapTaskToPayload(task);
        await this.vikunjaService.updateTask(vikunjaId, payload);
        if (task.tags) {
            await this.syncTagsToVikunja(vikunjaId, task.tags);
        }
        // Sync parent relation
        await this.syncParentRelation(vikunjaId, task);
    }

    private mapTaskToPayload(task: TaskInfo): any {
        const payload: any = {
            title: task.title,
            description: task.details ? this.showdownConverter.makeHtml(task.details) : "",
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

        // Parent/Subtask Sync is handled separately via relations API

        return payload;
    }

    // Creates/updates parent relation in Vikunja for subtask sync
    private async syncParentRelation(vikunjaId: number, task: TaskInfo) {
        const parentVikunjaId = this.getParentVikunjaId(task);
        if (parentVikunjaId) {
            try {
                // Create a "parenttask" relation: the parent is the parenttask OF this current task
                await this.vikunjaService.createTaskRelation(vikunjaId, parentVikunjaId, "parenttask");
                console.log(`Vikunja Sync: Created parenttask relation: ${vikunjaId} -> parent ${parentVikunjaId}`);
            } catch (error: any) {
                // Ignore "already exists" errors
                if (!error.message?.includes("exists")) {
                    console.error(`Vikunja Sync: Error creating parent relation for ${vikunjaId}`, error);
                }
            }
        }
    }

    private getParentVikunjaId(task: TaskInfo): number | null {
        console.log(`Vikunja Sync: Checking parent for task '${task.title}'`);
        // Check 'projects' field
        if (task.projects && task.projects.length > 0) {
            // Use first project that has a Vikunja ID
            for (const projectLink of task.projects) {
                // Resolve link
                const linkPath = parseLinkToPath(projectLink);
                // Resolve to file
                const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, task.path);
                if (file) {
                    const cache = this.plugin.app.metadataCache.getFileCache(file);
                    if (cache?.frontmatter?.vikunja_id) {
                        return cache.frontmatter.vikunja_id;
                    }
                }
            }
        }
        return null;
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
                // PASS 1: Create/update all tasks WITHOUT parent relations
                // This ensures all files exist before we try to link them
                const tasksNeedingParentUpdate: any[] = [];

                for (const vTask of tasks) {
                    const needsParentUpdate = await this.processRemoteTask(vTask, false);
                    if (needsParentUpdate) {
                        tasksNeedingParentUpdate.push(vTask);
                    }
                }

                // PASS 2: Update parent relations now that all files exist
                for (const vTask of tasksNeedingParentUpdate) {
                    await this.updateParentRelationOnly(vTask);
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

    // Update just the projects field for a task that has a parent
    private async updateParentRelationOnly(vTask: any) {
        const localFile = await this.findTaskByVikunjaId(vTask.id);
        if (!localFile) return;

        const projects = await this.fromVikunjaParent(vTask);
        if (!projects || projects.length === 0) return;

        this.isInternalUpdate = true;
        try {
            await this.plugin.app.fileManager.processFrontMatter(localFile, (frontmatter) => {
                if (JSON.stringify(frontmatter["projects"]) !== JSON.stringify(projects)) {
                    frontmatter["projects"] = projects;
                    console.log(`Vikunja Sync: Updated parent relation for ${localFile.path} -> ${projects}`);
                }
            });
        } finally {
            setTimeout(() => { this.isInternalUpdate = false; }, 100);
        }
    }

    private async processRemoteTask(vTask: any, skipParentUpdate: boolean = false): Promise<boolean> {
        // 1. Find local task with this vikunja_id
        const localTask = await this.findTaskByVikunjaId(vTask.id);

        // Check if this task has a parent
        const hasParent = vTask?.related_tasks?.parenttask?.length > 0;

        if (localTask) {
            // 2. Compare and update if remote is newer
            // Simplification: Always update local from remote in this polling cycle
            // In reality, check timestamps
            await this.updateLocalTask(localTask, vTask, skipParentUpdate);
        } else {
            // 3. Create local task if configured to import
            if (this.plugin.settings.vikunja.enableTwoWaySync) {
                await this.createLocalTaskFromVikunja(vTask, skipParentUpdate);
            }
        }

        // Return true if this task has a parent and we skipped the update
        return hasParent && skipParentUpdate;
    }

    private async createLocalTaskFromVikunja(vTask: any, skipParentUpdate: boolean = false) {
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
                tags: this.fromVikunjaLabels(vTask.labels),
                // Skip projects in first pass, will be updated in second pass
                projects: skipParentUpdate ? undefined : await this.fromVikunjaParent(vTask),
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

    private async updateLocalTask(file: TFile, vTask: any, skipParentUpdate: boolean = false) {
        this.isInternalUpdate = true;
        try {
            // Prepare projects (async) before modifying frontmatter - skip if in first pass
            const newProjects = skipParentUpdate ? undefined : await this.fromVikunjaParent(vTask);

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

                // Tags sync
                const newTags = this.fromVikunjaLabels(vTask.labels);
                // Sort to ensure order doesn't cause false changes
                const oldTags = frontmatter["tags"] ? [...frontmatter["tags"]].sort() : [];
                const sortedNewTags = newTags ? [...newTags].sort() : [];
                if (JSON.stringify(oldTags) !== JSON.stringify(sortedNewTags)) {
                    if (newTags && newTags.length > 0) frontmatter["tags"] = newTags;
                    else delete frontmatter["tags"];
                }

                // Projects (Parent) Sync
                // const newProjects = await this.fromVikunjaParent(vTask.parent_task_id); // MOVED OUT
                if (newProjects && newProjects.length > 0) {
                    // Check if changed
                    if (JSON.stringify(frontmatter["projects"]) !== JSON.stringify(newProjects)) {
                        frontmatter["projects"] = newProjects;
                    }
                } else {
                    // Do not delete existing projects if Vikunja has no parent, 
                    // to prevent overwriting local organization unless explicit.
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

            // Update body (description)
            if (vTask.description !== undefined) {
                const markdownBody = this.turndownService.turndown(vTask.description);
                await this.updateFileBody(file, markdownBody);
            }
        } finally {
            this.isInternalUpdate = false;
        }
    }

    private async updateFileBody(file: TFile, newBody: string) {
        try {
            const content = await this.plugin.app.vault.read(file);
            const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
            const match = content.match(frontmatterRegex);

            const currentFrontmatter = match ? match[0] : "";
            const currentBody = match ? content.replace(frontmatterRegex, "") : content;

            // Normalize newlines / trim for comparison
            if (currentBody.trim() !== newBody.trim()) {
                console.log(`Vikunja Sync: Updating description/body for ${file.path}`);
                const newContent = currentFrontmatter + newBody;

                this.isInternalUpdate = true;
                await this.plugin.app.vault.modify(file, newContent);
                // isInternalUpdate will be reset in updateLocalTask finally block if called from there.
                // But updateFileBody is async and awaited. 
                // We should ensure it's handled here too just in case it's called independently.
                // However, updateLocalTask wraps this.
                // If called independently, we might need own try/finally but updateLocalTask has it.
            }
        } catch (e) {
            console.error(`Vikunja Sync: Error updating file body for ${file.path}`, e);
        }
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

    private fromVikunjaLabels(vLabels?: any[]): string[] | undefined {
        if (!vLabels || !Array.isArray(vLabels) || vLabels.length === 0) return undefined;
        return vLabels.map(l => l.title);
    }

    private async syncTagsToVikunja(vikunjaId: number, tags: string[]) {
        try {
            console.log(`Vikunja Sync: Syncing tags for task ${vikunjaId}:`, tags);
            // 1. Get all available labels
            const allLabels = await this.vikunjaService.getLabels(1, 1000); // Fetch up to 1000 labels
            let labelList = Array.isArray(allLabels) ? allLabels : [];
            // If API returns { labels: [...] } or pages, handle that:
            // Assuming flat array or we need to inspect. Vikunja usually returns array.

            const labelsToSet: any[] = [];

            for (const tag of tags) {
                let label = labelList.find((l: any) => l.title === tag);
                if (!label) {
                    // Create if not exists
                    try {
                        console.log(`Vikunja Sync: Creating label '${tag}'`);
                        label = await this.vikunjaService.createLabel({ title: tag });
                        // Add to local list to avoid re-creating in this loop (if duplicates in tags)
                        labelList.push(label);
                    } catch (e) {
                        console.error(`Vikunja Sync: Failed to create label ${tag}`, e);
                        continue;
                    }
                }
                if (label) {
                    labelsToSet.push(label);
                }
            }

            // 2. Bulk update labels on task
            // This replaces existing labels with the new set
            await this.vikunjaService.updateTaskLabels(vikunjaId, labelsToSet);
            console.log(`Vikunja Sync: Updated labels for task ${vikunjaId}`);
        } catch (error) {
            console.error(`Vikunja Sync: Error syncing tags for task ${vikunjaId}`, error);
        }
    }

    private async fromVikunjaParent(vTask: any): Promise<string[] | undefined> {
        // Get parent from related_tasks.parenttask
        console.log(`Vikunja Sync: Task ${vTask.id} ('${vTask.title}') related_tasks:`, JSON.stringify(vTask?.related_tasks));
        const parentTasks = vTask?.related_tasks?.parenttask;
        const parentId = parentTasks && parentTasks.length > 0 ? parentTasks[0]?.id : undefined;

        console.log(`Vikunja Sync: Resolving parent for ID: ${parentId}`);
        if (!parentId || parentId === 0) return undefined;

        const parentFile = await this.findTaskByVikunjaId(parentId);
        if (parentFile) {
            console.log(`Vikunja Sync: Found parent file '${parentFile.path}' for Vikunja ID ${parentId}`);
            // Create a wikilink to the file
            return [`[[${parentFile.basename}]]`];
        } else {
            console.log(`Vikunja Sync: Parent file not found for Vikunja ID ${parentId}`);
        }
        return undefined;
    }

    unload() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
    }
}
