import { App, PluginSettingTab, Setting, Notice, setIcon, TAbstractFile, TFile, setTooltip, Platform, Modal } from 'obsidian';
import TaskNotesPlugin from '../main';
import { FieldMapping, WebhookConfig } from '../types';
import { DefaultReminder } from '../types/settings';
import { DEFAULT_FIELD_MAPPING } from './defaults';
import { StatusManager } from '../services/StatusManager';
import { PriorityManager } from '../services/PriorityManager';
import { showConfirmationModal } from '../modals/ConfirmationModal';
import { showStorageLocationConfirmationModal } from '../modals/StorageLocationConfirmationModal';
import { ProjectSelectModal } from '../modals/ProjectSelectModal';
import { splitListPreservingLinksAndQuotes } from '../utils/stringSplit';



export class TaskNotesSettingTab extends PluginSettingTab {
	plugin: TaskNotesPlugin;
	private activeTab = 'task-defaults';
	private tabContents: Record<string, HTMLElement> = {};
	private selectedDefaultProjectFiles: TAbstractFile[] = [];

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('tasknotes-settings');
		containerEl.addClass('tasknotes-plugin');
		containerEl.addClass('settings-view');

		// Create tab navigation
		const tabNav = containerEl.createDiv('settings-tab-nav settings-view__tab-nav');

		const allTabs = [
			{ id: 'task-defaults', name: 'Task defaults' },
			{ id: 'general', name: 'Inline tasks' },
			{ id: 'calendar', name: 'Calendar' },
			{ id: 'field-mapping', name: 'Field mapping' },
			{ id: 'statuses', name: 'Statuses' },
			{ id: 'priorities', name: 'Priorities' },
			{ id: 'pomodoro', name: 'Pomodoro' },
			{ id: 'notifications', name: 'Notifications' },
			{ id: 'api', name: 'HTTP API' },
			{ id: 'misc', name: 'Misc' }
		];

		// Filter out API tab on mobile
		const tabs = Platform.isMobile ? allTabs.filter(tab => tab.id !== 'api') : allTabs;

		// Reset active tab if it's 'api' on mobile
		if (Platform.isMobile && this.activeTab === 'api') {
			this.activeTab = 'general';
		}

		tabs.forEach(tab => {
			const isActive = this.activeTab === tab.id;
			const tabButton = tabNav.createEl('button', {
				text: tab.name,
				cls: isActive ? 'settings-tab-button settings-view__tab-button active settings-view__tab-button--active' : 'settings-tab-button settings-view__tab-button',
				attr: {
					'role': 'tab',
					'aria-selected': isActive.toString(),
					'aria-controls': `settings-tab-${tab.id}`,
					'id': `tab-button-${tab.id}`,
					'tabindex': isActive ? '0' : '-1'
				}
			});

			tabButton.addEventListener('click', () => {
				this.switchTab(tab.id);
			});

			tabButton.addEventListener('keydown', (e) => {
				if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
					e.preventDefault();
					const currentIndex = tabs.findIndex(t => t.id === tab.id);
					const nextIndex = e.key === 'ArrowRight'
						? (currentIndex + 1) % tabs.length
						: (currentIndex - 1 + tabs.length) % tabs.length;
					const nextTabId = tabs[nextIndex].id;
					this.switchTab(nextTabId);
					// Focus will be set in switchTab
				}
			});
		});

		// Create tab content containers
		const tabContentsEl = containerEl.createDiv('settings-tab-contents settings-view__tab-contents');

		// Create all tab content containers
		tabs.forEach(tab => {
			const tabContent = tabContentsEl.createDiv('settings-tab-content settings-view__tab-content');
			tabContent.setAttribute('role', 'tabpanel');
			tabContent.setAttribute('id', `settings-tab-${tab.id}`);
			tabContent.setAttribute('aria-labelledby', `tab-button-${tab.id}`);
			if (this.activeTab === tab.id) {
				tabContent.addClass('active');
				tabContent.addClass('settings-view__tab-content--active');
			}
			this.tabContents[tab.id] = tabContent;
		});

		this.renderActiveTab();
	}

	private switchTab(tabId: string): void {
		this.activeTab = tabId;
		this.display(); // Re-render the entire settings tab

		// Focus the newly active tab button
		window.setTimeout(() => {
			const activeTabButton = this.containerEl.querySelector(`#tab-button-${tabId}`) as HTMLElement;
			if (activeTabButton) {
				activeTabButton.focus();
			}
		}, 50);
	}

	private renderActiveTab(): void {
		// Clear current tab content
		Object.values(this.tabContents).forEach(content => content.empty());

		switch (this.activeTab) {
			case 'general':
				this.renderGeneralTab();
				break;
			case 'task-defaults':
				this.renderTaskDefaultsTab();
				break;
			case 'calendar':
				this.renderCalendarTab();
				break;
			case 'field-mapping':
				this.renderFieldMappingTab();
				break;
			case 'statuses':
				this.renderStatusesTab();
				break;
			case 'priorities':
				this.renderPrioritiesTab();
				break;
			case 'pomodoro':
				this.renderPomodoroTab();
				break;
			case 'notifications':
				this.renderNotificationsTab();
				break;
			case 'api':
				this.renderAPITab();
				break;
			case 'misc':
				this.renderMiscTab();
				break;
		}
	}

	private renderGeneralTab(): void {
		const container = this.tabContents['general'];

		// Inline task settings
		new Setting(container).setName('Inline tasks').setHeading();

		container.createEl('p', {
			text: 'Configure how TaskNotes integrates with your editor and existing Markdown tasks.',
			cls: 'settings-help-note'
		});

		new Setting(container)
			.setName('Task link overlay')
			.setDesc('Replace wikilinks to task files with interactive task cards in both live preview and reading modes')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Enable task link overlay in live preview and reading modes');
				return toggle
					.setValue(this.plugin.settings.enableTaskLinkOverlay)
					.onChange(async (value) => {
						this.plugin.settings.enableTaskLinkOverlay = value;
						await this.plugin.saveSettings();
					});
			});


		new Setting(container)
			.setName('Instant task convert')
			.setDesc('Show a convert button next to checkbox tasks for instant conversion to TaskNotes')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Enable instant task conversion buttons');
				return toggle
					.setValue(this.plugin.settings.enableInstantTaskConvert)
					.onChange(async (value) => {
						this.plugin.settings.enableInstantTaskConvert = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Use task defaults on instant convert')
			.setDesc('Apply your configured task creation defaults when converting checkbox tasks to TaskNotes (contexts, tags, dates, folder, etc.)')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Apply task creation defaults during instant conversion');
				return toggle
					.setValue(this.plugin.settings.useDefaultsOnInstantConvert)
					.onChange(async (value) => {
						this.plugin.settings.useDefaultsOnInstantConvert = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Inline task folder')
			.setDesc('Folder for converted inline tasks. Use {{currentNotePath}} to place tasks in the same folder as the note.')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Folder for inline task conversion');
				return text
					.setPlaceholder('{{currentNotePath}}')
					.setValue(this.plugin.settings.inlineTaskConvertFolder)
					.onChange(async (value) => {
						this.plugin.settings.inlineTaskConvertFolder = value;
						await this.plugin.saveSettings();
					});
			});

		// Help section
		const helpContainer = container.createDiv('settings-help-section');
		helpContainer.createEl('h4', { text: 'How inline task features work:' });
		const helpList = helpContainer.createEl('ul');
		helpList.createEl('li', { text: 'Task link overlay: When you link to a task file like [[My Task]], it shows an interactive task card instead of a plain link' });
		helpList.createEl('li', { text: 'Instant task convert: Shows a "Convert to TaskNote" button next to standard Markdown checkboxes like - [ ] My task' });

		helpContainer.createEl('p', {
			text: 'These features help bridge regular Markdown tasks with the full TaskNotes system.',
			cls: 'settings-help-note'
		});
	}

	private renderTaskDefaultsTab(): void {
		const container = this.tabContents['task-defaults'];

		// Task organization section
		new Setting(container).setName('Task organization').setHeading();

		new Setting(container)
			.setName('Default tasks folder')
			.setDesc('Default folder for new tasks (tasks are identified by tag, not folder)')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Default tasks folder path');
				return text
					.setPlaceholder('TaskNotes/Tasks')
					.setValue(this.plugin.settings.tasksFolder)
					.onChange(async (value) => {
						this.plugin.settings.tasksFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Move archived tasks to folder')
			.setDesc('Automatically move tasks to a configured folder when archived')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Move archived tasks to folder');
				return toggle
					.setValue(this.plugin.settings.moveArchivedTasks)
					.onChange(async (value) => {
						this.plugin.settings.moveArchivedTasks = value;
						await this.plugin.saveSettings();
						this.renderActiveTab(); // Re-render to show/hide archive folder setting
					});
			});

		if (this.plugin.settings.moveArchivedTasks) {
			new Setting(container)
				.setName('Archive folder')
				.setDesc('Folder to move tasks to when archived')
				.addText(text => {
					text.inputEl.setAttribute('aria-label', 'Archive folder path');
					return text
						.setPlaceholder('TaskNotes/Archive')
						.setValue(this.plugin.settings.archiveFolder)
						.onChange(async (value) => {
							this.plugin.settings.archiveFolder = value;
							await this.plugin.saveSettings();
						});
				});
		}

		new Setting(container)
			.setName('Identify tasks by')
			.setDesc('Choose whether to identify tasks by tag or by a frontmatter property')
			.addDropdown(dropdown => {
				dropdown
					.addOption('tag', 'Tag')
					.addOption('property', 'Property')
					.setValue(this.plugin.settings.taskIdentificationMethod)
					.onChange(async (value: 'tag' | 'property') => {
						this.plugin.settings.taskIdentificationMethod = value;
						await this.plugin.saveSettings();
						this.renderActiveTab(); // Re-render to show/hide conditional fields
					});
			});

		if (this.plugin.settings.taskIdentificationMethod === 'tag') {
			new Setting(container)
				.setName('Task tag')
				.setDesc('Tag that identifies notes as tasks (without #)')
				.addText(text => {
					text.inputEl.setAttribute('aria-label', 'Task identification tag');
					return text
						.setPlaceholder('task')
						.setValue(this.plugin.settings.taskTag)
						.onChange(async (value) => {
							this.plugin.settings.taskTag = value;
							await this.plugin.saveSettings();
						});
				});
		} else { // Property-based identification
			new Setting(container)
				.setName('Task property name')
				.setDesc('The frontmatter property name (e.g., "category")')
				.addText(text => text
					.setPlaceholder('category')
					.setValue(this.plugin.settings.taskPropertyName)
					.onChange(async (value) => {
						this.plugin.settings.taskPropertyName = value;
						await this.plugin.saveSettings();
					}));

			new Setting(container)
				.setName('Task property value')
				.setDesc('The value that identifies a task (e.g., "[[Tasks]]")')
				.addText(text => text
					.setPlaceholder('[[Tasks]]')
					.setValue(this.plugin.settings.taskPropertyValue)
					.onChange(async (value) => {
						this.plugin.settings.taskPropertyValue = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(container)
			.setName('Excluded folders')
			.setDesc('Comma-separated list of folder paths to exclude from Notes tab')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Comma-separated list of folders to exclude');
				return text
					.setPlaceholder('Templates,Archive')
					.setValue(this.plugin.settings.excludedFolders)
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value;
						await this.plugin.saveSettings();
					});
			});

		// Task filename settings
		new Setting(container).setName('Task filenames').setHeading();

		new Setting(container)
			.setName('Store title exclusively in filename')
			.setDesc("When disabled, the task's title will be stored in the note frontmatter. You will be able to define custom templates for the filename of the task, but these will not be updated by the TaskNotes plugin after task creation. Moving the title into the frontmatter is a significant storage change and care must be taken when mixing tasks with their titles in the filename, and those with their titles in the frontmatter. Toggling this option will not affect existing tasks; it will affect tasks on creation and edit.")
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Store title exclusively in filename');
				return toggle
					.setValue(this.plugin.settings.storeTitleInFilename)
					.onChange(async (value) => {
						this.plugin.settings.storeTitleInFilename = value;
						await this.plugin.saveSettings();
						this.renderActiveTab(); // Re-render to show/hide other options
					});
			});

		if (!this.plugin.settings.storeTitleInFilename) {
			new Setting(container)
				.setName('Filename format')
				.setDesc('How task filenames should be generated')
				.addDropdown(dropdown => {
					dropdown.selectEl.setAttribute('aria-label', 'Task filename generation format');
					return dropdown
						.addOption('title', 'Task title')
						.addOption('zettel', 'Zettelkasten format (YYMMDD + base36 seconds since midnight)')
						.addOption('timestamp', 'Full timestamp (YYYY-MM-DD-HHMMSS)')
						.addOption('custom', 'Custom template')
						.setValue(this.plugin.settings.taskFilenameFormat)
						.onChange(async (value: any) => {
							this.plugin.settings.taskFilenameFormat = value;
							await this.plugin.saveSettings();
							this.renderActiveTab(); // Re-render to update visibility
						});
				});

			if (this.plugin.settings.taskFilenameFormat === 'custom') {
				new Setting(container)
					.setName('Custom filename template')
					.setDesc('Template for custom filenames. Available variables: {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}')
					.addText(text => {
						text.inputEl.setAttribute('aria-label', 'Custom filename template with variables');
						return text
							.setPlaceholder('{date}-{title}-{dueDate}')
							.setValue(this.plugin.settings.customFilenameTemplate)
							.onChange(async (value) => {
								this.plugin.settings.customFilenameTemplate = value;
								await this.plugin.saveSettings();
							});
					});

				container.createEl('p', {
					text: 'Note: {dueDate} and {scheduledDate} are in YYYY-MM-DD format and will be empty if not set.',
					cls: 'settings-help-note'
				});
			}
		}

		// Basic defaults section
		new Setting(container).setName('Basic defaults').setHeading();

		new Setting(container)
			.setName('Enable natural language task input')
			.setDesc('Show a smart input field in task creation modal that can parse natural language like "Buy groceries tomorrow 3pm high priority @home #errands"')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Enable natural language task input');
				return toggle
					.setValue(this.plugin.settings.enableNaturalLanguageInput)
					.onChange(async (value) => {
						this.plugin.settings.enableNaturalLanguageInput = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Default date type for natural language input')
			.setDesc('When dates are mentioned without "due" or "scheduled" keywords (e.g., "task friday"), default to scheduled date. When disabled, defaults to due date.')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Default to scheduled date for natural language input');
				return toggle
					.setValue(this.plugin.settings.nlpDefaultToScheduled)
					.onChange(async (value) => {
						this.plugin.settings.nlpDefaultToScheduled = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Default task status')
			.setDesc('Default status for new tasks')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Default status for new tasks');
				// Populate with custom statuses
				this.plugin.settings.customStatuses.forEach(status => {
					dropdown.addOption(status.value, status.label);
				});
				return dropdown
					.setValue(this.plugin.settings.defaultTaskStatus)
					.onChange(async (value: any) => {
						this.plugin.settings.defaultTaskStatus = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Default task priority')
			.setDesc('Default priority for new tasks')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Default priority for new tasks');
				// Populate with custom priorities
				this.plugin.settings.customPriorities.forEach(priority => {
					dropdown.addOption(priority.value, priority.label);
				});
				return dropdown
					.setValue(this.plugin.settings.defaultTaskPriority)
					.onChange(async (value: any) => {
						this.plugin.settings.defaultTaskPriority = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Default contexts')
			.setDesc('Default contexts for new tasks (comma-separated)')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Default contexts for new tasks');
				return text
					.setPlaceholder('work, personal')
					.setValue(this.plugin.settings.taskCreationDefaults.defaultContexts)
					.onChange(async (value) => {
						this.plugin.settings.taskCreationDefaults.defaultContexts = value;
						await this.plugin.saveSettings();
					});
			});


		new Setting(container)
			.setName('Default tags')
			.setDesc('Default tags for new tasks (comma-separated)')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Default tags for new tasks');
				return text
					.setPlaceholder('project, urgent')
					.setValue(this.plugin.settings.taskCreationDefaults.defaultTags)
					.onChange(async (value) => {
						this.plugin.settings.taskCreationDefaults.defaultTags = value;
						await this.plugin.saveSettings();
					});
			});

		// Default projects setting
		const projectSetting = new Setting(container)
			.setName('Default projects')
			.setDesc('Default projects for new tasks');

		// Initialize default project files from settings
		this.initializeDefaultProjectsFromSettings();

		// Create projects display area
		const projectsContainer = projectSetting.settingEl.createDiv('default-projects-container');
		const projectsList = projectsContainer.createDiv('default-projects-list');

		// Add project button
		const addProjectBtn = projectsContainer.createEl('button', {
			cls: 'default-project-add-btn',
			text: '+ Add project'
		});
		addProjectBtn.addEventListener('click', () => {
			new ProjectSelectModal(this.app, this.plugin, (file) => {
				this.addDefaultProject(file);
				this.renderDefaultProjectsList(projectsList);
				this.updateDefaultProjectsInSettings();
			}).open();
		});

		// Initial render
		this.renderDefaultProjectsList(projectsList);

		new Setting(container)
			.setName('Use parent note as project')
			.setDesc('During instant task conversion, automatically add the parent note as a project')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Use parent note as project for instant conversion');
				return toggle
					.setValue(this.plugin.settings.taskCreationDefaults.useParentNoteAsProject)
					.onChange(async (value) => {
						this.plugin.settings.taskCreationDefaults.useParentNoteAsProject = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Default time estimate')
			.setDesc('Default time estimate for new tasks in minutes (0 = no default)')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Default time estimate in minutes');
				return text
					.setPlaceholder('0')
					.setValue(this.plugin.settings.taskCreationDefaults.defaultTimeEstimate.toString())
					.onChange(async (value) => {
						const num = parseInt(value) || 0;
						this.plugin.settings.taskCreationDefaults.defaultTimeEstimate = num;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Default recurrence')
			.setDesc('Default recurrence pattern for new tasks')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Default recurrence pattern');
				return dropdown
					.addOption('none', 'None')
					.addOption('daily', 'Daily')
					.addOption('weekly', 'Weekly')
					.addOption('monthly', 'Monthly')
					.addOption('yearly', 'Yearly')
					.setValue(this.plugin.settings.taskCreationDefaults.defaultRecurrence)
					.onChange(async (value: any) => {
						this.plugin.settings.taskCreationDefaults.defaultRecurrence = value;
						await this.plugin.saveSettings();
					});
			});

		// Date defaults section
		new Setting(container).setName('Date defaults').setHeading();

		new Setting(container)
			.setName('Default due date')
			.setDesc('Default due date for new tasks')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Default due date for new tasks');
				return dropdown
					.addOption('none', 'None')
					.addOption('today', 'Today')
					.addOption('tomorrow', 'Tomorrow')
					.addOption('next-week', 'Next week')
					.setValue(this.plugin.settings.taskCreationDefaults.defaultDueDate)
					.onChange(async (value: any) => {
						this.plugin.settings.taskCreationDefaults.defaultDueDate = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Default scheduled date')
			.setDesc('Default scheduled date for new tasks')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Default scheduled date for new tasks');
				return dropdown
					.addOption('none', 'None')
					.addOption('today', 'Today')
					.addOption('tomorrow', 'Tomorrow')
					.addOption('next-week', 'Next week')
					.setValue(this.plugin.settings.taskCreationDefaults.defaultScheduledDate)
					.onChange(async (value: any) => {
						this.plugin.settings.taskCreationDefaults.defaultScheduledDate = value;
						await this.plugin.saveSettings();
					});
			});

		// Body template section
		new Setting(container).setName('Body template').setHeading();

		new Setting(container)
			.setName('Use body template')
			.setDesc('Pre-fill task details with content from a template file')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Enable body template for new tasks');
				return toggle
					.setValue(this.plugin.settings.taskCreationDefaults.useBodyTemplate)
					.onChange(async (value) => {
						this.plugin.settings.taskCreationDefaults.useBodyTemplate = value;
						await this.plugin.saveSettings();
						this.renderActiveTab(); // Re-render to show/hide template path
					});
			});

		if (this.plugin.settings.taskCreationDefaults.useBodyTemplate) {
			new Setting(container)
				.setName('Body template file')
				.setDesc('Path to template file for task body content. Supports template variables like {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.')
				.addText(text => {
					text.inputEl.setAttribute('aria-label', 'Path to body template file');
					return text
						.setPlaceholder('Templates/Task Template.md')
						.setValue(this.plugin.settings.taskCreationDefaults.bodyTemplate)
						.onChange(async (value) => {
							this.plugin.settings.taskCreationDefaults.bodyTemplate = value;
							await this.plugin.saveSettings();
						});
				});
		}

		// Help section
		const helpContainer = container.createDiv('settings-help-section');
		helpContainer.createEl('h4', { text: 'Template variables:' });
		const helpList = helpContainer.createEl('ul');
		helpList.createEl('li', { text: '{{title}} - Task title' });
		helpList.createEl('li', { text: '{{details}} - User-provided details from modal' });
		helpList.createEl('li', { text: '{{date}} - Current date (YYYY-MM-DD)' });
		helpList.createEl('li', { text: '{{time}} - Current time (HH:MM)' });
		helpList.createEl('li', { text: '{{priority}} - Task priority' });
		helpList.createEl('li', { text: '{{status}} - Task status' });
		helpList.createEl('li', { text: '{{contexts}} - Task contexts' });
		helpList.createEl('li', { text: '{{tags}} - Task tags' });
		helpList.createEl('li', { text: '{{timeEstimate}} - Time estimate in minutes' });
		helpList.createEl('li', { text: '{{dueDate}} - Task due date' });
		helpList.createEl('li', { text: '{{scheduledDate}} - Task scheduled date' });
		helpList.createEl('li', { text: '{{parentNote}} - Parent note as a properly formatted markdown link' });

		helpContainer.createEl('p', {
			text: 'Template is applied when the task is created with all final values from the form. Use {{details}} to include user content from the Details field.\n{{parentNote}} will resolve to a quoted markdown link (e.g., "[[Note Name]]") for the note where the task was created. For project organization, use it as a YAML list item: "project:\\n  - {{parentNote}}". Variables use the same format as daily note templates.',
			cls: 'settings-help-note'
		});

		// Reminder defaults section
		new Setting(container).setName('Reminder defaults').setHeading();

		const reminderSection = container.createDiv('reminder-defaults-section');
		reminderSection.createEl('p', {
			text: 'Configure default reminders that will be automatically added to new tasks. These can be relative to due or scheduled dates.',
			cls: 'settings-help-note'
		});

		// Current default reminders list
		const remindersList = reminderSection.createDiv('reminder-defaults-list');
		this.renderDefaultRemindersList(remindersList);

		// Add reminder form
		this.renderAddDefaultReminderForm(reminderSection);

		// Task display section
		new Setting(container).setName('Task display defaults').setHeading();

		this.renderDefaultVisiblePropertiesSettings(container);

	}

	private renderDefaultVisiblePropertiesSettings(container: HTMLElement): void {
		// Get available properties 
		const availableProperties = [
			{ id: 'status', name: 'Status dot', category: 'core' },
			{ id: 'priority', name: 'Priority dot', category: 'core' },
			{ id: 'due', name: 'Due date', category: 'core' },
			{ id: 'scheduled', name: 'Scheduled date', category: 'core' },
			{ id: 'timeEstimate', name: 'Time estimate', category: 'core' },
			{ id: 'recurrence', name: 'Recurrence', category: 'core' },
			{ id: 'completedDate', name: 'Completed date', category: 'core' },
			{ id: 'projects', name: 'Projects', category: 'organization' },
			{ id: 'contexts', name: 'Contexts', category: 'organization' },
			{ id: 'tags', name: 'Tags', category: 'organization' }
		];

		new Setting(container)
			.setName('Default visible properties')
			.setDesc('Choose which properties appear on task cards by default. You can temporarily change these in each view and save custom combinations to saved views.')
			.setClass('setting-item-default-properties');

		// Create container for property toggles
		const propertiesContainer = container.createDiv('default-properties-container');
		
		// Group by category
		const coreProperties = availableProperties.filter(p => p.category === 'core');
		const orgProperties = availableProperties.filter(p => p.category === 'organization');
		
		// Create sections
		this.createPropertiesSection(propertiesContainer, 'Core properties', coreProperties);
		this.createPropertiesSection(propertiesContainer, 'Organization', orgProperties);
		
		// Add user-defined properties if any exist
		const userFields = this.plugin.settings.userFields || [];
		if (userFields.length > 0) {
			const userProperties = userFields.map(field => ({
				id: `user:${field.id}`,
				name: field.displayName,
				category: 'user' as const
			}));
			this.createPropertiesSection(propertiesContainer, 'Custom properties', userProperties);
		}
		
		// Add note about backward compatibility
		const note = container.createDiv({ cls: 'settings-help-note' });
		note.textContent = 'Note: Status and priority dots are automatically included for backward compatibility with existing views.';
	}

	private createPropertiesSection(container: HTMLElement, title: string, properties: Array<{ id: string, name: string, category: string }>) {
		const section = container.createDiv('properties-section');
		const header = section.createDiv('properties-section-header');
		header.textContent = title;
		
		const grid = section.createDiv('properties-grid');
		
		const currentDefaults = this.plugin.settings.defaultVisibleProperties || [];
		
		properties.forEach(property => {
			const item = grid.createDiv('property-item');
			
			const checkbox = item.createEl('input', {
				type: 'checkbox',
				attr: { 'aria-label': `Show ${property.name}` }
			}) as HTMLInputElement;
			
			checkbox.checked = currentDefaults.includes(property.id);
			checkbox.addEventListener('change', async () => {
				let updatedDefaults = [...currentDefaults];
				
				if (checkbox.checked) {
					if (!updatedDefaults.includes(property.id)) {
						updatedDefaults.push(property.id);
					}
				} else {
					updatedDefaults = updatedDefaults.filter(id => id !== property.id);
				}
				
				this.plugin.settings.defaultVisibleProperties = updatedDefaults;
				await this.plugin.saveSettings();
			});
			
			const label = item.createEl('label');
			label.textContent = property.name;
			label.addEventListener('click', () => {
				checkbox.checked = !checkbox.checked;
				checkbox.dispatchEvent(new Event('change'));
			});
		});
	}

	private renderCalendarTab(): void {
		const container = this.tabContents['calendar'];

		// Calendar view section
		new Setting(container).setName('Calendar view settings').setHeading();

		new Setting(container)
			.setName('Default view')
			.setDesc('Initial view when opening the Advanced Calendar')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Default calendar view');
				return dropdown
					.addOption('dayGridMonth', 'Month')
					.addOption('timeGridWeek', 'Week')
					.addOption('timeGridDay', 'Day')
					.addOption('timeGridCustom', 'Custom Days')
					.addOption('multiMonthYear', 'Year')
					.setValue(this.plugin.settings.calendarViewSettings.defaultView)
					.onChange(async (value: any) => {
						this.plugin.settings.calendarViewSettings.defaultView = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Custom view day count')
			.setDesc('Number of days to show in the custom view (2-10 days)')
			.addSlider(slider => {
				slider.sliderEl.setAttribute('aria-label', 'Number of days in custom view');
				return slider
					.setLimits(2, 10, 1)
					.setValue(this.plugin.settings.calendarViewSettings.customDayCount)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.customDayCount = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('First day of week')
			.setDesc('Which day should be the first column in week and month views')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'First day of week');
				return dropdown
					.addOption('0', 'Sunday')
					.addOption('1', 'Monday')
					.addOption('2', 'Tuesday')
					.addOption('3', 'Wednesday')
					.addOption('4', 'Thursday')
					.addOption('5', 'Friday')
					.addOption('6', 'Saturday')
					.setValue(this.plugin.settings.calendarViewSettings.firstDay.toString())
					.onChange(async (value: any) => {
						this.plugin.settings.calendarViewSettings.firstDay = parseInt(value) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Show weekends')
			.setDesc('Display Saturday and Sunday in calendar views')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show weekends in calendar');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.showWeekends)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.showWeekends = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Calendar locale')
			.setDesc('Calendar locale for date formatting and calendar system (e.g., "en", "fa" for Farsi/Persian, "de" for German). Leave empty to auto-detect from browser.')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Calendar locale');
				return text
					.setPlaceholder('Auto-detect')
					.setValue(this.plugin.settings.calendarViewSettings.locale)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.locale = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Show week numbers')
			.setDesc('Display week numbers on the left side of calendar views')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show week numbers');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.weekNumbers)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.weekNumbers = value;
						await this.plugin.saveSettings();
					});
			});

		// Time settings section
		new Setting(container).setName('Time settings').setHeading();

		new Setting(container)
			.setName('Time format')
			.setDesc('Display times in 12-hour or 24-hour format')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Time format');
				return dropdown
					.addOption('12', '12-hour (9:00 AM)')
					.addOption('24', '24-hour (09:00)')
					.setValue(this.plugin.settings.calendarViewSettings.timeFormat)
					.onChange(async (value: any) => {
						this.plugin.settings.calendarViewSettings.timeFormat = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Time slot duration')
			.setDesc('Duration of each time slot in week and day views')
			.addDropdown(dropdown => {
				dropdown.selectEl.setAttribute('aria-label', 'Time slot duration');
				return dropdown
					.addOption('00:15:00', '15 minutes')
					.addOption('00:30:00', '30 minutes')
					.addOption('01:00:00', '1 hour')
					.setValue(this.plugin.settings.calendarViewSettings.slotDuration)
					.onChange(async (value: any) => {
						this.plugin.settings.calendarViewSettings.slotDuration = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Day start time')
			.setDesc('First time slot to display in day/week views')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Day start time (HH:MM:SS format)');
				return text
					.setPlaceholder('00:00:00')
					.setValue(this.plugin.settings.calendarViewSettings.slotMinTime)
					.onChange(async (value) => {
						// Validate time format
						if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
							return; // Invalid format, don't save
						}
						this.plugin.settings.calendarViewSettings.slotMinTime = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Day end time')
			.setDesc('Last time slot to display in day/week views')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Day end time (HH:MM:SS format)');
				return text
					.setPlaceholder('24:00:00')
					.setValue(this.plugin.settings.calendarViewSettings.slotMaxTime)
					.onChange(async (value) => {
						// Validate time format
						if (!/^([0-1]?[0-9]|2[0-4]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
							return; // Invalid format, don't save
						}
						this.plugin.settings.calendarViewSettings.slotMaxTime = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Initial scroll time')
			.setDesc('Time to scroll to when opening day/week views')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Initial scroll time (HH:MM:SS format)');
				return text
					.setPlaceholder('08:00:00')
					.setValue(this.plugin.settings.calendarViewSettings.scrollTime)
					.onChange(async (value) => {
						// Validate time format
						if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
							return; // Invalid format, don't save
						}
						this.plugin.settings.calendarViewSettings.scrollTime = value;
						await this.plugin.saveSettings();
					});
			});

		// Event visibility section
		new Setting(container).setName('Default event visibility').setHeading();

		container.createEl('p', {
			text: 'Configure which event types are visible by default when opening the Advanced Calendar. Users can still toggle these on/off in the calendar view.',
			cls: 'settings-help-note'
		});

		new Setting(container)
			.setName('Show scheduled tasks')
			.setDesc('Display tasks with scheduled dates by default')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show scheduled tasks by default');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.defaultShowScheduled)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.defaultShowScheduled = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Show due dates')
			.setDesc('Display task due dates by default')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show due dates by default');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.defaultShowDue)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.defaultShowDue = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Show due dates when scheduled')
			.setDesc('Display due dates even for tasks that already have scheduled dates')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show due dates when scheduled dates exist');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.defaultShowDueWhenScheduled = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Show time entries')
			.setDesc('Display completed time tracking entries by default')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show time entries by default');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.defaultShowTimeEntries)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.defaultShowTimeEntries = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Show recurring tasks')
			.setDesc('Display recurring task instances by default')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show recurring tasks by default');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.defaultShowRecurring)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.defaultShowRecurring = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Show ICS events')
			.setDesc('Display events from ICS subscriptions by default')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show ICS events by default');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.defaultShowICSEvents)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.defaultShowICSEvents = value;
						await this.plugin.saveSettings();
					});
			});

		// Timeblocking section
		new Setting(container).setName('Timeblocking').setHeading();

		new Setting(container)
			.setName('Enable timeblocking')
			.setDesc('Enable timeblock functionality for lightweight scheduling in daily notes')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Enable timeblocking feature');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.enableTimeblocking)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.enableTimeblocking = value;
						await this.plugin.saveSettings();
						// Refresh calendar views to show/hide timeblock functionality
						this.plugin.emitter.trigger('timeblocking-toggled', value);
					});
			});

		new Setting(container)
			.setName('Show timeblocks')
			.setDesc('Display timeblocks from daily notes by default')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show timeblocks by default');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.defaultShowTimeblocks)
					.setDisabled(!this.plugin.settings.calendarViewSettings.enableTimeblocking)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.defaultShowTimeblocks = value;
						await this.plugin.saveSettings();
					});
			});

		container.createEl('p', {
			text: 'Timeblocks are defined in daily note frontmatter using the "timeblocks" field. Each timeblock can have a title, start time, end time, and optional attachments as markdown links to tasks or notes.',
			cls: 'settings-help-note'
		});

		container.createEl('p', {
			text: '💡 Tip: In the calendar view, hold Shift + drag to create timeblocks • Drag to move • Resize edges to adjust duration',
			cls: 'settings-help-note'
		});

		// Calendar behavior section
		new Setting(container).setName('Calendar behavior').setHeading();

		new Setting(container)
			.setName('Current time indicator')
			.setDesc('Show a line indicating the current time in week and day views')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show current time indicator');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.nowIndicator)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.nowIndicator = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Selection mirror')
			.setDesc('Show a visual preview while dragging to select time ranges')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Enable selection mirror');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.selectMirror)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.selectMirror = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Highlight today')
			.setDesc('Highlight the current date with a background color in calendar views')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Highlight today');
				return toggle
					.setValue(this.plugin.settings.calendarViewSettings.showTodayHighlight)
					.onChange(async (value) => {
						this.plugin.settings.calendarViewSettings.showTodayHighlight = value;
						await this.plugin.saveSettings();
					});
			});

		// ICS Calendar Subscriptions section
		new Setting(container).setName('Calendar subscriptions').setHeading();

		// Description section
		container.createEl('p', {
			text: 'Subscribe to external calendar feeds (ICS/iCal format) to display events alongside your tasks.',
			cls: 'settings-help-note'
		});

		// Subscription list
		const subscriptionList = container.createDiv('settings-list settings-view__list');
		this.renderSubscriptionList(subscriptionList);

		// Add subscription form
		new Setting(container)
			.setName('Add calendar subscription')
			.setDesc('Subscribe to an external calendar feed or add a local ICS file');

		const addForm = container.createDiv('ics-add-subscription-form');

		// Type selection
		const typeRow = addForm.createDiv('ics-form-row');
		typeRow.createEl('label', { text: 'Source type:', cls: 'ics-form-label' });
		const typeSelect = typeRow.createEl('select', { cls: 'ics-form-select' });
		typeSelect.createEl('option', { value: 'remote', text: 'Remote URL' });
		typeSelect.createEl('option', { value: 'local', text: 'Local file' });

		// Name input
		const nameRow = addForm.createDiv('ics-form-row');
		nameRow.createEl('label', { text: 'Name:', cls: 'ics-form-label' });
		const nameInput = nameRow.createEl('input', {
			type: 'text',
			placeholder: 'My Calendar',
			cls: 'ics-form-input'
		});

		// URL input (for remote)
		const urlRow = addForm.createDiv('ics-form-row');
		urlRow.createEl('label', { text: 'ICS URL:', cls: 'ics-form-label' });
		const urlInput = urlRow.createEl('input', {
			type: 'url',
			placeholder: 'https://example.com/calendar.ics',
			cls: 'ics-form-input'
		});

		// Local file selection (for local)
		const fileRow = addForm.createDiv('ics-form-row ics-form-row-hidden');
		fileRow.createEl('label', { text: 'ICS file:', cls: 'ics-form-label' });
		const fileSelect = fileRow.createEl('select', { cls: 'ics-form-select' });

		// Function to update available ICS files
		const updateLocalFiles = () => {
			fileSelect.empty();
			fileSelect.createEl('option', { value: '', text: 'Select an ICS file...' });

			const icsFiles = this.plugin.icsSubscriptionService?.getLocalICSFiles() || [];
			icsFiles.forEach(file => {
				fileSelect.createEl('option', { value: file.path, text: file.path });
			});

			if (icsFiles.length === 0) {
				fileSelect.createEl('option', { value: '', text: 'No .ics files found in vault', attr: { disabled: 'true' } });
			}
		};

		// Initial update
		updateLocalFiles();

		// Type change handler
		typeSelect.addEventListener('change', () => {
			const isRemote = typeSelect.value === 'remote';
			urlRow.style.display = isRemote ? 'flex' : 'none';
			fileRow.style.display = isRemote ? 'none' : 'flex';

			if (!isRemote) {
				updateLocalFiles();
			}
		});

		// Color and settings row
		const settingsRow = addForm.createDiv('ics-form-row ics-form-row-multi');

		// Color input
		const colorGroup = settingsRow.createDiv('ics-form-group');
		colorGroup.createEl('label', { text: 'Color:', cls: 'ics-form-label' });
		const colorInput = colorGroup.createEl('input', {
			type: 'color',
			value: '#3788d8',
			cls: 'ics-form-color'
		});

		// Refresh interval input
		const intervalGroup = settingsRow.createDiv('ics-form-group');
		intervalGroup.createEl('label', { text: 'Refresh (min):', cls: 'ics-form-label' });
		const intervalInput = intervalGroup.createEl('input', {
			type: 'number',
			value: '60',
			cls: 'ics-form-number'
		});
		intervalInput.setAttribute('min', '15');
		intervalInput.setAttribute('max', '1440');
		intervalInput.setAttribute('step', '15');

		// Enabled checkbox
		const enabledGroup = settingsRow.createDiv('ics-form-group');
		const enabledLabel = enabledGroup.createEl('label', { cls: 'ics-form-checkbox-label' });
		const enabledCheckbox = enabledLabel.createEl('input', {
			type: 'checkbox',
			cls: 'ics-form-checkbox'
		});
		enabledCheckbox.checked = true;
		enabledLabel.createSpan({ text: ' Enabled' });

		// Add button
		const buttonRow = addForm.createDiv('ics-form-row');
		const addButton = buttonRow.createEl('button', {
			text: 'Add Subscription',
			cls: 'ics-form-button mod-cta'
		});

		addButton.addEventListener('click', async () => {
			const name = nameInput.value.trim();
			const type = typeSelect.value as 'remote' | 'local';
			const url = urlInput.value.trim();
			const filePath = fileSelect.value.trim();
			const color = colorInput.value;
			const refreshInterval = parseInt(intervalInput.value);
			const enabled = enabledCheckbox.checked;

			if (!name) {
				new Notice('Name is required');
				return;
			}

			if (type === 'remote' && !url) {
				new Notice('URL is required for remote subscriptions');
				return;
			}

			if (type === 'local' && !filePath) {
				new Notice('Please select a local ICS file');
				return;
			}

			if (refreshInterval < 15 || refreshInterval > 1440) {
				new Notice('Refresh interval must be between 15 and 1440 minutes');
				return;
			}

			try {
				addButton.textContent = 'Adding...';
				addButton.disabled = true;

				const subscriptionData = {
					name,
					type,
					color,
					refreshInterval,
					enabled,
					...(type === 'remote' ? { url } : { filePath })
				};

				await this.plugin.icsSubscriptionService!.addSubscription(subscriptionData);

				new Notice(`Added ${type} subscription "${name}"`);

				// Clear the form
				nameInput.value = '';
				urlInput.value = '';
				fileSelect.value = '';
				colorInput.value = '#3788d8';
				intervalInput.value = '60';
				enabledCheckbox.checked = true;
				typeSelect.value = 'remote';
				urlRow.style.display = 'flex';
				fileRow.style.display = 'none';

				// Refresh the subscription list
				this.renderActiveTab();
			} catch (error) {
				console.error('Error adding subscription:', error);
				new Notice('Failed to add subscription');
			} finally {
				addButton.textContent = 'Add Subscription';
				addButton.disabled = false;
			}
		});

		// Refresh all button
		new Setting(container)
			.setName('Refresh all subscriptions')
			.setDesc('Manually refresh all enabled calendar subscriptions')
			.addButton(button => button
				.setButtonText('Refresh all')
				.onClick(async () => {
					if (this.plugin.icsSubscriptionService) {
						button.setButtonText('Refreshing...');
						button.setDisabled(true);
						try {
							await this.plugin.icsSubscriptionService.refreshAllSubscriptions();
							new Notice('All calendar subscriptions refreshed successfully');
						} catch (error) {
							console.error('Error refreshing subscriptions:', error);
							new Notice('Failed to refresh some calendar subscriptions');
						} finally {
							button.setButtonText('Refresh all');
							button.setDisabled(false);
						}
					}
				}));

		// Help section
		const helpContainer = container.createDiv('settings-help-section');
		helpContainer.createEl('h4', { text: 'Calendar sources:' });

		// Remote URLs section
		helpContainer.createEl('h5', { text: 'Remote calendar URLs:' });
		const urlHelpList = helpContainer.createEl('ul');
		urlHelpList.createEl('li', { text: 'Google Calendar: Settings → Calendar settings → Integrate calendar → Secret address in iCal format' });
		urlHelpList.createEl('li', { text: 'Outlook/Office 365: Calendar settings → Share calendar → Publish a calendar → ICS format' });
		urlHelpList.createEl('li', { text: 'Other services: Look for "Calendar subscription", "ICS feed", "iCal URL", or "Webcal" options' });

		// Local files section
		helpContainer.createEl('h5', { text: 'Local ICS files:' });
		const fileHelpList = helpContainer.createEl('ul');
		fileHelpList.createEl('li', { text: 'Place .ics files anywhere in your vault' });
		fileHelpList.createEl('li', { text: 'Export from Apple Calendar: File → Export → Export as .ics file' });
		fileHelpList.createEl('li', { text: 'Export from Google Calendar: Settings → Export → Download your data' });
		fileHelpList.createEl('li', { text: 'Files are automatically watched for changes and refreshed' });

		helpContainer.createEl('p', {
			text: 'Important: For Google Calendar remote URLs, you must use the "Secret address" (private URL) from your calendar settings. The calendar must be set to "Make available to public" for the secret URL to work.',
			cls: 'settings-help-note'
		});

		helpContainer.createEl('p', {
			text: 'Note: Only read-only access is supported. You cannot edit calendar events from within TaskNotes.',
			cls: 'settings-help-note'
		});

		// ICS Integration Settings
		new Setting(container).setName('Content creation from events').setHeading();

		new Setting(container)
			.setName('Default note template')
			.setDesc('Template file for notes created from ICS events (leave empty for default format)')
			.addText(text => text
				.setValue(this.plugin.settings.icsIntegration?.defaultNoteTemplate || '')
				.setPlaceholder('templates/ics-note-template.md')
				.onChange(async (value) => {
					if (!this.plugin.settings.icsIntegration) {
						this.plugin.settings.icsIntegration = {
							defaultNoteTemplate: '',
							defaultNoteFolder: '',
							icsNoteFilenameFormat: 'title',
							customICSNoteFilenameTemplate: '{title}'
						};
					}
					this.plugin.settings.icsIntegration.defaultNoteTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Default note folder')
			.setDesc('Folder for notes created from ICS events (leave empty for vault root)')
			.addText(text => text
				.setValue(this.plugin.settings.icsIntegration?.defaultNoteFolder || '')
				.setPlaceholder('Notes/Calendar Events')
				.onChange(async (value) => {
					if (!this.plugin.settings.icsIntegration) {
						this.plugin.settings.icsIntegration = {
							defaultNoteTemplate: '',
							defaultNoteFolder: '',
							icsNoteFilenameFormat: 'title',
							customICSNoteFilenameTemplate: '{title}'
						};
					}
					this.plugin.settings.icsIntegration.defaultNoteFolder = value;
					await this.plugin.saveSettings();
				}));

		// Filename settings for ICS event notes
		new Setting(container).setName('Filename format for calendar event notes').setHeading();

		new Setting(container)
			.setName('Filename format')
			.setDesc('How to name notes created from calendar events')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'title': 'Event title',
					'zettel': 'Zettelkasten (YYMMDD + time)',
					'timestamp': 'Timestamp (YYYY-MM-DD-HHMMSS)',
					'custom': 'Custom template'
				})
				.setValue(this.plugin.settings.icsIntegration?.icsNoteFilenameFormat || 'title')
				.onChange(async (value: 'title' | 'zettel' | 'timestamp' | 'custom') => {
					if (!this.plugin.settings.icsIntegration) {
						this.plugin.settings.icsIntegration = {
							defaultNoteTemplate: '',
							defaultNoteFolder: '',
							icsNoteFilenameFormat: 'title',
							customICSNoteFilenameTemplate: '{title}'
						};
					}
					this.plugin.settings.icsIntegration.icsNoteFilenameFormat = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		// Custom template setting (conditional)
		if (this.plugin.settings.icsIntegration?.icsNoteFilenameFormat === 'custom') {
			new Setting(container)
				.setName('Custom filename template for ICS notes')
				.setDesc('Template for custom filename format. Available variables: {title} (event title), {icsEventTitleWithDate} (event title + date), {icsEventLocation}, {icsEventDescription}, {date}, {time}, {timestamp}, etc.')
				.addText(text => {
					text.inputEl.setAttribute('aria-label', 'Custom ICS note filename template with variables');
					return text
						.setValue(this.plugin.settings.icsIntegration?.customICSNoteFilenameTemplate || '{title}')
						.onChange(async (value) => {
							if (!this.plugin.settings.icsIntegration) {
								this.plugin.settings.icsIntegration = {
									defaultNoteTemplate: '',
									defaultNoteFolder: '',
									icsNoteFilenameFormat: 'title',
									customICSNoteFilenameTemplate: '{title}'
								};
							}
							this.plugin.settings.icsIntegration.customICSNoteFilenameTemplate = value;
							await this.plugin.saveSettings();
						});
				});
		}
	}

	private renderNotificationsTab(): void {
		const container = this.tabContents['notifications'];

		new Setting(container).setName('Notifications').setHeading();

		container.createEl('p', {
			text: 'Configure task reminder notifications.',
			cls: 'settings-help-note'
		});

		new Setting(container)
			.setName('Enable reminders')
			.setDesc('Enable the task reminder system. When disabled, no reminder notifications will be shown.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableNotifications)
				.onChange(async (value) => {
					this.plugin.settings.enableNotifications = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Notification type')
			.setDesc('Choose how reminder notifications are displayed.')
			.addDropdown(dropdown => dropdown
				.addOption('system', 'System notifications')
				.addOption('in-app', 'In-app notices')
				.setValue(this.plugin.settings.notificationType)
				.onChange(async (value: 'system' | 'in-app') => {
					this.plugin.settings.notificationType = value;
					await this.plugin.saveSettings();
				}));

		// Additional info about system notifications
		const systemNotesEl = container.createDiv({ cls: 'setting-item-description' });
		const systemDesc = systemNotesEl.createDiv();
		const systemLine1 = systemDesc.createDiv();
		systemLine1.createEl('strong', { text: 'System notifications:' });
		systemLine1.appendText(' Use your operating system\'s native notification system. Requires permission and works even when Obsidian is minimized.');

		const systemLine2 = systemDesc.createDiv();
		systemLine2.createEl('strong', { text: 'In-app notices:' });
		systemLine2.appendText(' Show notifications as temporary popups within Obsidian only.');

	}

	private renderAPITab(): void {
		const container = this.tabContents['api'];

		// Show message on mobile
		if (Platform.isMobile) {
			const mobileMessage = container.createDiv({ cls: 'setting-item-description' });
			const mobileContainer = mobileMessage.createDiv({
				attr: { style: 'text-align: center; padding: 2rem; color: var(--text-muted);' }
			});
			mobileContainer.createEl('h3', { text: 'HTTP API not available on mobile' });
			mobileContainer.createEl('p', { text: 'The HTTP API feature requires Node.js capabilities that are only available on desktop platforms.' });
			mobileContainer.createEl('p', { text: 'This tab will be available when using TaskNotes on desktop.' });
			return;
		}

		container.createEl('h2', { text: 'HTTP API Settings' });

		// API description
		const descEl = container.createDiv({ cls: 'setting-item-description' });
		descEl.createEl('p', { text: 'Enable HTTP API server to allow external tools and scripts to interact with your TaskNotes data.' });
		const noteP = descEl.createEl('p');
		noteP.createEl('strong', { text: 'Note:' });
		noteP.appendText(' This feature is only available on desktop. Restart Obsidian after changing API settings.');

		new Setting(container)
			.setName('Enable HTTP API')
			.setDesc('Enable HTTP API server for external tool integration.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAPI)
				.onChange(async (value) => {
					this.plugin.settings.enableAPI = value;
					await this.plugin.saveSettings();
					if (value) {
						new Notice('API enabled. Restart Obsidian to start the server.');
					} else {
						new Notice('API disabled. Restart Obsidian to stop the server.');
					}
				}));

		new Setting(container)
			.setName('API Port')
			.setDesc('Port for the HTTP API server (default: 8080)')
			.addText(text => text
				.setPlaceholder('8080')
				.setValue(this.plugin.settings.apiPort.toString())
				.onChange(async (value) => {
					const port = parseInt(value) || 8080;
					if (port < 1024 || port > 65535) {
						new Notice('Port must be between 1024 and 65535');
						return;
					}
					this.plugin.settings.apiPort = port;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('API Authentication Token')
			.setDesc('Optional token for API authentication. Leave empty to disable authentication.')
			.addText(text => text
				.setPlaceholder('Optional authentication token')
				.setValue(this.plugin.settings.apiAuthToken)
				.onChange(async (value) => {
					this.plugin.settings.apiAuthToken = value;
					await this.plugin.saveSettings();
				}));

		// Webhook settings section
		container.createEl('h3', { text: 'Webhook Settings' });

		const webhookDescEl = container.createDiv({ cls: 'setting-item-description' });
		webhookDescEl.createEl('p', { text: 'Webhooks send real-time notifications to external services when TaskNotes events occur.' });
		webhookDescEl.createEl('p', { text: 'Configure webhooks to integrate with automation tools, sync services, or custom applications.' });

		// Webhook management
		this.renderWebhookList(container);

		// Add webhook button
		new Setting(container)
			.setName('Add Webhook')
			.setDesc('Register a new webhook endpoint')
			.addButton(button => button
				.setButtonText('Add Webhook')
				.setTooltip('Add a new webhook endpoint')
				.onClick(() => {
					this.showWebhookModal();
				}));

		// API documentation section
		container.createEl('h3', { text: 'API Documentation' });

		const apiInfoEl = container.createDiv({ cls: 'setting-item-description' });
		// Available Endpoints
		apiInfoEl.createEl('h4', { text: 'Available Endpoints:' });
		const endpointsList = apiInfoEl.createEl('ul', { attr: { style: 'margin-left: 1rem;' } });

		const endpoints = [
			{ method: 'GET', path: '/api/health', desc: 'Health check' },
			{ method: 'GET', path: '/api/tasks', desc: 'List tasks with optional filters' },
			{ method: 'POST', path: '/api/tasks', desc: 'Create new task' },
			{ method: 'GET', path: '/api/tasks/{id}', desc: 'Get specific task' },
			{ method: 'PUT', path: '/api/tasks/{id}', desc: 'Update task' },
			{ method: 'DELETE', path: '/api/tasks/{id}', desc: 'Delete task' },
			{ method: 'POST', path: '/api/tasks/{id}/time/start', desc: 'Start time tracking' },
			{ method: 'POST', path: '/api/tasks/{id}/time/stop', desc: 'Stop time tracking' },
			{ method: 'POST', path: '/api/tasks/{id}/toggle-status', desc: 'Toggle completion' },
			{ method: 'POST', path: '/api/tasks/{id}/archive', desc: 'Toggle archive' },
			{ method: 'POST', path: '/api/tasks/query', desc: 'Advanced filtering' },
			{ method: 'GET', path: '/api/filter-options', desc: 'Available filters' },
			{ method: 'GET', path: '/api/stats', desc: 'Task statistics' }
		];

		endpoints.forEach(endpoint => {
			const li = endpointsList.createEl('li');
			li.createEl('code', { text: `${endpoint.method} ${endpoint.path}` });
			li.appendText(` - ${endpoint.desc}`);
		});

		// Usage Examples
		apiInfoEl.createEl('h4', { text: 'Usage Examples:' });

		const basicP = apiInfoEl.createEl('p');
		basicP.createEl('strong', { text: 'Basic request:' });
		apiInfoEl.createEl('pre').createEl('code', {
			text: `curl http://localhost:${this.plugin.settings.apiPort}/api/tasks`
		});

		const authP = apiInfoEl.createEl('p');
		authP.createEl('strong', { text: 'With authentication:' });
		apiInfoEl.createEl('pre').createEl('code', {
			text: `curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:${this.plugin.settings.apiPort}/api/tasks`
		});

		const createP = apiInfoEl.createEl('p');
		createP.createEl('strong', { text: 'Create task:' });
		apiInfoEl.createEl('pre').createEl('code', {
			text: `curl -X POST http://localhost:${this.plugin.settings.apiPort}/api/tasks \\\n  -H "Content-Type: application/json" \\\n  -d '{"title": "New task", "priority": "High"}'`
		});

		const filterP = apiInfoEl.createEl('p');
		filterP.createEl('strong', { text: 'Filter tasks:' });
		apiInfoEl.createEl('pre').createEl('code', {
			text: `curl "http://localhost:${this.plugin.settings.apiPort}/api/tasks?status=open&priority=High"`
		});
	}

	private renderMiscTab(): void {
		const container = this.tabContents['misc'];

		// Misc settings
		new Setting(container).setName('Miscellaneous settings').setHeading();

		container.createEl('p', {
			text: 'Configure various plugin features and display options.',
			cls: 'settings-help-note'
		});

		// Experimental / Bases POC
		new Setting(container).setName('Experimental / Bases POC').setHeading();
		new Setting(container)
			.setName('Enable Bases integration (POC)')
			.setDesc('Registers TaskNotes views with Obsidian Bases when the Bases plugin is available. Default off.')
			.addToggle(toggle => toggle
				.setValue(!!this.plugin.settings.enableBasesPOC)
				.onChange(async (value) => {
					this.plugin.settings.enableBasesPOC = value;
					await this.plugin.saveSettings();
				}));
		new Setting(container)
			.setName('Enable Bases POC logs')
			.setDesc('Log extra diagnostics to console for Bases integration components')
			.addToggle(toggle => toggle
				.setValue(!!this.plugin.settings.basesPOCLogs)
				.onChange(async (value) => {
					this.plugin.settings.basesPOCLogs = value;
					await this.plugin.saveSettings();
				}));

		// Status bar toggle
		new Setting(container)
			.setName('Show tracked tasks in status bar')
			.setDesc('Display currently tracked tasks (with active time tracking) in the status bar at the bottom of the app')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show tracked tasks in status bar');
				return toggle
					.setValue(this.plugin.settings.showTrackedTasksInStatusBar)
					.onChange(async (value) => {
						this.plugin.settings.showTrackedTasksInStatusBar = value;
						await this.plugin.saveSettings();
						// Update status bar visibility immediately
						if (this.plugin.statusBarService) {
							this.plugin.statusBarService.updateVisibility();
						}
					});
			});

		// Project subtasks widget toggle
		new Setting(container)
			.setName('Show project subtasks widget')
			.setDesc('Display a collapsible widget showing all tasks that reference the current note as a project')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show project subtasks widget');
				return toggle
					.setValue(this.plugin.settings.showProjectSubtasks)
					.onChange(async (value) => {
						this.plugin.settings.showProjectSubtasks = value;
						await this.plugin.saveSettings();
						// Refresh all open editors to apply the change
						this.plugin.notifyDataChanged();
					});
			});

		// Project subtasks widget position
		new Setting(container)
			.setName('Project subtasks widget position')
			.setDesc('Choose where the subtasks widget appears in project notes')
			.addDropdown(dropdown => {
				dropdown
					.addOption('top', 'Top of note')
					.addOption('bottom', 'Bottom of note')
					.setValue(this.plugin.settings.projectSubtasksPosition || 'bottom')
					.onChange(async (value: 'top' | 'bottom') => {
						this.plugin.settings.projectSubtasksPosition = value;
						await this.plugin.saveSettings();
						// Refresh all open editors to apply the change
						this.plugin.notifyDataChanged();
					});
			});

		// Expandable subtasks in task cards
		new Setting(container)
			.setName('Show expandable subtasks in task cards')
			.setDesc('Add a chevron icon to project task cards that allows expanding to view subtasks inline')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Show expandable subtasks in task cards');
				return toggle
					.setValue(this.plugin.settings.showExpandableSubtasks)
					.onChange(async (value) => {
						this.plugin.settings.showExpandableSubtasks = value;
						await this.plugin.saveSettings();
						// Refresh task views to apply the change
						this.plugin.notifyDataChanged();
					});
			});

			// Subtask chevron position
			new Setting(container)
				.setName('Subtask chevron position')
				.setDesc('Choose where the expand/collapse chevron appears on task cards')
				.addDropdown(dropdown => {
					dropdown.selectEl.setAttribute('aria-label', 'Subtask chevron position on task cards');
					return dropdown
						.addOption('right', 'Right (default)')
						.addOption('left', 'Left (match group chevrons)')
						.setValue(this.plugin.settings.subtaskChevronPosition || 'right')
						.onChange(async (value: 'left' | 'right') => {
							this.plugin.settings.subtaskChevronPosition = value;
							await this.plugin.saveSettings();
							// Refresh task views to apply the change
							this.plugin.notifyDataChanged();
						});
				});

		// Hide completed tasks from overdue

			// Status suggestion trigger (NLP)
			new Setting(container)
				.setName('Status suggestion trigger')
				.setDesc('Type this pattern before a status to see suggestions in the task creation input. Leave empty to disable. Avoid @, #, + which are reserved.')
				.addText(text => {
					text
						.setPlaceholder('*')
						.setValue(this.plugin.settings.statusSuggestionTrigger || '')
						.onChange(async (value) => {
							// Normalize and basic validation: keep small length, avoid reserved triggers
							const trimmed = value.trim();
							const reserved = ['@', '#', '+'];
							if (reserved.includes(trimmed)) {
								new Notice('This trigger conflicts with existing triggers (@, #, +). Please choose another.');
								return;
							}
							if (trimmed.length > 3) {
								new Notice('Please use a short trigger (max 3 characters).');
								return;
							}
							this.plugin.settings.statusSuggestionTrigger = trimmed; // empty disables
							await this.plugin.saveSettings();
						});
				});

		new Setting(container)
			.setName('Hide completed tasks from overdue')
			.setDesc('When enabled, completed tasks will not appear as overdue in the agenda view, even if their due/scheduled date has passed')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Hide completed tasks from overdue status');
				return toggle
					.setValue(this.plugin.settings.hideCompletedFromOverdue)
					.onChange(async (value) => {
						this.plugin.settings.hideCompletedFromOverdue = value;
						await this.plugin.saveSettings();
						// Refresh views to apply the change
						this.plugin.notifyDataChanged();
					});
			});


			// Views button alignment
			new Setting(container)
				.setName('Views button alignment')
				.setDesc('Choose the position of the "Views" button in the filter toolbar')
				.addDropdown((dropdown) => {
					dropdown
						.addOption('right', 'Right (Default)')
						.addOption('left', 'Left')
						.setValue(this.plugin.settings.viewsButtonAlignment || 'right')
						.onChange(async (value: 'left' | 'right') => {
							this.plugin.settings.viewsButtonAlignment = value;
							await this.plugin.saveSettings();
							// Refresh views to apply the change
							this.plugin.notifyDataChanged();
						});
				});

		// Notes indexing toggle
		new Setting(container)
			.setName('Disable note indexing')
			.setDesc('Disable indexing and caching of non-task notes to improve performance in large vaults. Note: This will disable the Notes view and notes display in the Agenda view. Requires plugin restart to take effect.')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Disable note indexing for better performance');
				return toggle
					.setValue(this.plugin.settings.disableNoteIndexing)
					.onChange(async (value) => {
						this.plugin.settings.disableNoteIndexing = value;
						await this.plugin.saveSettings();

						// Show notice about restart requirement
						new Notice('Note indexing setting changed. Please restart Obsidian or reload the plugin for changes to take effect.');
					});
			});

		// Suggestion performance: optional debounce for inline file suggestions
		new Setting(container)
			.setName('Debounce inline suggestions (ms)')
			.setDesc('Optional delay before running inline file suggestions (useful for large vaults). Set 0 to disable.')
			.addText(text => text
				.setPlaceholder('0 (disabled)')
				.setValue(String(this.plugin.settings.suggestionDebounceMs ?? 0))
				.onChange(async (value) => {
					const n = parseInt(value, 10);
					if (isNaN(n) || n < 0) return;
					this.plugin.settings.suggestionDebounceMs = n;
					await this.plugin.saveSettings();
				}));

		// Click behavior settings
		new Setting(container)
			.setName('Single-click action')
			.setDesc('What happens when you single-click a task card')
			.addDropdown(dropdown => {
				dropdown
					.addOption('edit', 'Edit task')
					.addOption('openNote', 'Open note')
					.setValue(this.plugin.settings.singleClickAction)
					.onChange(async (value: 'edit' | 'openNote') => {
						this.plugin.settings.singleClickAction = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName('Double-click action')
			.setDesc('What happens when you double-click a task card')
			.addDropdown(dropdown => {
				dropdown
					.addOption('openNote', 'Open note')
					.addOption('edit', 'Edit task')
					.addOption('none', 'None')
					.setValue(this.plugin.settings.doubleClickAction)
					.onChange(async (value: 'edit' | 'openNote' | 'none') => {
						this.plugin.settings.doubleClickAction = value;
						await this.plugin.saveSettings();
					});
			});

		// Recurring task due date behavior
		new Setting(container)
			.setName('Maintain due date offset in recurring tasks')
			.setDesc('When completing a recurring task, move the due date by the same offset as the scheduled date to preserve the time separation between them')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Maintain due date offset in recurring tasks');
				return toggle
					.setValue(this.plugin.settings.maintainDueDateOffsetInRecurring)
					.onChange(async (value) => {
						this.plugin.settings.maintainDueDateOffsetInRecurring = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private renderFieldMappingTab(): void {
		const container = this.tabContents['field-mapping'];

		// Warning message
		const warning = container.createDiv('settings-warning settings-view__warning');
		const warningIcon = warning.createEl('strong', { cls: 'settings-view__warning-icon' });
		setIcon(warningIcon, 'alert-triangle');
		warningIcon.createSpan({ text: ' Warning:' });
		warning.createSpan({ text: ' TaskNotes will read AND write using these property names. Changing these after creating tasks may cause inconsistencies.' });

		new Setting(container)
			.setName('Field mapping')
			.setHeading();
		container.createEl('p', {
			text: 'Configure which frontmatter properties TaskNotes should use for each field.',
			cls: 'settings-help-note'
		});

		// Create mapping table
		const table = container.createEl('table', { cls: 'settings-table settings-view__table' });

		const header = table.createEl('tr');
		header.createEl('th', { cls: 'settings-view__table-header', text: 'TaskNotes field' });
		header.createEl('th', { cls: 'settings-view__table-header', text: 'Your property name' });

		const fieldMappings: Array<[keyof FieldMapping, string]> = [
			['title', 'Title'],
			['status', 'Status'],
			['priority', 'Priority'],
			['due', 'Due date'],
			['scheduled', 'Scheduled date'],
			['contexts', 'Contexts'],
			['projects', 'Projects'],
			['timeEstimate', 'Time estimate'],
				['completedDate', 'Completed date'],
			['dateCreated', 'Created date'],
			['dateModified', 'Modified date'],
			['recurrence', 'Recurrence'],
			['archiveTag', 'Archive tag'],
			['icsEventId', 'ICS Event ID'],
			['icsEventTag', 'ICS Event Tag']
		];

		fieldMappings.forEach(([field, label]) => {
			const row = table.createEl('tr', { cls: 'settings-view__table-row' });
			const labelCell = row.createEl('td', { cls: 'settings-view__table-cell' });
			labelCell.textContent = label;

			const inputCell = row.createEl('td', { cls: 'settings-view__table-cell' });

			const input = inputCell.createEl('input', {
				type: 'text',
				value: this.plugin.settings.fieldMapping[field],
				cls: 'settings-view__table-input',
				attr: {
					'aria-label': `Property name for ${label}`,
					'id': `field-mapping-${field}`
				}
			});

			input.addEventListener('change', async () => {
				try {
					this.plugin.settings.fieldMapping[field] = input.value;
					await this.plugin.saveSettings();
				} catch (error) {
					console.error(`Error updating field mapping for ${field}:`, error);
					new Notice(`Failed to update field mapping for ${label}. Please try again.`);
				}
			});
		});

		// Reset button
		new Setting(container)
			.setName('Reset to defaults')
			.setDesc('Reset all field mappings to default values')
			.addButton(button => button
				.setButtonText('Reset')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.fieldMapping = { ...DEFAULT_FIELD_MAPPING };
					await this.plugin.saveSettings();
					this.renderActiveTab();
				}));

			// User Fields (optional) section
			new Setting(container)
				.setName('User Fields (optional)')
				.setHeading();
			container.createEl('p', {
				text: 'Define one or more custom frontmatter properties to appear as type-aware filter options across views. Each row: Display Name, Property Name, Type.',
				cls: 'settings-help-note'
			});

			// Ensure array exists; migrate legacy single field if present
			if (!Array.isArray(this.plugin.settings.userFields)) {
				this.plugin.settings.userFields = [];
			}
			if (this.plugin.settings.userField && this.plugin.settings.userField.enabled) {
				const legacy = this.plugin.settings.userField;
				const id = (legacy.displayName || legacy.key || 'field').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
				if (!this.plugin.settings.userFields.find(f => (f.id === id) || (f.key === legacy.key))) {
					this.plugin.settings.userFields.push({ id, displayName: legacy.displayName || '', key: legacy.key || '', type: legacy.type || 'text' });
				}
				// Keep legacy for now (migration step), but no longer render single-field UI
			}

			// Column headers
			const headersRow = container.createDiv('settings-headers-row settings-view__list-headers user-fields');
			headersRow.createEl('span', { text: 'Display Name', cls: 'settings-column-header settings-view__column-header' });
			headersRow.createEl('span', { text: 'Property Name', cls: 'settings-column-header settings-view__column-header' });
			headersRow.createEl('span', { text: 'Type', cls: 'settings-column-header settings-view__column-header' });
			headersRow.createDiv('settings-header-spacer settings-view__header-spacer'); // For delete button space

			// User fields list
			const userFieldsList = container.createDiv('settings-list settings-view__list');
			userFieldsList.addClass('user-fields');

			this.renderUserFieldsList(userFieldsList);

			// Add field button
			new Setting(container)
				.setName('Add new user field')
				.setDesc('Create a new custom property for filtering')
				.addButton(button => button
					.setButtonText('Add field')
					.onClick(async () => {
						const id = `fld_${Date.now()}`;
						this.plugin.settings.userFields!.push({ id, key: '', displayName: '', type: 'text' });
						await this.plugin.saveSettings();
						// Immediately refresh FilterBar options in open views
						this.plugin.filterService?.refreshFilterOptions();
						const refreshed = await this.plugin.filterService.getFilterOptions();
						const viewTypes = ['tasknotes-task-list-view','tasknotes-agenda-view','tasknotes-kanban-view','tasknotes-advanced-calendar-view'];
						for (const t of viewTypes) {
							for (const leaf of this.app.workspace.getLeavesOfType(t)) {
								const v: any = (leaf as any).view;
								if (v?.filterBar?.updateFilterOptions) {
									v.filterBar.updateFilterOptions(refreshed);
								}
							}
						}
						this.renderActiveTab();
					}));


	}

	private renderUserFieldsList(container: HTMLElement): void {
		container.empty();

		const userFields = this.plugin.settings.userFields || [];

		userFields.forEach((field, index) => {
			const fieldRow = container.createDiv('settings-item-row settings-view__item-row user-fields');

			// Display Name input
			const nameInput = fieldRow.createEl('input', {
				type: 'text',
				value: field.displayName || '',
				cls: 'settings-input name-input settings-view__input settings-view__input--label',
				attr: {
					'placeholder': 'Effort',
					'aria-label': `Display name for ${field.displayName || 'user field'}`,
					'id': `user-field-name-${field.id}`
				}
			});

			// Property Name input
			const keyInput = fieldRow.createEl('input', {
				type: 'text',
				value: field.key || '',
				cls: 'settings-input key-input settings-view__input settings-view__input--value',
				attr: {
					'placeholder': 'effort',
					'aria-label': `Property name for ${field.displayName || 'user field'}`,
					'id': `user-field-key-${field.id}`
				}
			});

			// Type dropdown
			const typeSelect = fieldRow.createEl('select', {
				cls: 'settings-input type-select settings-view__input settings-view__input--select',
				attr: {
					'aria-label': `Type for ${field.displayName || 'user field'}`,
					'id': `user-field-type-${field.id}`
				}
			});

			// Add type options
			const typeOptions = [
				{ value: 'text', label: 'Text' },
				{ value: 'number', label: 'Number' },
				{ value: 'date', label: 'Date' },
				{ value: 'boolean', label: 'Boolean' },
				{ value: 'list', label: 'List' }
			];

			typeOptions.forEach(option => {
				const optionEl = typeSelect.createEl('option', {
					value: option.value,
					text: option.label
				});
				if (field.type === option.value) {
					optionEl.selected = true;
				}
			});

			// Delete button
			const deleteButton = fieldRow.createEl('button', {
				text: 'Delete',
				cls: 'settings-delete-button settings-view__delete-button'
			});

			// Event listeners
			const updateField = async () => {
				try {
					field.key = keyInput.value.trim();
					field.displayName = nameInput.value;
					field.type = typeSelect.value as any;
					if (!field.id) {
						field.id = (field.displayName || field.key || 'field').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
					}
					await this.plugin.saveSettings();
				} catch (error) {
					console.error('Error updating user field configuration:', error);
					new Notice('Failed to update user field configuration. Please try again.');
				}
			};

			keyInput.addEventListener('change', updateField);
			nameInput.addEventListener('change', updateField);
			typeSelect.addEventListener('change', updateField);

			// Also refresh FilterBar options when a user field row is updated
			const refreshFilterBarOptions = async () => {
				this.plugin.filterService?.refreshFilterOptions();
				const refreshed = await this.plugin.filterService.getFilterOptions();
				const viewTypes = ['tasknotes-task-list-view','tasknotes-agenda-view','tasknotes-kanban-view','tasknotes-advanced-calendar-view'];
				for (const t of viewTypes) {
					for (const leaf of this.app.workspace.getLeavesOfType(t)) {
						const v: any = (leaf as any).view;
						if (v?.filterBar?.updateFilterOptions) {
							v.filterBar.updateFilterOptions(refreshed);
						}
					}
				}
			};
			keyInput.addEventListener('change', refreshFilterBarOptions);
			nameInput.addEventListener('change', refreshFilterBarOptions);
			typeSelect.addEventListener('change', refreshFilterBarOptions);

			deleteButton.addEventListener('click', async () => {
				// Show confirmation dialog using Obsidian's Modal API
				const confirmed = await showConfirmationModal(this.app, {
					title: 'Delete User Field',
					message: `Are you sure you want to delete the user field "${field.displayName || field.key}"?\n\nThis action cannot be undone and may affect existing filters.`,
					confirmText: 'Delete',
					cancelText: 'Cancel',
					isDestructive: true
				});

				if (confirmed) {
					const fieldIndex = this.plugin.settings.userFields!.findIndex(f => f.id === field.id);
					if (fieldIndex !== -1) {
						this.plugin.settings.userFields!.splice(fieldIndex, 1);
						await this.plugin.saveSettings();
						// Immediately refresh FilterBar options in open views
						this.plugin.filterService?.refreshFilterOptions();
						const refreshed = await this.plugin.filterService.getFilterOptions();
						const viewTypes = ['tasknotes-task-list-view','tasknotes-agenda-view','tasknotes-kanban-view','tasknotes-advanced-calendar-view'];
						for (const t of viewTypes) {
							for (const leaf of this.app.workspace.getLeavesOfType(t)) {
								const v: any = (leaf as any).view;
								if (v?.filterBar?.updateFilterOptions) {
									v.filterBar.updateFilterOptions(refreshed);
								}
							}
						}
						this.renderActiveTab();
					}
				}
			});
		});
	}

	private renderStatusesTab(): void {
		const container = this.tabContents['statuses'];

		new Setting(container)
			.setName('Task statuses')
			.setHeading();

		// Description section
		container.createEl('p', {
			text: 'Customize the status options available for your tasks. These statuses control the task lifecycle and determine when tasks are considered complete.',
			cls: 'settings-help-note'
		});

		// Help section
		const helpContainer = container.createDiv('settings-help-section');
		helpContainer.createEl('h4', { text: 'How statuses work:' });
		const helpList = helpContainer.createEl('ul');
		helpList.createEl('li', { text: 'Value: The internal identifier stored in your task files (e.g., "in-progress")' });
		helpList.createEl('li', { text: 'Label: The display name shown in the interface (e.g., "In Progress")' });
		helpList.createEl('li', { text: 'Color: Visual indicator color for the status dot and badges' });
		helpList.createEl('li', { text: 'Completed: When checked, tasks with this status are considered finished and may be filtered differently' });

		helpContainer.createEl('p', {
			text: 'The order below determines the sequence when cycling through statuses by clicking on task status badges.',
			cls: 'settings-help-note'
		});

		// Column headers
		const headersRow = container.createDiv('settings-headers-row settings-view__list-headers');
		headersRow.createDiv('settings-header-spacer settings-view__header-spacer'); // For drag handle space
		headersRow.createDiv('settings-header-spacer settings-view__header-spacer'); // For color indicator space
		headersRow.createEl('span', { text: 'Value', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createEl('span', { text: 'Display Label', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createEl('span', { text: 'Color', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createEl('span', { text: 'Mark as Completed', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createDiv('settings-header-spacer settings-view__header-spacer'); // For delete button space

		// Status list
		const statusList = container.createDiv('settings-list settings-view__list');

		this.renderStatusList(statusList);

		// Add status button
		new Setting(container)
			.setName('Add new status')
			.setDesc('Create a new status option for your tasks')
			.addButton(button => button
				.setButtonText('Add status')
				.onClick(async () => {
					const newStatus = StatusManager.createDefaultStatus(this.plugin.settings.customStatuses);
					this.plugin.settings.customStatuses.push(newStatus);
					await this.plugin.saveSettings();
					this.renderActiveTab();
				}));

		// Validation note
		container.createEl('p', {
			text: 'Note: You must have at least 2 statuses, and at least one status must be marked as "Completed".',
			cls: 'settings-validation-note'
		});
	}

	private renderStatusList(container: HTMLElement): void {
		container.empty();

		const sortedStatuses = [...this.plugin.settings.customStatuses].sort((a, b) => a.order - b.order);

		sortedStatuses.forEach((status, index) => {
			const statusRow = container.createDiv('settings-item-row settings-view__item-row');
			statusRow.setAttribute('draggable', 'true');
			statusRow.setAttribute('data-status-id', status.id);

			// Drag handle
			const dragHandle = statusRow.createDiv('settings-drag-handle');
			dragHandle.textContent = '☰';
			setTooltip(dragHandle, 'Drag to reorder', { placement: 'top' });

			// Color indicator
			const colorIndicator = statusRow.createDiv('settings-color-indicator settings-view__color-indicator');
			colorIndicator.style.setProperty('--indicator-color', status.color);

			// Status value input
			const valueInput = statusRow.createEl('input', {
				type: 'text',
				value: status.value,
				cls: 'settings-input value-input settings-view__input settings-view__input--value',
				attr: {
					'aria-label': `Status value for ${status.label}`,
					'id': `status-value-${status.id}`
				}
			});

			// Status label input
			const labelInput = statusRow.createEl('input', {
				type: 'text',
				value: status.label,
				cls: 'settings-input label-input settings-view__input settings-view__input--label',
				attr: {
					'aria-label': `Display label for ${status.label} status`,
					'id': `status-label-${status.id}`
				}
			});

			// Color input
			const colorInput = statusRow.createEl('input', {
				type: 'color',
				value: status.color,
				cls: 'settings-input color-input settings-view__input settings-view__input--color',
				attr: {
					'aria-label': `Color for ${status.label} status`,
					'id': `status-color-${status.id}`
				}
			});

			// Completed checkbox
			const completedLabel = statusRow.createEl('label', {
				cls: 'settings-checkbox-label settings-view__checkbox-label',
				attr: { 'for': `status-completed-${status.id}` }
			});

			const completedCheckbox = completedLabel.createEl('input', {
				type: 'checkbox',
				cls: 'settings-view__checkbox',
				attr: {
					'id': `status-completed-${status.id}`,
					'aria-label': `Mark ${status.label} as completed status`
				}
			});
			completedCheckbox.checked = status.isCompleted;

			completedLabel.createSpan({ text: 'Completed' });

			// Delete button
			const deleteButton = statusRow.createEl('button', {
				text: 'Delete',
				cls: 'settings-delete-button settings-view__delete-button'
			});

			// Event listeners
			const updateStatus = async () => {
				try {
					status.value = valueInput.value;
					status.label = labelInput.value;
					status.color = colorInput.value;
					status.isCompleted = completedCheckbox.checked;
					await this.plugin.saveSettings();
					colorIndicator.style.setProperty('--indicator-color', status.color);
				} catch (error) {
					console.error('Error updating status configuration:', error);
					new Notice('Failed to update status configuration. Please try again.');
				}
			};

			valueInput.addEventListener('change', updateStatus);
			labelInput.addEventListener('change', updateStatus);
			colorInput.addEventListener('change', updateStatus);
			completedCheckbox.addEventListener('change', updateStatus);

			deleteButton.addEventListener('click', async () => {
				if (this.plugin.settings.customStatuses.length <= 2) {
					new Notice('You must have at least 2 statuses');
					return;
				}

				// Show confirmation dialog using Obsidian's Modal API
				const confirmed = await showConfirmationModal(this.app, {
					title: 'Delete Status',
					message: `Are you sure you want to delete the status "${status.label}"?\n\nThis action cannot be undone and may affect existing tasks.`,
					confirmText: 'Delete',
					cancelText: 'Cancel',
					isDestructive: true
				});

				if (confirmed) {
					const statusIndex = this.plugin.settings.customStatuses.findIndex(s => s.id === status.id);
					if (statusIndex !== -1) {
						this.plugin.settings.customStatuses.splice(statusIndex, 1);
						await this.plugin.saveSettings();
						this.renderActiveTab();
					}
				}
			});

			// Drag and drop event handlers
			statusRow.addEventListener('dragstart', (e) => {
				e.dataTransfer!.setData('text/plain', status.id);
				statusRow.classList.add('dragging');
			});

			statusRow.addEventListener('dragend', () => {
				statusRow.classList.remove('dragging');
			});

			statusRow.addEventListener('dragover', (e) => {
				e.preventDefault();
				const draggingRow = container.querySelector('.dragging') as HTMLElement;
				if (draggingRow && draggingRow !== statusRow) {
					const rect = statusRow.getBoundingClientRect();
					const midpoint = rect.top + rect.height / 2;
					if (e.clientY < midpoint) {
						statusRow.classList.add('drag-over-top');
						statusRow.classList.remove('drag-over-bottom');
					} else {
						statusRow.classList.add('drag-over-bottom');
						statusRow.classList.remove('drag-over-top');
					}
				}
			});

			statusRow.addEventListener('dragleave', () => {
				statusRow.classList.remove('drag-over-top', 'drag-over-bottom');
			});

			statusRow.addEventListener('drop', async (e) => {
				e.preventDefault();
				statusRow.classList.remove('drag-over-top', 'drag-over-bottom');

				const draggedStatusId = e.dataTransfer!.getData('text/plain');
				const targetStatusId = status.id;

				if (draggedStatusId !== targetStatusId) {
					await this.reorderStatus(draggedStatusId, targetStatusId, e.clientY < statusRow.getBoundingClientRect().top + statusRow.getBoundingClientRect().height / 2);
				}
			});
		});
	}

	private async reorderStatus(draggedStatusId: string, targetStatusId: string, insertBefore: boolean): Promise<void> {
		const statuses = [...this.plugin.settings.customStatuses];

		// Find the dragged and target statuses
		const draggedIndex = statuses.findIndex(s => s.id === draggedStatusId);
		const targetIndex = statuses.findIndex(s => s.id === targetStatusId);

		if (draggedIndex === -1 || targetIndex === -1) {
			return;
		}

		// Remove the dragged status from its current position
		const [draggedStatus] = statuses.splice(draggedIndex, 1);

		// Determine the new position
		let newIndex = targetIndex;
		if (draggedIndex < targetIndex) {
			// If we removed an item before the target, adjust the target index
			newIndex--;
		}

		if (!insertBefore) {
			// Insert after the target
			newIndex++;
		}

		// Insert the dragged status at the new position
		statuses.splice(newIndex, 0, draggedStatus);

		// Update the order values
		statuses.forEach((status, index) => {
			status.order = index;
		});

		// Save the updated statuses
		this.plugin.settings.customStatuses = statuses;
		await this.plugin.saveSettings();

		// Re-render the list to reflect the new order
		this.renderActiveTab();
	}

	private renderPrioritiesTab(): void {
		const container = this.tabContents['priorities'];

		new Setting(container)
			.setName('Task priorities')
			.setHeading();

		// Description section
		container.createEl('p', {
			text: 'Customize the priority levels available for your tasks. Priority weights determine sorting order and visual hierarchy in your task views.',
			cls: 'settings-help-note'
		});

		// Help section
		const helpContainer = container.createDiv('settings-help-section');
		helpContainer.createEl('h4', { text: 'How priorities work:' });
		const helpList = helpContainer.createEl('ul');
		helpList.createEl('li', { text: 'Value: The internal identifier stored in your task files (e.g., "high")' });
		helpList.createEl('li', { text: 'Display Label: The display name shown in the interface (e.g., "High Priority")' });
		helpList.createEl('li', { text: 'Color: Visual indicator color for the priority dot and badges' });
		helpList.createEl('li', { text: 'Weight: Numeric value for sorting (higher weights appear first in lists)' });

		helpContainer.createEl('p', {
			text: 'Tasks are automatically sorted by priority weight in descending order (highest weight first). Weights can be any positive number.',
			cls: 'settings-help-note'
		});

		// Column headers
		const headersRow = container.createDiv('settings-headers-row settings-view__list-headers');
		headersRow.createDiv('settings-header-spacer settings-view__header-spacer'); // For color indicator space
		headersRow.createEl('span', { text: 'Value', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createEl('span', { text: 'Display Label', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createEl('span', { text: 'Color', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createEl('span', { text: 'Weight', cls: 'settings-column-header settings-view__column-header' });
		headersRow.createDiv('settings-header-spacer settings-view__header-spacer'); // For delete button space

		// Priority list
		const priorityList = container.createDiv('settings-list settings-view__list');

		this.renderPriorityList(priorityList);

		// Add priority button
		new Setting(container)
			.setName('Add new priority')
			.setDesc('Create a new priority level for your tasks')
			.addButton(button => button
				.setButtonText('Add priority')
				.onClick(async () => {
					const newPriority = PriorityManager.createDefaultPriority(this.plugin.settings.customPriorities);
					this.plugin.settings.customPriorities.push(newPriority);
					await this.plugin.saveSettings();
					this.renderActiveTab();
				}));

		// Validation note
		container.createEl('p', {
			text: 'Note: You must have at least 1 priority. Higher weights take precedence in sorting and visual hierarchy.',
			cls: 'settings-validation-note'
		});
	}

	private renderPriorityList(container: HTMLElement): void {
		container.empty();

		const sortedPriorities = [...this.plugin.settings.customPriorities].sort((a, b) => b.weight - a.weight);

		sortedPriorities.forEach((priority, index) => {
			const priorityRow = container.createDiv('settings-item-row settings-view__item-row');

			// Color indicator
			const colorIndicator = priorityRow.createDiv('settings-color-indicator settings-view__color-indicator');
			colorIndicator.style.setProperty('--indicator-color', priority.color);

			// Priority value input
			const valueInput = priorityRow.createEl('input', {
				type: 'text',
				value: priority.value,
				cls: 'settings-input value-input settings-view__input settings-view__input--value',
				attr: {
					'aria-label': `Priority value for ${priority.label}`,
					'id': `priority-value-${priority.id}`
				}
			});

			// Priority label input
			const labelInput = priorityRow.createEl('input', {
				type: 'text',
				value: priority.label,
				cls: 'settings-input label-input settings-view__input settings-view__input--label',
				attr: {
					'aria-label': `Display label for ${priority.label} priority`,
					'id': `priority-label-${priority.id}`
				}
			});

			// Color input
			const colorInput = priorityRow.createEl('input', {
				type: 'color',
				value: priority.color,
				cls: 'settings-input color-input settings-view__input settings-view__input--color',
				attr: {
					'aria-label': `Color for ${priority.label} priority`,
					'id': `priority-color-${priority.id}`
				}
			});

			// Weight input
			const weightInput = priorityRow.createEl('input', {
				type: 'number',
				value: priority.weight.toString(),
				cls: 'settings-input weight-input settings-view__input settings-view__input--weight',
				attr: {
					min: '0',
					step: '1',
					'aria-label': `Weight for ${priority.label} priority`,
					'id': `priority-weight-${priority.id}`
				}
			});

			// Delete button
			const deleteButton = priorityRow.createEl('button', {
				text: 'Delete',
				cls: 'settings-delete-button settings-view__delete-button'
			});

			// Event listeners
			const updatePriority = async () => {
				try {
					priority.value = valueInput.value;
					priority.label = labelInput.value;
					priority.color = colorInput.value;
					const weightValue = parseInt(weightInput.value);
					if (isNaN(weightValue) || weightValue < 0) {
						new Notice('Priority weight must be a valid positive number.');
						return;
					}
					priority.weight = weightValue;
					await this.plugin.saveSettings();
					colorIndicator.style.setProperty('--indicator-color', priority.color);
				} catch (error) {
					console.error('Error updating priority configuration:', error);
					new Notice('Failed to update priority configuration. Please try again.');
				}
			};

			valueInput.addEventListener('change', updatePriority);
			labelInput.addEventListener('change', updatePriority);
			colorInput.addEventListener('change', updatePriority);
			weightInput.addEventListener('change', updatePriority);

			deleteButton.addEventListener('click', async () => {
				if (this.plugin.settings.customPriorities.length <= 1) {
					new Notice('You must have at least 1 priority');
					return;
				}

				// Show confirmation dialog using Obsidian's Modal API
				const confirmed = await showConfirmationModal(this.app, {
					title: 'Delete Priority',
					message: `Are you sure you want to delete the priority "${priority.label}"?\n\nThis action cannot be undone and may affect existing tasks.`,
					confirmText: 'Delete',
					cancelText: 'Cancel',
					isDestructive: true
				});

				if (confirmed) {
					const priorityIndex = this.plugin.settings.customPriorities.findIndex(p => p.id === priority.id);
					if (priorityIndex !== -1) {
						this.plugin.settings.customPriorities.splice(priorityIndex, 1);
						await this.plugin.saveSettings();
						this.renderActiveTab();
					}
				}
			});
		});
	}


	private renderPomodoroTab(): void {
		const container = this.tabContents['pomodoro'];

		new Setting(container)
			.setName('Work duration')
			.setDesc('Duration of work intervals in minutes')
			.addText(text => text
				.setPlaceholder('25')
				.setValue(this.plugin.settings.pomodoroWorkDuration.toString())
				.onChange(async (value) => {
					try {
						const num = parseInt(value);
						if (isNaN(num) || num <= 0) {
							new Notice('Work duration must be a positive number.');
							return;
						}
						this.plugin.settings.pomodoroWorkDuration = num;
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error updating pomodoro work duration:', error);
						new Notice('Failed to update work duration setting.');
					}
				}));

		new Setting(container)
			.setName('Short break duration')
			.setDesc('Duration of short breaks in minutes')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.plugin.settings.pomodoroShortBreakDuration.toString())
				.onChange(async (value) => {
					try {
						const num = parseInt(value);
						if (isNaN(num) || num <= 0) {
							new Notice('Short break duration must be a positive number.');
							return;
						}
						this.plugin.settings.pomodoroShortBreakDuration = num;
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error updating pomodoro short break duration:', error);
						new Notice('Failed to update short break duration setting.');
					}
				}));

		new Setting(container)
			.setName('Long break duration')
			.setDesc('Duration of long breaks in minutes')
			.addText(text => text
				.setPlaceholder('15')
				.setValue(this.plugin.settings.pomodoroLongBreakDuration.toString())
				.onChange(async (value) => {
					try {
						const num = parseInt(value);
						if (isNaN(num) || num <= 0) {
							new Notice('Long break duration must be a positive number.');
							return;
						}
						this.plugin.settings.pomodoroLongBreakDuration = num;
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error updating pomodoro long break duration:', error);
						new Notice('Failed to update long break duration setting.');
					}
				}));

		new Setting(container)
			.setName('Long break interval')
			.setDesc('Take a long break after this many pomodoros')
			.addText(text => text
				.setPlaceholder('4')
				.setValue(this.plugin.settings.pomodoroLongBreakInterval.toString())
				.onChange(async (value) => {
					try {
						const num = parseInt(value);
						if (isNaN(num) || num <= 0) {
							new Notice('Long break interval must be a positive number.');
							return;
						}
						this.plugin.settings.pomodoroLongBreakInterval = num;
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error updating pomodoro long break interval:', error);
						new Notice('Failed to update long break interval setting.');
					}
				}));

		new Setting(container)
			.setName('Auto-start breaks')
			.setDesc('Automatically start break timer after work session')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.pomodoroAutoStartBreaks)
				.onChange(async (value) => {
					this.plugin.settings.pomodoroAutoStartBreaks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Auto-start work')
			.setDesc('Automatically start work timer after break')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.pomodoroAutoStartWork)
				.onChange(async (value) => {
					this.plugin.settings.pomodoroAutoStartWork = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Enable notifications')
			.setDesc('Show notifications when pomodoro sessions complete')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.pomodoroNotifications)
				.onChange(async (value) => {
					this.plugin.settings.pomodoroNotifications = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Enable sound')
			.setDesc('Play sound when pomodoro sessions complete')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.pomodoroSoundEnabled)
				.onChange(async (value) => {
					this.plugin.settings.pomodoroSoundEnabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Sound volume')
			.setDesc('Volume for completion sounds (0-100)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.plugin.settings.pomodoroSoundVolume)
				.setDynamicTooltip()
				.onChange(async (value) => {
					try {
						this.plugin.settings.pomodoroSoundVolume = value;
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error updating pomodoro sound volume:', error);
						new Notice('Failed to update sound volume setting.');
					}
				}));

		new Setting(container)
			.setName('Data storage location')
			.setDesc('Choose where to store pomodoro session data. Daily notes provides better data longevity as the data stays with your notes, but requires the Daily Notes core plugin to be enabled.')
			.addDropdown(dropdown => dropdown
				.addOption('plugin', 'Plugin data file (default)')
				.addOption('daily-notes', 'Daily notes frontmatter')
				.setValue(this.plugin.settings.pomodoroStorageLocation)
				.onChange(async (value: 'plugin' | 'daily-notes') => {
					try {
						// Check if Daily Notes plugin is enabled when switching to daily-notes
						if (value === 'daily-notes') {
							const { appHasDailyNotesPluginLoaded } = await import('obsidian-daily-notes-interface');
							if (!appHasDailyNotesPluginLoaded()) {
								new Notice('Daily Notes core plugin must be enabled to use this storage option. Please enable it in Settings > Core plugins and try again.');
								dropdown.setValue('plugin'); // Reset to plugin storage
								return;
							}

							// Check if there's existing data to migrate
							const data = await this.plugin.loadData();
							const hasExistingData = data?.pomodoroHistory && Array.isArray(data.pomodoroHistory) && data.pomodoroHistory.length > 0;

							// Show confirmation dialog using Obsidian's Modal API
							const confirmed = await showStorageLocationConfirmationModal(this.app, hasExistingData);
							if (!confirmed) {
								dropdown.setValue('plugin'); // Reset to plugin storage if user cancels
								return;
							}
						}

						this.plugin.settings.pomodoroStorageLocation = value;
						await this.plugin.saveSettings();

						// Trigger migration if switching to daily-notes and there's data to migrate
						if (value === 'daily-notes') {
							await this.plugin.pomodoroService.migrateTodailyNotes();
						}

					} catch (error) {
						console.error('Error updating pomodoro storage location:', error);
						new Notice('Failed to update storage location setting.');
						dropdown.setValue('plugin'); // Reset to plugin storage on error
					}
				}));

		new Setting(container)
			.setName('Auto-stop time tracking on completion')
			.setDesc('Automatically stop time tracking when a task is marked as completed')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoStopTimeTrackingOnComplete)
				.onChange(async (value) => {
					this.plugin.settings.autoStopTimeTrackingOnComplete = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Show auto-stop notifications')
			.setDesc('Show a notice when time tracking is automatically stopped')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoStopTimeTrackingNotification)
				.onChange(async (value) => {
					this.plugin.settings.autoStopTimeTrackingNotification = value;
					await this.plugin.saveSettings();
				}));
	}



	private renderSubscriptionList(container: HTMLElement): void {
		container.empty();

		if (!this.plugin.icsSubscriptionService) {
			container.createEl('p', { text: 'ICS Subscription service not available', cls: 'settings-help-note' });
			return;
		}

		const subscriptions = this.plugin.icsSubscriptionService.getSubscriptions();

		if (subscriptions.length === 0) {
			container.createEl('p', { text: 'No calendar subscriptions configured', cls: 'settings-help-note' });
			return;
		}

		subscriptions.forEach(subscription => {
			const subRow = container.createDiv('settings-item-row ics-subscription-row');

			// Status indicator
			const statusIndicator = subRow.createDiv('settings-status-indicator');
			if (subscription.enabled) {
				statusIndicator.addClass('enabled');
				setTooltip(statusIndicator, subscription.lastError ? `Error: ${subscription.lastError}` : 'Active', { placement: 'top' });
				if (subscription.lastError) {
					statusIndicator.addClass('error');
				}
			} else {
				statusIndicator.addClass('disabled');
				setTooltip(statusIndicator, 'Disabled', { placement: 'top' });
			}

			// Subscription info
			const infoContainer = subRow.createDiv('ics-subscription-info');
			const nameEl = infoContainer.createEl('div', { cls: 'ics-subscription-name', text: subscription.name });

			// Type badge
			nameEl.createEl('span', {
				cls: `ics-subscription-type-badge ${subscription.type}`,
				text: subscription.type === 'remote' ? 'URL' : 'FILE'
			});

			// Source (URL or file path)
			const sourceText = subscription.type === 'remote' ? subscription.url : subscription.filePath;
			infoContainer.createEl('div', { cls: 'ics-subscription-url', text: sourceText || 'Unknown source' });
			const metaEl = infoContainer.createEl('div', { cls: 'ics-subscription-meta' });

			// Meta information
			const refreshText = `Refresh: ${subscription.refreshInterval}min`;
			const lastFetched = subscription.lastFetched ? ` • Last: ${new Date(subscription.lastFetched).toLocaleString()}` : '';
			metaEl.textContent = refreshText + lastFetched;

			if (subscription.lastError) {
				infoContainer.createEl('div', { cls: 'ics-subscription-error', text: `Error: ${subscription.lastError}` });
			}

			// Actions
			const actionsContainer = subRow.createDiv('ics-subscription-actions');

			// Enable/disable toggle
			const enableButton = actionsContainer.createEl('button', {
				text: subscription.enabled ? 'Disable' : 'Enable',
				cls: `ics-subscription-toggle ${subscription.enabled ? 'enabled' : 'disabled'}`
			});
			enableButton.addEventListener('click', async () => {
				try {
					await this.plugin.icsSubscriptionService!.updateSubscription(subscription.id, {
						enabled: !subscription.enabled
					});
					this.renderActiveTab();
				} catch (error) {
					console.error('Error toggling subscription:', error);
					new Notice('Failed to update subscription');
				}
			});

			// Refresh button
			const refreshButton = actionsContainer.createEl('button', {
				text: 'Refresh',
				cls: 'ics-subscription-refresh'
			});
			refreshButton.addEventListener('click', async () => {
				if (!subscription.enabled) {
					new Notice('Enable the subscription first');
					return;
				}

				refreshButton.textContent = 'Refreshing...';
				refreshButton.disabled = true;
				try {
					await this.plugin.icsSubscriptionService!.refreshSubscription(subscription.id);
					new Notice(`Refreshed "${subscription.name}"`);
					this.renderActiveTab();
				} catch (error) {
					console.error('Error refreshing subscription:', error);
					new Notice('Failed to refresh subscription');
				} finally {
					refreshButton.textContent = 'Refresh';
					refreshButton.disabled = false;
				}
			});

			// Edit button
			const editButton = actionsContainer.createEl('button', {
				text: 'Edit',
				cls: 'ics-subscription-edit'
			});
			editButton.addEventListener('click', () => {
				this.showInlineEditForm(subscription, subRow);
			});

			// Delete button
			const deleteButton = actionsContainer.createEl('button', {
				text: 'Delete',
				cls: 'ics-subscription-delete'
			});
			deleteButton.addEventListener('click', async () => {
				// Show confirmation dialog using the existing, correct modal
				const confirmed = await showConfirmationModal(this.app, {
					title: 'Delete Subscription',
					message: `Are you sure you want to delete the subscription "${subscription.name}"? This action cannot be undone.`,
					confirmText: 'Delete',
					cancelText: 'Cancel',
					isDestructive: true
				});

				if (confirmed) {
					try {
						await this.plugin.icsSubscriptionService!.removeSubscription(subscription.id);
						new Notice(`Deleted subscription "${subscription.name}"`);
						this.renderActiveTab();
					} catch (error) {
						console.error('Error deleting subscription:', error);
						new Notice('Failed to delete subscription');
					}
				}
			});
		});
	}

	private showInlineEditForm(subscription: any, rowElement: HTMLElement): void {
		// Store reference to original row content for restoration
		const originalChildren = Array.from(rowElement.children);

		// Clear the row and create edit form
		rowElement.empty();
		rowElement.addClass('ics-subscription-editing');

		const editForm = rowElement.createDiv('ics-edit-form');

		// Name input
		const nameRow = editForm.createDiv('ics-edit-row');
		nameRow.createEl('label', { text: 'Name:', cls: 'ics-edit-label' });
		const nameInput = nameRow.createEl('input', {
			type: 'text',
			value: subscription.name,
			cls: 'ics-edit-input'
		});

		// URL input
		const urlRow = editForm.createDiv('ics-edit-row');
		urlRow.createEl('label', { text: 'URL:', cls: 'ics-edit-label' });
		const urlInput = urlRow.createEl('input', {
			type: 'url',
			value: subscription.url,
			cls: 'ics-edit-input'
		});

		// Settings row
		const settingsRow = editForm.createDiv('ics-edit-row ics-edit-settings');

		// Color
		const colorGroup = settingsRow.createDiv('ics-edit-group');
		colorGroup.createEl('label', { text: 'Color:', cls: 'ics-edit-label' });
		const colorInput = colorGroup.createEl('input', {
			type: 'color',
			value: subscription.color,
			cls: 'ics-edit-color'
		});

		// Refresh interval
		const intervalGroup = settingsRow.createDiv('ics-edit-group');
		intervalGroup.createEl('label', { text: 'Refresh (min):', cls: 'ics-edit-label' });
		const intervalInput = intervalGroup.createEl('input', {
			type: 'number',
			value: subscription.refreshInterval.toString(),
			cls: 'ics-edit-number'
		});
		intervalInput.setAttribute('min', '15');
		intervalInput.setAttribute('max', '1440');
		intervalInput.setAttribute('step', '15');

		// Enabled checkbox
		const enabledGroup = settingsRow.createDiv('ics-edit-group');
		const enabledLabel = enabledGroup.createEl('label', { cls: 'ics-edit-checkbox-label' });
		const enabledCheckbox = enabledLabel.createEl('input', {
			type: 'checkbox',
			cls: 'ics-edit-checkbox'
		});
		enabledCheckbox.checked = subscription.enabled;
		enabledLabel.createSpan({ text: ' Enabled' });

		// Buttons row
		const buttonsRow = editForm.createDiv('ics-edit-row ics-edit-buttons');
		const saveButton = buttonsRow.createEl('button', {
			text: 'Save',
			cls: 'ics-edit-button mod-cta'
		});
		const cancelButton = buttonsRow.createEl('button', {
			text: 'Cancel',
			cls: 'ics-edit-button'
		});

		// Save handler
		saveButton.addEventListener('click', async () => {
			const name = nameInput.value.trim();
			const url = urlInput.value.trim();
			const color = colorInput.value;
			const refreshInterval = parseInt(intervalInput.value);
			const enabled = enabledCheckbox.checked;

			if (!name || !url) {
				new Notice('Name and URL are required');
				return;
			}

			if (refreshInterval < 15 || refreshInterval > 1440) {
				new Notice('Refresh interval must be between 15 and 1440 minutes');
				return;
			}

			try {
				saveButton.textContent = 'Saving...';
				saveButton.disabled = true;

				await this.plugin.icsSubscriptionService!.updateSubscription(subscription.id, {
					name, url, color, refreshInterval, enabled
				});

				new Notice(`Updated subscription "${name}"`);
				this.renderActiveTab();
			} catch (error) {
				console.error('Error updating subscription:', error);
				new Notice('Failed to update subscription');
			}
		});

		// Cancel handler
		cancelButton.addEventListener('click', () => {
			rowElement.empty();
			rowElement.removeClass('ics-subscription-editing');
			// Restore original children
			originalChildren.forEach(child => rowElement.appendChild(child));
			// Re-attach event listeners by re-rendering
			this.renderActiveTab();
		});

		// Focus the name input
		window.setTimeout(() => nameInput.focus(), 50);
	}

	private initializeDefaultProjectsFromSettings(): void {
		// Convert project strings to files
		const defaultProjects = this.plugin.settings.taskCreationDefaults.defaultProjects;
		if (!defaultProjects) {
			this.selectedDefaultProjectFiles = [];
			return;
		}

		const projectStrings = splitListPreservingLinksAndQuotes(defaultProjects);
		this.selectedDefaultProjectFiles = [];

		for (const projectString of projectStrings) {
			// Check if it's a wiki link format
			const linkMatch = projectString.match(/^\[\[([^\]]+)\]\]$/);
			if (linkMatch) {
				const linkPath = linkMatch[1];
				const file = this.app.metadataCache.getFirstLinkpathDest(linkPath, '');
				if (file) {
					this.selectedDefaultProjectFiles.push(file);
				}
			} else {
				// For backwards compatibility, try to find a file with this name
				const files = this.app.vault.getMarkdownFiles();
				const matchingFile = files.find(f =>
					f.basename === projectString ||
					f.name === projectString + '.md'
				);
				if (matchingFile) {
					this.selectedDefaultProjectFiles.push(matchingFile);
				}
			}
		}
	}

	private addDefaultProject(file: TAbstractFile): void {
		// Check if project is already selected
		const exists = this.selectedDefaultProjectFiles.some(
			existing => existing.path === file.path
		);
		if (!exists) {
			this.selectedDefaultProjectFiles.push(file);
		}
	}

	private removeDefaultProject(file: TAbstractFile): void {
		this.selectedDefaultProjectFiles = this.selectedDefaultProjectFiles.filter(
			existing => existing.path !== file.path
		);
	}

	private renderDefaultProjectsList(container: HTMLElement): void {
		container.empty();

		if (this.selectedDefaultProjectFiles.length === 0) {
			const emptyText = container.createDiv({ cls: 'default-projects-empty' });
			emptyText.textContent = 'No default projects selected';
			return;
		}

		this.selectedDefaultProjectFiles.forEach(file => {
			const projectItem = container.createDiv({ cls: 'default-project-item' });

			// Info container
			const infoEl = projectItem.createDiv({ cls: 'default-project-info' });

			// File name
			const nameEl = infoEl.createSpan({ cls: 'default-project-name' });
			nameEl.textContent = file.name;

			// File path (if different from name)
			if (file.path !== file.name) {
				const pathEl = infoEl.createDiv({ cls: 'default-project-path' });
				pathEl.textContent = file.path;
			}

			// Remove button
			const removeBtn = projectItem.createEl('button', {
				cls: 'default-project-remove',
				text: '×'
			});
			setTooltip(removeBtn, 'Remove project', { placement: 'top' });
			removeBtn.addEventListener('click', () => {
				this.removeDefaultProject(file);
				this.renderDefaultProjectsList(container);
				this.updateDefaultProjectsInSettings();
			});
		});
	}

	private updateDefaultProjectsInSettings(): void {
		// Convert selected files to markdown links
		const currentFile = this.app.workspace.getActiveFile();
		const sourcePath = currentFile?.path || '';

		const projectStrings = this.selectedDefaultProjectFiles.map(file => {
			// fileToLinktext expects TFile, so cast safely since we know these are markdown files
			const linkText = this.app.metadataCache.fileToLinktext(file as TFile, sourcePath, true);
			return `[[${linkText}]]`;
		});

		this.plugin.settings.taskCreationDefaults.defaultProjects = projectStrings.join(', ');
		this.plugin.saveSettings();
	}

	private renderDefaultRemindersList(container: HTMLElement): void {
		container.empty();

		const reminders = this.plugin.settings.taskCreationDefaults.defaultReminders || [];

		if (reminders.length === 0) {
			const emptyState = container.createDiv({ cls: 'reminder-defaults-empty' });
			setIcon(emptyState.createDiv({ cls: 'reminder-defaults-empty-icon' }), 'bell-off');
			emptyState.createEl('div', {
				cls: 'reminder-defaults-empty-text',
				text: 'No default reminders configured'
			});
			return;
		}

		const remindersList = container.createDiv({ cls: 'reminder-defaults-items' });

		reminders.forEach((reminder, index) => {
			const reminderCard = remindersList.createDiv({ cls: 'reminder-defaults-card' });

			// Reminder type icon
			const iconContainer = reminderCard.createDiv({ cls: 'reminder-defaults-icon' });
			const iconName = reminder.type === 'absolute' ? 'calendar-clock' : 'timer';
			setIcon(iconContainer, iconName);

			// Main content area
			const content = reminderCard.createDiv({ cls: 'reminder-defaults-content' });

			// Primary info (timing)
			const primaryInfo = content.createDiv({ cls: 'reminder-defaults-primary' });
			primaryInfo.textContent = this.formatDefaultReminderText(reminder);

			// Custom description (if any)
			if (reminder.description) {
				const description = content.createDiv({ cls: 'reminder-defaults-description' });
				description.textContent = `"${reminder.description}"`;
			}

			// Actions area
			const actions = reminderCard.createDiv({ cls: 'reminder-defaults-actions' });

			// Remove button
			const removeBtn = actions.createEl('button', {
				cls: 'reminder-defaults-remove-btn'
			});
			setIcon(removeBtn, 'trash-2');
			setTooltip(removeBtn, 'Delete this default reminder');
			removeBtn.onclick = async () => {
				await this.removeDefaultReminder(index);
			};
		});
	}

	private renderAddDefaultReminderForm(container: HTMLElement): void {
		const formContainer = container.createDiv({ cls: 'reminder-defaults-form' });

		formContainer.createEl('h4', {
			text: 'Add Default Reminder',
			cls: 'reminder-defaults-form-header'
		});

		// Type selector
		const typeSelector = formContainer.createDiv({ cls: 'reminder-defaults-type-selector' });

		const relativeTab = typeSelector.createEl('button', {
			cls: 'reminder-defaults-type-tab reminder-defaults-type-tab--active',
			text: 'Relative',
			attr: { 'data-type': 'relative' }
		});

		const absoluteTab = typeSelector.createEl('button', {
			cls: 'reminder-defaults-type-tab',
			text: 'Absolute',
			attr: { 'data-type': 'absolute' }
		});

		let selectedType: 'relative' | 'absolute' = 'relative';
		let relativeAnchor: 'due' | 'scheduled' = 'due';
		let relativeOffset = 15;
		let relativeUnit: 'minutes' | 'hours' | 'days' = 'minutes';
		let relativeDirection: 'before' | 'after' = 'before';
		let absoluteDate = '';
		let absoluteTime = '';
		let description = '';

		// Tab switching
		const switchToType = (type: 'relative' | 'absolute') => {
			selectedType = type;
			relativeTab.classList.toggle('reminder-defaults-type-tab--active', type === 'relative');
			absoluteTab.classList.toggle('reminder-defaults-type-tab--active', type === 'absolute');
			updateFormVisibility();
		};

		relativeTab.onclick = () => switchToType('relative');
		absoluteTab.onclick = () => switchToType('absolute');

		// Relative form fields
		const relativeFields = formContainer.createDiv({ cls: 'reminder-defaults-relative-fields' });

		new Setting(relativeFields)
			.setName('Time')
			.addText(text => {
				text
					.setPlaceholder('15')
					.setValue(String(relativeOffset))
					.onChange(value => {
						relativeOffset = parseInt(value) || 0;
					});
			})
			.addDropdown(dropdown => {
				dropdown
					.addOption('minutes', 'minutes')
					.addOption('hours', 'hours')
					.addOption('days', 'days')
					.setValue(relativeUnit)
					.onChange(value => {
						relativeUnit = value as 'minutes' | 'hours' | 'days';
					});
			});

		new Setting(relativeFields)
			.setName('Direction')
			.addDropdown(dropdown => {
				dropdown
					.addOption('before', 'Before')
					.addOption('after', 'After')
					.setValue(relativeDirection)
					.onChange(value => {
						relativeDirection = value as 'before' | 'after';
					});
			});

		new Setting(relativeFields)
			.setName('Relative to')
			.addDropdown(dropdown => {
				dropdown
					.addOption('due', 'Due date')
					.addOption('scheduled', 'Scheduled date')
					.setValue(relativeAnchor)
					.onChange(value => {
						relativeAnchor = value as 'due' | 'scheduled';
					});
			});

		// Absolute form fields
		const absoluteFields = formContainer.createDiv({ cls: 'reminder-defaults-absolute-fields' });

		new Setting(absoluteFields)
			.setName('Date')
			.addText(text => {
				text
					.setPlaceholder('YYYY-MM-DD')
					.setValue(absoluteDate)
					.onChange(value => {
						absoluteDate = value;
					});
				text.inputEl.type = 'date';
			});

		new Setting(absoluteFields)
			.setName('Time')
			.addText(text => {
				text
					.setPlaceholder('HH:MM')
					.setValue(absoluteTime)
					.onChange(value => {
						absoluteTime = value;
					});
				text.inputEl.type = 'time';
			});

		// Description field (common)
		new Setting(formContainer)
			.setName('Description (optional)')
			.addText(text => {
				text
					.setPlaceholder('Custom reminder message')
					.setValue(description)
					.onChange(value => {
						description = value;
					});
			});

		// Add button
		const addBtn = formContainer.createEl('button', {
			cls: 'reminder-defaults-add-btn'
		});

		const addIcon = addBtn.createSpan({ cls: 'reminder-defaults-add-icon' });
		setIcon(addIcon, 'plus');
		addBtn.createSpan({
			cls: 'reminder-defaults-add-text',
			text: 'Add Default Reminder'
		});

		addBtn.onclick = async () => {
			try {
				const newReminder = this.createDefaultReminder(
					selectedType,
					relativeAnchor,
					relativeOffset,
					relativeUnit,
					relativeDirection,
					absoluteDate,
					absoluteTime,
					description
				);

				if (newReminder) {
					await this.addDefaultReminder(newReminder);

					// Reset form
					if (selectedType === 'relative') {
						relativeOffset = 15;
						relativeUnit = 'minutes';
						description = '';
					} else {
						absoluteDate = '';
						absoluteTime = '';
						description = '';
					}

					// Reset form inputs
					this.resetDefaultReminderForm(formContainer);
				}
			} catch (error) {
				console.error('Error adding default reminder:', error);
				new Notice('Failed to add default reminder. Please check your inputs.');
			}
		};

		const updateFormVisibility = () => {
			relativeFields.style.display = selectedType === 'relative' ? 'block' : 'none';
			absoluteFields.style.display = selectedType === 'absolute' ? 'block' : 'none';
		};

		// Set initial form visibility
		updateFormVisibility();
	}

	private formatDefaultReminderText(reminder: DefaultReminder): string {
		if (reminder.type === 'absolute') {
			if (reminder.absoluteDate && reminder.absoluteTime) {
				return `${reminder.absoluteDate} at ${reminder.absoluteTime}`;
			}
			return 'Absolute reminder';
		} else {
			const anchor = reminder.relatedTo === 'due' ? 'due date' : 'scheduled date';
			const offset = this.formatDefaultReminderOffset(reminder);
			return `${offset} ${anchor}`;
		}
	}

	private formatDefaultReminderOffset(reminder: DefaultReminder): string {
		if (!reminder.offset || !reminder.unit) return 'At time of';

		const direction = reminder.direction === 'before' ? 'before' : 'after';
		const unit = reminder.offset === 1 ? reminder.unit.slice(0, -1) : reminder.unit; // Remove 's' for singular
		return `${reminder.offset} ${unit} ${direction}`;
	}

	private createDefaultReminder(
		type: 'relative' | 'absolute',
		anchor: 'due' | 'scheduled',
		offset: number,
		unit: 'minutes' | 'hours' | 'days',
		direction: 'before' | 'after',
		date: string,
		time: string,
		description: string
	): DefaultReminder | null {
		const id = `def_rem_${Date.now()}`;

		if (type === 'relative') {
			return {
				id,
				type: 'relative',
				relatedTo: anchor,
				offset,
				unit,
				direction,
				description: description || undefined
			};
		} else {
			if (!date || !time) {
				new Notice('Please specify both date and time for absolute reminder');
				return null;
			}

			return {
				id,
				type: 'absolute',
				absoluteDate: date,
				absoluteTime: time,
				description: description || undefined
			};
		}
	}

	private async addDefaultReminder(reminder: DefaultReminder): Promise<void> {
		if (!this.plugin.settings.taskCreationDefaults.defaultReminders) {
			this.plugin.settings.taskCreationDefaults.defaultReminders = [];
		}

		this.plugin.settings.taskCreationDefaults.defaultReminders.push(reminder);
		await this.plugin.saveSettings();

		// Re-render the list
		const remindersList = document.querySelector('.reminder-defaults-list') as HTMLElement;
		if (remindersList) {
			this.renderDefaultRemindersList(remindersList);
		}

		new Notice('Default reminder added successfully');
	}

	private async removeDefaultReminder(index: number): Promise<void> {
		if (!this.plugin.settings.taskCreationDefaults.defaultReminders) return;

		this.plugin.settings.taskCreationDefaults.defaultReminders.splice(index, 1);
		await this.plugin.saveSettings();

		// Re-render the list
		const remindersList = document.querySelector('.reminder-defaults-list') as HTMLElement;
		if (remindersList) {
			this.renderDefaultRemindersList(remindersList);
		}

		new Notice('Default reminder removed');
	}

	private resetDefaultReminderForm(formContainer: HTMLElement): void {
		// Reset all form inputs to their default values
		const inputs = formContainer.querySelectorAll('input, select') as NodeListOf<HTMLInputElement | HTMLSelectElement>;
		inputs.forEach(input => {
			if (input.type === 'text' || input.type === 'date' || input.type === 'time') {
				input.value = '';
			} else if (input.tagName === 'SELECT') {
				(input as HTMLSelectElement).selectedIndex = 0;
			}
		});

		// Reset number input to default
		const offsetInput = formContainer.querySelector('input[placeholder="15"]') as HTMLInputElement;
		if (offsetInput) offsetInput.value = '15';
	}

	/**
	 * Render the list of configured webhooks
	 */
	private renderWebhookList(container: HTMLElement): void {
		const webhooksContainer = container.createDiv({ cls: 'tasknotes-webhooks-container' });

		if (!this.plugin.settings.webhooks || this.plugin.settings.webhooks.length === 0) {
			const emptyState = webhooksContainer.createDiv({ cls: 'tasknotes-webhooks-empty-state' });
			const emptyIcon = emptyState.createSpan({ cls: 'tasknotes-webhooks-empty-icon' });
			setIcon(emptyIcon, 'webhook');
			emptyState.createSpan({
				text: 'No webhooks configured. Add a webhook to receive real-time notifications.',
				cls: 'tasknotes-webhooks-empty-text'
			});
			return;
		}

		this.plugin.settings.webhooks.forEach((webhook, index) => {
			const webhookCard = webhooksContainer.createDiv({ cls: 'tasknotes-webhook-card' });

			// Header section with URL and status
			const webhookHeader = webhookCard.createDiv({ cls: 'tasknotes-webhook-header' });

			const urlSection = webhookHeader.createDiv({ cls: 'tasknotes-webhook-url-section' });
			const urlIcon = urlSection.createSpan({ cls: 'tasknotes-webhook-url-icon' });
			setIcon(urlIcon, 'link');
			urlSection.createSpan({
				text: webhook.url,
				cls: 'tasknotes-webhook-url'
			});

			const statusSection = webhookHeader.createDiv({ cls: 'tasknotes-webhook-status-section' });
			const statusIndicator = statusSection.createSpan({
				cls: `tasknotes-webhook-status-indicator ${webhook.active ? 'active' : 'inactive'}`
			});
			const statusIcon = statusIndicator.createSpan({ cls: 'tasknotes-webhook-status-icon' });
			setIcon(statusIcon, webhook.active ? 'circle-check' : 'circle-x');
			statusIndicator.createSpan({
				text: webhook.active ? 'Active' : 'Inactive',
				cls: 'tasknotes-webhook-status-text'
			});

			// Content section with details
			const webhookContent = webhookCard.createDiv({ cls: 'tasknotes-webhook-content' });

			// Events row
			const eventsRow = webhookContent.createDiv({ cls: 'tasknotes-webhook-detail-row' });
			const eventsIcon = eventsRow.createSpan({ cls: 'tasknotes-webhook-detail-icon' });
			setIcon(eventsIcon, 'zap');
			eventsRow.createSpan({
				text: 'Events:',
				cls: 'tasknotes-webhook-detail-label'
			});
			eventsRow.createSpan({
				text: webhook.events.join(', '),
				cls: 'tasknotes-webhook-detail-value'
			});

			// Transform file row (if present)
			if (webhook.transformFile) {
				const transformRow = webhookContent.createDiv({ cls: 'tasknotes-webhook-detail-row' });
				const transformIcon = transformRow.createSpan({ cls: 'tasknotes-webhook-detail-icon' });
				setIcon(transformIcon, 'file-code');
				transformRow.createSpan({
					text: 'Transform:',
					cls: 'tasknotes-webhook-detail-label'
				});
				transformRow.createSpan({
					text: webhook.transformFile,
					cls: 'tasknotes-webhook-detail-value'
				});
			}

			// CORS headers row (if disabled)
			if (webhook.corsHeaders === false) {
				const corsRow = webhookContent.createDiv({ cls: 'tasknotes-webhook-detail-row warning' });
				const corsIcon = corsRow.createSpan({ cls: 'tasknotes-webhook-detail-icon' });
				setIcon(corsIcon, 'alert-triangle');
				corsRow.createSpan({
					text: 'Custom headers disabled',
					cls: 'tasknotes-webhook-detail-warning'
				});
			}

			// Statistics row
			const statsRow = webhookContent.createDiv({ cls: 'tasknotes-webhook-detail-row' });
			const statsIcon = statsRow.createSpan({ cls: 'tasknotes-webhook-detail-icon' });
			setIcon(statsIcon, 'bar-chart-3');
			statsRow.createSpan({
				text: 'Statistics:',
				cls: 'tasknotes-webhook-detail-label'
			});
			const statsValue = statsRow.createSpan({ cls: 'tasknotes-webhook-stats' });
			const successSpan = statsValue.createSpan({ cls: 'tasknotes-webhook-stat-success' });
			const successIcon = successSpan.createSpan({ cls: 'tasknotes-webhook-stat-icon' });
			setIcon(successIcon, 'check');
			successSpan.createSpan({ text: `${webhook.successCount || 0}` });

			const failureSpan = statsValue.createSpan({ cls: 'tasknotes-webhook-stat-failure' });
			const failureIcon = failureSpan.createSpan({ cls: 'tasknotes-webhook-stat-icon' });
			setIcon(failureIcon, 'x');
			failureSpan.createSpan({ text: `${webhook.failureCount || 0}` });

			// Actions section
			const webhookActions = webhookCard.createDiv({ cls: 'tasknotes-webhook-actions' });

			// Toggle button
			const toggleBtn = webhookActions.createEl('button', {
				cls: `tasknotes-webhook-action-btn ${webhook.active ? 'disable' : 'enable'}`,
				attr: {
					'aria-label': webhook.active ? 'Disable webhook' : 'Enable webhook'
				}
			});
			const toggleIcon = toggleBtn.createSpan({ cls: 'tasknotes-webhook-action-icon' });
			setIcon(toggleIcon, webhook.active ? 'pause' : 'play');
			toggleBtn.createSpan({
				text: webhook.active ? 'Disable' : 'Enable',
				cls: 'tasknotes-webhook-action-text'
			});
			setTooltip(toggleBtn, webhook.active ? 'Disable this webhook' : 'Enable this webhook');

			toggleBtn.onclick = async () => {
				webhook.active = !webhook.active;
				await this.plugin.saveSettings();
				this.display(); // Refresh the settings
				new Notice(`Webhook ${webhook.active ? 'enabled' : 'disabled'}`);
			};

			// Delete button
			const deleteBtn = webhookActions.createEl('button', {
				cls: 'tasknotes-webhook-action-btn delete',
				attr: {
					'aria-label': 'Delete webhook'
				}
			});
			const deleteIcon = deleteBtn.createSpan({ cls: 'tasknotes-webhook-action-icon' });
			setIcon(deleteIcon, 'trash-2');
			deleteBtn.createSpan({
				text: 'Delete',
				cls: 'tasknotes-webhook-action-text'
			});
			setTooltip(deleteBtn, 'Delete this webhook');

			deleteBtn.onclick = async () => {
				const confirmed = await showConfirmationModal(this.app, {
					title: 'Delete Webhook',
					message: `Are you sure you want to delete this webhook?\n\nURL: ${webhook.url}\n\nThis action cannot be undone.`,
					confirmText: 'Delete',
					cancelText: 'Cancel',
					isDestructive: true
				});

				if (confirmed) {
					this.plugin.settings.webhooks.splice(index, 1);
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings
					new Notice('Webhook deleted');
				}
			};
		});
	}

	/**
	 * Show modal for adding a new webhook
	 */
	private showWebhookModal(): void {
		const modal = new WebhookModal(this.app, async (webhookConfig: Partial<WebhookConfig>) => {
			// Generate ID and secret
			const webhook: WebhookConfig = {
				id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
				url: webhookConfig.url || '',
				events: webhookConfig.events || [],
				secret: this.generateWebhookSecret(),
				active: true,
				createdAt: new Date().toISOString(),
				failureCount: 0,
				successCount: 0,
				transformFile: webhookConfig.transformFile,
				corsHeaders: webhookConfig.corsHeaders
			};

			if (!this.plugin.settings.webhooks) {
				this.plugin.settings.webhooks = [];
			}

			this.plugin.settings.webhooks.push(webhook);
			await this.plugin.saveSettings();
			this.display(); // Refresh settings

			// Show secret in a formatted notice
			const secretNotice = new Notice('', 8000);
			const noticeContent = secretNotice.noticeEl.createDiv({ cls: 'tasknotes-webhook-secret-notice' });
			const title = noticeContent.createDiv({ cls: 'tasknotes-webhook-secret-title' });
			const titleIcon = title.createSpan();
			setIcon(titleIcon, 'check-circle');
			title.createSpan({ text: 'Webhook added successfully!' });

			const secretDiv = noticeContent.createDiv({ cls: 'tasknotes-webhook-secret-content' });
			secretDiv.createSpan({ text: 'Secret: ' });
			secretDiv.createEl('code', {
				text: `${webhook.secret.substring(0, 16)}...`,
				cls: 'tasknotes-webhook-secret-code'
			});
			secretDiv.createSpan({ text: ' (copy from webhook settings)' });
		});

		modal.open();
	}

	/**
	 * Generate secure webhook secret
	 */
	private generateWebhookSecret(): string {
		return Array.from(crypto.getRandomValues(new Uint8Array(32)))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');
	}
}

/**
 * Modal for adding/editing webhooks
 */
class WebhookModal extends Modal {
	private url = '';
	private selectedEvents: string[] = [];
	private transformFile = '';
	private corsHeaders = true;
	private onSubmit: (config: Partial<WebhookConfig>) => void;

	constructor(app: App, onSubmit: (config: Partial<WebhookConfig>) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('tasknotes-webhook-modal');

		// Modal header with icon
		const header = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-header' });
		const headerIcon = header.createSpan({ cls: 'tasknotes-webhook-modal-icon' });
		setIcon(headerIcon, 'webhook');
		header.createEl('h2', { text: 'Add Webhook', cls: 'tasknotes-webhook-modal-title' });

		// URL input section
		const urlSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
		new Setting(urlSection)
			.setName('Webhook URL')
			.setDesc('The endpoint where webhook payloads will be sent')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Webhook URL');
				return text
					.setPlaceholder('https://your-service.com/webhook')
					.setValue(this.url)
					.onChange((value) => {
						this.url = value;
					});
			});

		// Events selection section
		const eventsSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
		const eventsHeader = eventsSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
		const eventsIcon = eventsHeader.createSpan();
		setIcon(eventsIcon, 'zap');
		eventsHeader.createEl('h3', { text: 'Events to subscribe to' });

		const eventsGrid = eventsSection.createDiv({ cls: 'tasknotes-webhook-events-list' });

		const availableEvents = [
			{ id: 'task.created', label: 'Task Created', desc: 'When new tasks are created' },
			{ id: 'task.updated', label: 'Task Updated', desc: 'When tasks are modified' },
			{ id: 'task.completed', label: 'Task Completed', desc: 'When tasks are marked complete' },
			{ id: 'task.deleted', label: 'Task Deleted', desc: 'When tasks are deleted' },
			{ id: 'task.archived', label: 'Task Archived', desc: 'When tasks are archived' },
			{ id: 'task.unarchived', label: 'Task Unarchived', desc: 'When tasks are unarchived' },
			{ id: 'time.started', label: 'Time Started', desc: 'When time tracking starts' },
			{ id: 'time.stopped', label: 'Time Stopped', desc: 'When time tracking stops' },
			{ id: 'pomodoro.started', label: 'Pomodoro Started', desc: 'When pomodoro sessions begin' },
			{ id: 'pomodoro.completed', label: 'Pomodoro Completed', desc: 'When pomodoro sessions finish' },
			{ id: 'pomodoro.interrupted', label: 'Pomodoro Interrupted', desc: 'When pomodoro sessions are stopped' },
			{ id: 'recurring.instance.completed', label: 'Recurring Instance Completed', desc: 'When recurring task instances complete' },
			{ id: 'reminder.triggered', label: 'Reminder Triggered', desc: 'When task reminders activate' }
		];

		availableEvents.forEach(event => {
			new Setting(eventsGrid)
				.setName(event.label)
				.setDesc(event.desc)
				.addToggle(toggle => {
					toggle.toggleEl.setAttribute('aria-label', `Subscribe to ${event.label} events`);
					return toggle
						.setValue(this.selectedEvents.includes(event.id))
						.onChange((value) => {
							if (value) {
								this.selectedEvents.push(event.id);
							} else {
								const index = this.selectedEvents.indexOf(event.id);
								if (index > -1) {
									this.selectedEvents.splice(index, 1);
								}
							}
						});
				});
		});

		// Transform file section
		const transformSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
		const transformHeader = transformSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
		const transformIcon = transformHeader.createSpan();
		setIcon(transformIcon, 'file-code');
		transformHeader.createEl('h3', { text: 'Transform Configuration (Optional)' });

		new Setting(transformSection)
			.setName('Transform File')
			.setDesc('Path to a .js or .json file in your vault that transforms webhook payloads')
			.addText(text => {
				text.inputEl.setAttribute('aria-label', 'Transform file path');
				return text
					.setPlaceholder('discord-transform.js')
					.setValue(this.transformFile)
					.onChange((value) => {
						this.transformFile = value;
					});
			});

		// Transform help section
		const transformHelp = transformSection.createDiv({ cls: 'tasknotes-webhook-transform-help' });
		const helpHeader = transformHelp.createDiv({ cls: 'tasknotes-webhook-help-header' });
		const helpIcon = helpHeader.createSpan();
		setIcon(helpIcon, 'info');
		helpHeader.createSpan({ text: 'Transform files allow you to customize webhook payloads:' });

		const helpList = transformHelp.createEl('ul', { cls: 'tasknotes-webhook-help-list' });
		const jsLi = helpList.createEl('li');
		jsLi.createEl('strong', { text: '.js files:' });
		jsLi.appendText(' Custom JavaScript transforms');

		const jsonLi = helpList.createEl('li');
		jsonLi.createEl('strong', { text: '.json files:' });
		jsonLi.appendText(' Templates with ');
		jsonLi.createEl('code', { text: '${data.task.title}' });

		const emptyLi = helpList.createEl('li');
		emptyLi.createEl('strong', { text: 'Leave empty:' });
		emptyLi.appendText(' Send raw data');

		const helpExample = transformHelp.createDiv({ cls: 'tasknotes-webhook-help-example' });
		helpExample.createEl('strong', { text: 'Example:' });
		helpExample.appendText(' ');
		helpExample.createEl('code', { text: 'discord-transform.js' });

		// CORS headers section
		const corsSection = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-section' });
		const corsHeader = corsSection.createDiv({ cls: 'tasknotes-webhook-modal-subsection-header' });
		const corsIcon = corsHeader.createSpan();
		setIcon(corsIcon, 'settings');
		corsHeader.createEl('h3', { text: 'Headers Configuration' });

		new Setting(corsSection)
			.setName('Include custom headers')
			.setDesc('Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.')
			.addToggle(toggle => {
				toggle.toggleEl.setAttribute('aria-label', 'Include custom headers');
				return toggle
					.setValue(this.corsHeaders)
					.onChange((value) => {
						this.corsHeaders = value;
					});
			});

		// Buttons section
		const buttonContainer = contentEl.createDiv({ cls: 'tasknotes-webhook-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'tasknotes-webhook-modal-btn cancel',
			attr: { 'aria-label': 'Cancel webhook creation' }
		});
		const cancelIcon = cancelBtn.createSpan({ cls: 'tasknotes-webhook-modal-btn-icon' });
		setIcon(cancelIcon, 'x');
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonContainer.createEl('button', {
			text: 'Add Webhook',
			cls: 'tasknotes-webhook-modal-btn save mod-cta',
			attr: { 'aria-label': 'Create webhook' }
		});
		const saveIcon = saveBtn.createSpan({ cls: 'tasknotes-webhook-modal-btn-icon' });
		setIcon(saveIcon, 'plus');

		saveBtn.onclick = () => {
			if (!this.url.trim()) {
				new Notice('Webhook URL is required');
				return;
			}

			if (this.selectedEvents.length === 0) {
				new Notice('Please select at least one event');
				return;
			}

			this.onSubmit({
				url: this.url.trim(),
				events: this.selectedEvents as any[],
				transformFile: this.transformFile.trim() || undefined,
				corsHeaders: this.corsHeaders
			});

			this.close();
		};
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
