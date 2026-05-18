import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
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
		const container = activeDocument.createElement("span");
		container.className = "tasknotes-plugin";

		const button = container.createEl("button", {
			cls: "instant-convert-button",
			attr: { "aria-label": "Convert to tasknote" },
		});
		setTooltip(button, "Convert to TaskNote", { placement: "top" });

		// Add the convert icon
		const iconSpan = button.createEl("span", { cls: "instant-convert-button__icon" });
		setIcon(iconSpan, "file-plus");

		const handleActivation = (e: Event) => {
			e.preventDefault();
			e.stopPropagation();
			void (async () => {
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
			})();
		};

		// Capture the selection before a later click/focus event can clear it. Pointer events
		// cover touch and pen input on mobile while preserving the desktop mouse path.
		const activationEvent =
			typeof window !== "undefined" && "PointerEvent" in window ? "pointerdown" : "mousedown";
		button.addEventListener(activationEvent, handleActivation);

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
	return ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet;
			private enabled: boolean;

			constructor(view: EditorView) {
				this.enabled = Boolean(plugin?.settings?.enableInstantTaskConvert);
				this.decorations = this.enabled
					? buildConvertButtonDecorations(view, plugin)
					: Decoration.none;
			}

			update(update: ViewUpdate): void {
				const enabled = Boolean(plugin?.settings?.enableInstantTaskConvert);

				if (!enabled) {
					this.enabled = false;
					this.decorations = Decoration.none;
					return;
				}

				if (!this.enabled || update.docChanged || update.viewportChanged) {
					this.enabled = true;
					this.decorations = buildConvertButtonDecorations(update.view, plugin);
				}
			}
		},
		{
			decorations: (value) => value.decorations,
		}
	);
}

type ConvertButtonDocument = {
	lines: number;
	length: number;
	line(n: number): { number: number; from: number; text: string; to: number };
	lineAt(pos: number): { number: number; from: number; text: string; to: number };
};

type ConvertButtonView = {
	state: { doc: ConvertButtonDocument };
	visibleRanges: readonly { from: number; to: number }[];
};

export function buildConvertButtonDecorations(
	view: ConvertButtonView,
	plugin: TaskNotesPlugin
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const doc = view.state?.doc;

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

	const seenLineNumbers = new Set<number>();
	const ranges =
		view.visibleRanges.length > 0
			? view.visibleRanges
			: [{ from: 0, to: doc.length }];

	for (const range of ranges) {
		try {
			let line = doc.lineAt(Math.max(0, Math.min(range.from, doc.length)));

			while (line && line.from <= range.to) {
				if (!seenLineNumbers.has(line.number)) {
					seenLineNumbers.add(line.number);
					addConvertButtonDecorationForLine(builder, plugin, line);
				}

				if (line.number >= doc.lines || line.to >= doc.length) {
					break;
				}

				line = doc.line(line.number + 1);
			}
		} catch (error) {
			console.debug("Error processing visible range", range, ":", error);
		}
	}

	return builder.finish();
}

function addConvertButtonDecorationForLine(
	builder: RangeSetBuilder<Decoration>,
	plugin: TaskNotesPlugin,
	line: { number: number; text: string; to: number }
): void {
	try {
		if (!line || typeof line.text !== "string") {
			return;
		}

		const lineText = line.text;

		// Validate line content length to prevent processing extremely long lines
		if (lineText.length > 1000) {
			return;
		}

		// Parse the line to see if it's any checkbox task
		const taskLineInfo = TasksPluginParser.parseTaskLine(lineText);

		if (taskLineInfo.isTaskLine && taskLineInfo.parsedData) {
			// Additional validation for task data
			if (
				!taskLineInfo.parsedData.title ||
				taskLineInfo.parsedData.title.trim().length === 0
			) {
				return;
			}

			// Validate line positions
			if (typeof line.to !== "number" || line.to < 0) {
				return;
			}

			// Create a button widget at the end of the line
			const widget = new ConvertButtonWidget(plugin, line.number - 1);
			const decoration = Decoration.widget({
				widget: widget,
				side: 1, // Position after the line content
			});

			builder.add(line.to, line.to, decoration);
		}
	} catch (error) {
		console.debug("Error processing line", line.number, ":", error);
	}
}

export function createInstantConvertButtons(plugin: TaskNotesPlugin): Extension {
	return createInstantConvertField(plugin);
}
