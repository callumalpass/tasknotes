import { Menu, Notice, TFile } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo } from '../types';
import { formatDateForStorage } from '../utils/dateUtils';
import { ReminderModal } from '../modals/ReminderModal';
import { CalendarExportService } from '../services/CalendarExportService';
import { showConfirmationModal } from '../modals/ConfirmationModal';
import { showTextInputModal } from '../modals/TextInputModal';

export interface TaskContextMenuOptions {
    task: TaskInfo;
    plugin: TaskNotesPlugin;
    targetDate: Date;
    onUpdate?: () => void;
}

export class TaskContextMenu {
    private menu: Menu;
    private options: TaskContextMenuOptions;

    constructor(options: TaskContextMenuOptions) {
        this.menu = new Menu();
        this.options = options;
        this.buildMenu();
    }

    private buildMenu(): void {
        const { task, plugin } = this.options;

        // Status options
        const availableStatuses = task.recurrence 
            ? plugin.statusManager.getNonCompletionStatuses()
            : plugin.statusManager.getAllStatuses();
        
        availableStatuses.forEach(statusConfig => {
            this.menu.addItem((item) => {
                const isSelected = task.status === statusConfig.value;
                item.setTitle(`${statusConfig.label}`);
                item.setIcon('circle');
                if (isSelected) {
                    item.setIcon('check');
                }
                item.onClick(async () => {
                    try {
                        await plugin.updateTaskProperty(task, 'status', statusConfig.value);
                        this.options.onUpdate?.();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error('Error updating task status:', {
                            error: errorMessage,
                            taskPath: task.path
                        });
                        new Notice(`Failed to update task status: ${errorMessage}`);
                    }
                });
            });
        });
        
        // Add completion toggle for recurring tasks
        if (task.recurrence) {
            this.menu.addSeparator();
            
            const dateStr = formatDateForStorage(this.options.targetDate);
            const isCompletedForDate = task.complete_instances?.includes(dateStr) || false;
            
            this.menu.addItem((item) => {
                item.setTitle(isCompletedForDate ? 'Mark incomplete for this date' : 'Mark complete for this date');
                item.setIcon(isCompletedForDate ? 'x' : 'check');
                item.onClick(async () => {
                    try {
                        await plugin.toggleRecurringTaskComplete(task, this.options.targetDate);
                        this.options.onUpdate?.();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error('Error toggling recurring task completion:', {
                            error: errorMessage,
                            taskPath: task.path
                        });
                        new Notice(`Failed to toggle recurring task completion: ${errorMessage}`);
                    }
                });
            });
        }
        
        this.menu.addSeparator();
        
        // Priority options
        plugin.priorityManager.getPrioritiesByWeight().forEach(priorityConfig => {
            this.menu.addItem((item) => {
                const isSelected = task.priority === priorityConfig.value;
                item.setTitle(`Priority: ${priorityConfig.label}`);
                item.setIcon('flag');
                if (isSelected) {
                    item.setIcon('check');
                }
                item.onClick(async () => {
                    try {
                        await plugin.updateTaskProperty(task, 'priority', priorityConfig.value);
                        this.options.onUpdate?.();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error('Error updating task priority:', {
                            error: errorMessage,
                            taskPath: task.path
                        });
                        new Notice(`Failed to update task priority: ${errorMessage}`);
                    }
                });
            });
        });
        
        this.menu.addSeparator();
        
        // Set Due Date
        this.menu.addItem((item) => {
            item.setTitle('Set due date...');
            item.setIcon('calendar');
            item.onClick(() => {
                plugin.openDueDateModal(task);
            });
        });
        
        // Set Scheduled Date
        this.menu.addItem((item) => {
            item.setTitle('Set scheduled date...');
            item.setIcon('calendar-clock');
            item.onClick(() => {
                plugin.openScheduledDateModal(task);
            });
        });
        
        // Manage Reminders
        this.menu.addItem((item) => {
            item.setTitle('Manage reminders...');
            item.setIcon('bell');
            item.onClick(() => {
                const modal = new ReminderModal(
                    plugin.app,
                    plugin,
                    task,
                    async (reminders) => {
                        try {
                            await plugin.updateTaskProperty(task, 'reminders', reminders.length > 0 ? reminders : undefined);
                            this.options.onUpdate?.();
                        } catch (error) {
                            console.error('Error updating reminders:', error);
                            new Notice('Failed to update reminders');
                        }
                    }
                );
                modal.open();
            });
        });
        
        this.menu.addSeparator();
        
        // Time Tracking
        this.menu.addItem((item) => {
            const activeSession = plugin.getActiveTimeSession(task);
            item.setTitle(activeSession ? 'Stop time tracking' : 'Start time tracking');
            item.setIcon(activeSession ? 'pause' : 'play');
            item.onClick(async () => {
                const activeSession = plugin.getActiveTimeSession(task);
                if (activeSession) {
                    await plugin.stopTimeTracking(task);
                } else {
                    await plugin.startTimeTracking(task);
                }
                this.options.onUpdate?.();
            });
        });
        
        // Archive/Unarchive
        this.menu.addItem((item) => {
            item.setTitle(task.archived ? 'Unarchive' : 'Archive');
            item.setIcon(task.archived ? 'archive-restore' : 'archive');
            item.onClick(async () => {
                try {
                    await plugin.toggleTaskArchive(task);
                    this.options.onUpdate?.();
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Error toggling task archive:', {
                        error: errorMessage,
                        taskPath: task.path
                    });
                    new Notice(`Failed to toggle task archive: ${errorMessage}`);
                }
            });
        });
        
        this.menu.addSeparator();
        
        // Open Note
        this.menu.addItem((item) => {
            item.setTitle('Open note');
            item.setIcon('file-text');
            item.onClick(() => {
                const file = plugin.app.vault.getAbstractFileByPath(task.path);
                if (file instanceof TFile) {
                    plugin.app.workspace.getLeaf(false).openFile(file);
                }
            });
        });

        // Copy Task Title
        this.menu.addItem((item) => {
            item.setTitle('Copy task title');
            item.setIcon('copy');
            item.onClick(async () => {
                try {
                    await navigator.clipboard.writeText(task.title);
                    new Notice('Task title copied to clipboard');
                } catch (error) {
                    new Notice('Failed to copy to clipboard');
                }
            });
        });

        // Note actions submenu
        this.menu.addItem((item) => {
            item.setTitle('Note actions');
            item.setIcon('file-text');
            
            const submenu = (item as any).setSubmenu();
            
            // Get the file for the task
            const file = plugin.app.vault.getAbstractFileByPath(task.path);
            if (file instanceof TFile) {
                // Try to populate with Obsidian's native file menu
                try {
                    // Trigger the file-menu event to populate with default actions
                    plugin.app.workspace.trigger('file-menu', submenu, file, 'file-explorer');
                } catch (error) {
                    console.debug('Native file menu not available, using fallback');
                }
                
                // Add common file actions (these will either supplement or replace the native menu)
                submenu.addItem((subItem: any) => {
                    subItem.setTitle('Rename');
                    subItem.setIcon('pencil');
                    subItem.onClick(async () => {
                        try {
                            // Modal-based rename
                            const currentName = file.basename;
                            const newName = await showTextInputModal(plugin.app, {
                                title: 'Rename File',
                                placeholder: 'Enter new name',
                                initialValue: currentName
                            });
                            
                            if (newName && newName.trim() !== '' && newName !== currentName) {
                                // Ensure the new name has the correct extension
                                const extension = file.extension;
                                const finalName = newName.endsWith(`.${extension}`) ? newName : `${newName}.${extension}`;
                                
                                // Construct the new path
                                const newPath = file.parent ? `${file.parent.path}/${finalName}` : finalName;
                                
                                // Rename the file
                                await plugin.app.vault.rename(file, newPath);
                                new Notice(`Renamed to "${finalName}"`);
                                
                                // Trigger update callback
                                if (this.options.onUpdate) {
                                    this.options.onUpdate();
                                }
                            }
                        } catch (error) {
                            console.error('Error renaming file:', error);
                            new Notice('Failed to rename file');
                        }
                    });
                });
                
                submenu.addItem((subItem: any) => {
                    subItem.setTitle('Delete');
                    subItem.setIcon('trash');
                    subItem.onClick(async () => {
                        // Show confirmation and delete
                        const confirmed = await showConfirmationModal(plugin.app, {
                            title: 'Delete File',
                            message: `Are you sure you want to delete "${file.name}"?`,
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                            isDestructive: true
                        });
                        if (confirmed) {
                            plugin.app.vault.trash(file, true);
                        }
                    });
                });
                
                submenu.addSeparator();
                
                submenu.addItem((subItem: any) => {
                    subItem.setTitle('Copy path');
                    subItem.setIcon('copy');
                    subItem.onClick(async () => {
                        try {
                            await navigator.clipboard.writeText(file.path);
                            new Notice('File path copied to clipboard');
                        } catch (error) {
                            new Notice('Failed to copy file path');
                        }
                    });
                });
                
                submenu.addItem((subItem: any) => {
                    subItem.setTitle('Copy Obsidian URL');
                    subItem.setIcon('link');
                    subItem.onClick(async () => {
                        try {
                            const url = `obsidian://open?vault=${encodeURIComponent(plugin.app.vault.getName())}&file=${encodeURIComponent(file.path)}`;
                            await navigator.clipboard.writeText(url);
                            new Notice('Obsidian URL copied to clipboard');
                        } catch (error) {
                            new Notice('Failed to copy Obsidian URL');
                        }
                    });
                });
                
                submenu.addSeparator();
                
                submenu.addItem((subItem: any) => {
                    subItem.setTitle('Show in file explorer');
                    subItem.setIcon('folder-open');
                    subItem.onClick(() => {
                        // Reveal file in file explorer
                        plugin.app.workspace.getLeaf().setViewState({
                            type: 'file-explorer',
                            state: {}
                        }).then(() => {
                            // Focus the file in the explorer
                            const fileExplorer = plugin.app.workspace.getLeavesOfType('file-explorer')[0];
                            if (fileExplorer?.view && 'revealInFolder' in fileExplorer.view) {
                                (fileExplorer.view as any).revealInFolder(file);
                            }
                        });
                    });
                });
            }
        });
        
        this.menu.addSeparator();
        
        // Add to Calendar submenu
        this.menu.addItem((item) => {
            item.setTitle('Add to calendar');
            item.setIcon('calendar-plus');
            
            const submenu = (item as any).setSubmenu();
            
            // Google Calendar
            submenu.addItem((subItem: any) => {
                subItem.setTitle('Google Calendar');
                subItem.setIcon('external-link');
                subItem.onClick(() => {
                    CalendarExportService.openCalendarURL({
                        type: 'google',
                        task: task,
                        useScheduledAsDue: true
                    });
                });
            });
            
            // Outlook Calendar
            submenu.addItem((subItem: any) => {
                subItem.setTitle('Outlook Calendar');
                subItem.setIcon('external-link');
                subItem.onClick(() => {
                    CalendarExportService.openCalendarURL({
                        type: 'outlook',
                        task: task,
                        useScheduledAsDue: true
                    });
                });
            });
            
            // Yahoo Calendar
            submenu.addItem((subItem: any) => {
                subItem.setTitle('Yahoo Calendar');
                subItem.setIcon('external-link');
                subItem.onClick(() => {
                    CalendarExportService.openCalendarURL({
                        type: 'yahoo',
                        task: task,
                        useScheduledAsDue: true
                    });
                });
            });
            
            submenu.addSeparator();
            
            // Download ICS file
            submenu.addItem((subItem: any) => {
                subItem.setTitle('Download .ics file');
                subItem.setIcon('download');
                subItem.onClick(() => {
                    CalendarExportService.downloadICSFile(task);
                });
            });
        });
        
        this.menu.addSeparator();
        
        // Create subtask
        this.menu.addItem((item) => {
            item.setTitle('Create subtask');
            item.setIcon('plus');
            item.onClick(() => {
                const taskFile = plugin.app.vault.getAbstractFileByPath(task.path);
                if (taskFile instanceof TFile) {
                    const projectReference = `[[${taskFile.basename}]]`;
                    plugin.openTaskCreationModal({
                        projects: [projectReference]
                    });
                }
            });
        });
        
    }

    public show(event: MouseEvent): void {
        this.menu.showAtMouseEvent(event);
    }

    public showAtElement(element: HTMLElement): void {
        this.menu.showAtPosition({
            x: element.getBoundingClientRect().left,
            y: element.getBoundingClientRect().bottom + 4
        });
    }
}
