import { Extension, RangeSetBuilder, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { setIcon, MarkdownView, Editor, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import { TasksPluginParser } from "../utils/TasksPluginParser";

class ConvertButtonWidget extends WidgetType {
	private plugin: TaskNotesPlugin;
	private lineNumber: number;

	constructor(plugin: TaskNotesPlugin, lineNumber: number) {
		super();
		this.plugin = plugin;
		this.lineNumber = lineNumber;
	}

	toDOM(view: EditorView): HTMLElement {
		// Create container with proper class structure
		const container = document.createElement("span");
		container.className = "tasknotes-plugin";

		const button = container.createEl("button", {
			cls: "instant-convert-button",
			attr: { "aria-label": "Convert to TaskNote" },
		});
		setTooltip(button, "Convert to TaskNote", { placement: "top" });

		// Add the convert icon
		const iconSpan = button.createEl("span", { cls: "instant-convert-button__icon" });
		setIcon(iconSpan, "file-plus");

		// Handle mousedown to capture selection before it gets cleared by click
		button.addEventListener("mousedown", async (e) => {
			e.preventDefault();
			e.stopPropagation();

			try {
				// Validate button state before proceeding
				if (!this.validateButtonClick()) {
					return;
				}

				// Get the editor from the active markdown view
				const activeMarkdownView =
					this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (!activeMarkdownView) {
					console.warn("No active markdown view available for task conversion");
					return;
				}
				const editor = activeMarkdownView.editor;

				// Validate editor and line number
				if (!this.validateEditorState(editor)) {
					return;
				}

				// Call the instant convert service
				if (this.plugin.instantTaskConvertService && editor) {
					await this.plugin.instantTaskConvertService.instantConvertTask(
						editor,
						this.lineNumber
					);
				}
			} catch (error) {
				console.error("Error in convert button click handler:", error);
			}
		});

		return container;
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof ConvertButtonWidget &&
			other.plugin === this.plugin &&
			other.lineNumber === this.lineNumber
		);
	}

	get estimatedHeight(): number {
		return -1; // Indicates inline widget
	}

	ignoreEvent(): boolean {
		return false;
	}

	/**
	 * Validate button click conditions
	 */
	private validateButtonClick(): boolean {
		if (!this.plugin) {
			console.warn("Plugin not available for task conversion");
			return false;
		}

		if (!this.plugin.settings.enableInstantTaskConvert) {
			console.warn("Instant task conversion is disabled");
			return false;
		}

		if (typeof this.lineNumber !== "number" || this.lineNumber < 0) {
			console.warn("Invalid line number for task conversion:", this.lineNumber);
			return false;
		}

		return true;
	}

	/**
	 * Validate editor state and line number
	 */
	private validateEditorState(editor: unknown): boolean {
		if (!editor) {
			console.warn("Editor not available for task conversion");
			return false;
		}

		const totalLines = (editor as Editor).lineCount();
		if (this.lineNumber >= totalLines) {
			console.warn(
				`Line number ${this.lineNumber} is out of bounds (total lines: ${totalLines})`
			);
			return false;
		}

		// Verify the line still contains a task
		try {
			const currentLine = (editor as Editor).getLine(this.lineNumber);
			if (!currentLine) {
				console.warn(`Cannot read line ${this.lineNumber}`);
				return false;
			}

			const taskLineInfo = TasksPluginParser.parseTaskLine(currentLine);
			if (!taskLineInfo.isTaskLine) {
				console.warn(`Line ${this.lineNumber} is no longer a task`);
				return false;
			}

			return true;
		} catch (error) {
			console.warn("Error validating line content:", error);
			return false;
		}
	}
}

export function createInstantConvertField(plugin: TaskNotesPlugin) {
	return StateField.define<DecorationSet>({
		create(): DecorationSet {
			return Decoration.none;
		},

		update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
			// Validate inputs
			if (!plugin || !transaction) {
				return Decoration.none;
			}

			if (!plugin.settings || !plugin.settings.enableInstantTaskConvert) {
				return Decoration.none;
			}

			// Safety check for transaction state
			if (!transaction.state) {
				console.warn("Invalid transaction state in instant convert field update");
				return Decoration.none;
			}

			try {
				// Only rebuild on document changes or when needed
				if (!transaction.docChanged && oldState !== Decoration.none) {
					return oldState.map(transaction.changes);
				}

				return buildConvertButtonDecorations(transaction.state, plugin);
			} catch (error) {
				console.error("Error updating instant convert decorations:", error);
				return Decoration.none;
			}
		},

		provide(field: StateField<DecorationSet>): Extension {
			return EditorView.decorations.from(field);
		},
	});
}

function buildConvertButtonDecorations(
	state: { doc: { lines: number; line(n: number): { text: string; to: number } } },
	plugin: TaskNotesPlugin
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const doc = state.doc;

	// Validate inputs
	if (!doc || !plugin) {
		console.warn("Invalid state or plugin for building convert button decorations");
		return builder.finish();
	}

	// Safety check for doc.lines
	if (typeof doc.lines !== "number" || doc.lines < 0) {
		console.warn("Invalid document lines count:", doc.lines);
		return builder.finish();
	}

	// Process each line looking for checkbox tasks
	for (let lineIndex = 0; lineIndex < doc.lines; lineIndex++) {
		try {
			const line = doc.line(lineIndex + 1);
			if (!line || typeof line.text !== "string") {
				continue; // Skip invalid lines
			}

			const lineText = line.text;

			// Validate line content length to prevent processing extremely long lines
			if (lineText.length > 1000) {
				continue; // Skip extremely long lines for performance
			}

			// Parse the line to see if it's any checkbox task
			const taskLineInfo = TasksPluginParser.parseTaskLine(lineText);

			if (taskLineInfo.isTaskLine && taskLineInfo.parsedData) {
				// Additional validation for task data
				if (
					!taskLineInfo.parsedData.title ||
					taskLineInfo.parsedData.title.trim().length === 0
				) {
					continue; // Skip tasks without valid titles
				}

				// Validate line positions
				if (typeof line.to !== "number" || line.to < 0) {
					continue; // Skip lines with invalid positions
				}

				// Create a button widget at the end of the line
				const widget = new ConvertButtonWidget(plugin, lineIndex);
				const decoration = Decoration.widget({
					widget: widget,
					side: 1, // Position after the line content
				});

				builder.add(line.to, line.to, decoration);
			}
		} catch (error) {
			// Log error but continue processing other lines
			console.debug("Error processing line", lineIndex, ":", error);
			continue;
		}
	}

	return builder.finish();
}

export function createInstantConvertButtons(plugin: TaskNotesPlugin): Extension {
	return createInstantConvertField(plugin);
}
