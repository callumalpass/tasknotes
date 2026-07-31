import {
	App,
	Constructor,
	Scope,
	TFile,
	type Editor,
	type EditorPosition,
	type EditorSelection,
	type EditorSelectionOrCaret,
	type EditorTransaction,
} from "obsidian";
import { EditorSelection as CMEditorSelection, Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder, ViewUpdate, tooltips } from "@codemirror/view";
import { around } from "monkey-around";

declare const app: App;

type Nullable<T> = T | null;
type OneOf<T, U> = T | U;

// Internal Obsidian type - not exported in official API
interface ScrollableMarkdownEditor {
	app: App;
	containerEl: HTMLElement;
	editor: MarkdownEditorInternal;
	editorEl: HTMLElement;
	activeCM: unknown;
	owner: MarkdownEditorOwner;
	_loaded: boolean;
	set(value: string): void;
	onUpdate(update: ViewUpdate, changed: boolean): void;
	buildLocalExtensions(): Extension[];
	destroy(): void;
	unload(): void;
}

// Internal Obsidian type - not exported in official API
interface WidgetEditorView {
	editable: boolean;
	editMode: unknown;
	showEditor(): void;
	unload(): void;
}

type MarkdownEditorInternal = {
	cm: {
		cm?: unknown;
		contentDOM: HTMLElement;
		focus(): void;
		scrollDOM: HTMLElement;
		dispatch(spec: unknown): void;
		state: {
			doc: {
				toString(): string;
			};
		};
	};
};

type MarkdownEditorOwner = {
	editMode: unknown;
	editor: MarkdownEditorInternal | null;
};

type ActiveMarkdownEditorOwner = {
	editMode: unknown;
	editor: Editor;
	file: Nullable<TFile>;
	getMode(): "source";
};

type WorkspaceWithActiveEditor = {
	activeEditor: ActiveMarkdownEditorOwner | null;
};

type ActiveLeafContext = {
	activeCM?: {
		hasFocus?: boolean;
	};
};

type VaultWithConfig = {
	getConfig(key: string): unknown;
};

type WindowWithCodeMirrorAdapter = Window & {
	CodeMirrorAdapter?: {
		Vim?: {
			handleKey(cm: unknown, key: string, origin: string): void;
		};
	};
};

/**
 * Resolves the internal ScrollableMarkdownEditor prototype from Obsidian
 * @param app - The Obsidian App instance
 * @returns The ScrollableMarkdownEditor constructor
 */
function resolveEditorPrototype(app: App): Constructor<ScrollableMarkdownEditor> {
	const activeFile = app.workspace.getActiveFile();
	if (!(activeFile instanceof TFile)) {
		throw new Error(
			"Cannot resolve markdown editor prototype without an active markdown file."
		);
	}

	// @ts-expect-error - Using internal API
	const widgetEditorView = app.embedRegistry.embedByExtension.md(
		{ app, containerEl: activeDocument.createElement("div") },
		activeFile,
		""
	) as WidgetEditorView;

	widgetEditorView.editable = true;
	widgetEditorView.showEditor();

	const editMode = widgetEditorView.editMode;
	if (!editMode) {
		widgetEditorView.unload();
		throw new Error("Markdown editor edit mode was not initialized");
	}

	const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(editMode));

	widgetEditorView.unload();
	return MarkdownEditor.constructor as Constructor<ScrollableMarkdownEditor>;
}

/**
 * Gets the editor base class, with fallback for test environments
 * @returns The ScrollableMarkdownEditor constructor or a mock for tests
 */
function getEditorBase(): Constructor<ScrollableMarkdownEditor> {
	// In test environments, app won't be defined, so return a mock base class
	if (typeof app === "undefined") {
		return class MockScrollableMarkdownEditor {
			app: App;
			containerEl: HTMLElement = activeDocument.createElement("div");
			editor: MarkdownEditorInternal = {
				cm: new EditorView(),
			};
			editorEl: HTMLElement = activeDocument.createElement("div");
			activeCM: unknown;
			owner: MarkdownEditorOwner = { editMode: null, editor: null };
			_loaded = false;
			set(value: string): void {
				const view = this.editor.cm as unknown as EditorView;
				view.dispatch({
					changes: {
						from: 0,
						to: view.state.doc.length,
						insert: value,
					},
				});
			}
			onUpdate(update: ViewUpdate, changed: boolean): void {}
			buildLocalExtensions(): Extension[] {
				return [];
			}
			destroy(): void {}
			unload(): void {}
			constructor(app: App, container: HTMLElement, options: unknown) {
				this.app = app;
				this.containerEl = container;
			}
		};
	}
	return resolveEditorPrototype(app);
}

export interface MarkdownEditorProps {
	/** Initial cursor position */
	cursorLocation?: { anchor: number; head: number };
	/** Initial text content */
	value?: string;
	/** CSS class to add to editor element */
	cls?: string;
	/** Placeholder text when empty */
	placeholder?: string;
	/** Handler for Enter key (return false to use default behavior) */
	onEnter?: (editor: EmbeddableMarkdownEditor, mod: boolean, shift: boolean) => boolean;
	/** Handler for Escape key */
	onEscape?: (editor: EmbeddableMarkdownEditor) => void;
	/** Handler for Tab key (return false to use default behavior) */
	onTab?: (editor: EmbeddableMarkdownEditor, shift: boolean) => boolean;
	/** Handler for Ctrl/Cmd+Enter */
	onSubmit?: (editor: EmbeddableMarkdownEditor, shift: boolean) => void;
	/** Handler for blur event */
	onBlur?: (editor: EmbeddableMarkdownEditor) => void;
	/** Handler for paste event */
	onPaste?: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
	/** Handler for content changes */
	onChange?: (value: string, update: ViewUpdate) => void;
	/** Additional CodeMirror extensions (e.g., autocomplete) */
	extensions?: Extension[];
	/** Automatically enter vim insert mode on first focus when vim keybindings are enabled */
	enterVimInsertMode?: boolean;
	/** File associated with this modal editor for plugins that read workspace.activeEditor */
	file?: Nullable<TFile>;
}

type ResolvedMarkdownEditorProps = Required<Omit<MarkdownEditorProps, "cursorLocation" | "file">> &
	Pick<MarkdownEditorProps, "cursorLocation" | "file">;

const defaultProperties: ResolvedMarkdownEditorProps = {
	cursorLocation: undefined, // Don't set cursor by default
	value: "",
	cls: "",
	placeholder: "",
	onEnter: () => false,
	onEscape: () => {},
	onTab: () => false,
	onSubmit: () => {},
	onBlur: () => {},
	onPaste: () => {},
	onChange: () => {},
	extensions: [],
	enterVimInsertMode: false,
	file: undefined,
};

export function getMarkdownEditorTooltipParent(container: HTMLElement): HTMLElement {
	return container.ownerDocument?.body ?? activeDocument.body;
}

class CodeMirrorEditorAdapter {
	constructor(private readonly view: EditorView) {}

	getDoc(): CodeMirrorEditorAdapter {
		return this;
	}

	getValue(): string {
		return this.view.state.doc.toString();
	}

	setValue(content: string): void {
		this.view.dispatch({
			changes: {
				from: 0,
				to: this.view.state.doc.length,
				insert: content,
			},
		});
	}

	getLine(line: number): string {
		return this.view.state.doc.line(line + 1).text;
	}

	lineCount(): number {
		return this.view.state.doc.lines;
	}

	lastLine(): number {
		return this.lineCount() - 1;
	}

	getSelection(): string {
		const range = this.view.state.selection.main;
		return this.view.state.doc.sliceString(range.from, range.to);
	}

	somethingSelected(): boolean {
		return !this.view.state.selection.main.empty;
	}

	setHeading(level: number): void {
		const normalizedLevel = Math.max(0, Math.min(6, Number(level) || 0));
		const marker = normalizedLevel > 0 ? `${"#".repeat(normalizedLevel)} ` : "";

		this.updateSelectedLines((line) => {
			const withoutHeading = line.replace(/^ {0,3}#{1,6}\s+/, "");
			return `${marker}${withoutHeading}`;
		});
	}

	toggleBulletList(): void {
		const lines = this.getSelectedLines();
		const shouldRemove = lines.some((line) => /^\s*[-*+]\s+/.test(line.text));

		this.updateSelectedLines((line) => {
			if (shouldRemove) {
				return line.replace(/^(\s*)[-*+]\s+/, "$1");
			}
			const [, indent = "", content = ""] = line.match(/^(\s*)(.*)$/) ?? [];
			return `${indent}- ${content}`;
		});
	}

	toggleNumberedList(): void {
		const lines = this.getSelectedLines();
		const shouldRemove = lines.some((line) => /^\s*\d+[.)]\s+/.test(line.text));

		this.updateSelectedLines((line, index) => {
			if (shouldRemove) {
				return line.replace(/^(\s*)\d+[.)]\s+/, "$1");
			}
			const [, indent = "", content = ""] = line.match(/^(\s*)(.*)$/) ?? [];
			return `${indent}${index + 1}. ${content}`;
		});
	}

	toggleNumberList(): void {
		this.toggleNumberedList();
	}

	toggleCheckListStatus(): void {
		this.updateSelectedLines((line) => {
			if (/^(\s*[-*+]\s+\[[ xX]\]\s*)/.test(line)) {
				return line.replace(/^(\s*[-*+]\s+\[)([ xX])(\]\s*)/, (_match, prefix, state, suffix) =>
					`${prefix}${state.toLowerCase() === "x" ? " " : "x"}${suffix}`
				);
			}
			if (/^\s*[-*+]\s+/.test(line)) {
				return line.replace(/^(\s*[-*+]\s+)/, "$1[ ] ");
			}
			const [, indent = "", content = ""] = line.match(/^(\s*)(.*)$/) ?? [];
			return `${indent}- [ ] ${content}`;
		});
	}

	toggleCheckList(): void {
		this.toggleCheckListStatus();
	}

	getRange(from: EditorPosition, to: EditorPosition): string {
		return this.view.state.doc.sliceString(this.posToOffset(from), this.posToOffset(to));
	}

	replaceSelection(replacement: string): void {
		const transaction = this.view.state.changeByRange((range) => ({
			changes: {
				from: range.from,
				to: range.to,
				insert: replacement,
			},
			range: CMEditorSelection.cursor(range.from + replacement.length),
		}));

		this.view.dispatch(transaction);
	}

	replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition): void {
		this.view.dispatch({
			changes: {
				from: this.posToOffset(from),
				to: this.posToOffset(to ?? from),
				insert: replacement,
			},
		});
	}

	getCursor(side: "from" | "to" | "head" | "anchor" = "head"): EditorPosition {
		const range = this.view.state.selection.main;
		switch (side) {
			case "from":
				return this.offsetToPos(range.from);
			case "to":
				return this.offsetToPos(range.to);
			case "anchor":
				return this.offsetToPos(range.anchor);
			case "head":
			default:
				return this.offsetToPos(range.head);
		}
	}

	listSelections(): EditorSelection[] {
		return this.view.state.selection.ranges.map((range) => ({
			anchor: this.offsetToPos(range.anchor),
			head: this.offsetToPos(range.head),
		}));
	}

	setCursor(pos: OneOf<EditorPosition, number>, ch?: number): void {
		if (typeof pos === "number") {
			this.setSelection({ line: pos, ch: ch ?? 0 });
			return;
		}

		this.setSelection(pos);
	}

	setSelection(anchor: EditorPosition, head?: EditorPosition): void {
		this.view.dispatch({
			selection: CMEditorSelection.range(
				this.posToOffset(anchor),
				this.posToOffset(head ?? anchor)
			),
		});
	}

	setSelections(ranges: EditorSelectionOrCaret[], main = 0): void {
		if (ranges.length === 0) return;

		this.view.dispatch({
			selection: CMEditorSelection.create(
				ranges.map((range) =>
					CMEditorSelection.range(
						this.posToOffset(range.anchor),
						this.posToOffset(range.head ?? range.anchor)
					)
				),
				main
			),
		});
	}

	focus(): void {
		this.view.focus();
	}

	blur(): void {
		this.view.contentDOM.blur();
	}

	hasFocus(): boolean {
		return this.view.hasFocus;
	}

	transaction(tx: EditorTransaction): void {
		if (tx.replaceSelection !== undefined) {
			this.replaceSelection(tx.replaceSelection);
			return;
		}

		const changes = tx.changes?.map((change) => ({
			from: this.posToOffset(change.from),
			to: this.posToOffset(change.to ?? change.from),
			insert: change.text,
		}));

		const selections = tx.selections ?? (tx.selection ? [tx.selection] : undefined);
		this.view.dispatch({
			...(changes ? { changes } : {}),
			...(selections && selections.length > 0
				? {
						selection: CMEditorSelection.create(
							selections.map((selection) =>
								CMEditorSelection.range(
									this.posToOffset(selection.from),
									this.posToOffset(selection.to ?? selection.from)
								)
							)
						),
					}
				: {}),
		});
	}

	posToOffset(pos: EditorPosition): number {
		const lineNumber = Math.max(1, Math.min(pos.line + 1, this.view.state.doc.lines));
		const line = this.view.state.doc.line(lineNumber);
		return Math.max(line.from, Math.min(line.from + pos.ch, line.to));
	}

	offsetToPos(offset: number): EditorPosition {
		const clampedOffset = Math.max(0, Math.min(offset, this.view.state.doc.length));
		const line = this.view.state.doc.lineAt(clampedOffset);
		return {
			line: line.number - 1,
			ch: clampedOffset - line.from,
		};
	}

	private getSelectedLines(): Array<{ number: number; text: string }> {
		const doc = this.view.state.doc;
		const lineNumbers = new Set<number>();

		for (const range of this.view.state.selection.ranges) {
			const from = Math.min(range.from, range.to);
			const to = Math.max(range.from, range.to);
			const fromLine = doc.lineAt(from).number;
			let toLine = doc.lineAt(to).number;

			if (toLine > fromLine && to === doc.line(toLine).from) {
				toLine -= 1;
			}

			for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
				lineNumbers.add(lineNumber);
			}
		}

		return Array.from(lineNumbers)
			.sort((a, b) => a - b)
			.map((lineNumber) => {
				const line = doc.line(lineNumber);
				return { number: lineNumber, text: line.text };
			});
	}

	private updateSelectedLines(
		transformLine: (line: string, selectedLineIndex: number) => string
	): void {
		const doc = this.view.state.doc;
		const changes = this.getSelectedLines().map((line, index) => {
			const docLine = doc.line(line.number);
			return {
				from: docLine.from,
				to: docLine.to,
				insert: transformLine(line.text, index),
			};
		});

		if (changes.length === 0) return;

		this.view.dispatch({ changes });
	}
}

/**
 * An embeddable markdown editor that provides full CodeMirror editing capabilities
 * within any container element. Based on Fevol's implementation.
 *
 * @example
 * ```typescript
 * const editor = new EmbeddableMarkdownEditor(app, containerEl, {
 *   value: "Initial content",
 *   placeholder: "Enter text...",
 *   onChange: (value) => console.log(value)
 * });
 *
 * // Later, clean up
 * editor.destroy();
 * ```
 */
export class EmbeddableMarkdownEditor extends getEditorBase() {
	options: ResolvedMarkdownEditorProps;
	initial_value: string;
	scope: Scope;
	private uninstaller?: () => void;
	private hasEnteredVimInsertMode = false;
	private activeEditorOwner: ActiveMarkdownEditorOwner;

	constructor(app: App, container: HTMLElement, options: Partial<MarkdownEditorProps> = {}) {
		super(app, container, {
			app,
			onMarkdownScroll: () => {},
			getMode: () => "source",
		});

		this.options = { ...defaultProperties, ...options };
		this.initial_value = this.options.value;
		this.scope = new Scope(this.app.scope);

		// Override Mod+Enter to prevent default workspace behavior
		this.scope.register(["Mod"], "Enter", (e, ctx) => true);
		this.scope.register(["Mod", "Shift"], "Enter", (e, ctx) => true);

		this.owner.editMode = this;
		this.owner.editor = this.editor;
		this.activeEditorOwner = {
			editMode: this,
			editor: new CodeMirrorEditorAdapter(this.editor.cm as unknown as EditorView) as unknown as Editor,
			file: this.getActiveEditorFile(),
			getMode: () => "source",
		};

		// IMPORTANT: From Obsidian 1.5.8+, must explicitly set value
		this.set(options.value || "");

		// Prevent workspace from stealing focus when editing
		this.uninstaller = around(this.app.workspace, {
			setActiveLeaf: (oldMethod: (this: unknown, ...args: unknown[]) => unknown) => {
				return function (this: ActiveLeafContext, ...args: unknown[]) {
					if (!this.activeCM?.hasFocus) {
						oldMethod.call(this, ...args);
					}
				};
			},
		});

		// Set up blur handler
		if (this.options.onBlur !== defaultProperties.onBlur) {
			this.editor.cm.contentDOM.addEventListener("blur", () => {
				this.app.keymap.popScope(this.scope);
				if (this._loaded) this.options.onBlur(this);
			});
		}

		// Set up focus handler
		this.editor.cm.contentDOM.addEventListener("focusin", () => {
			this.app.keymap.pushScope(this.scope);
			this.activeEditorOwner.file = this.getActiveEditorFile();
			(this.app.workspace as unknown as WorkspaceWithActiveEditor).activeEditor =
				this.activeEditorOwner;

			// Enter vim insert mode on first focus if requested and vim mode is enabled
			if (this.options.enterVimInsertMode && !this.hasEnteredVimInsertMode) {
				this.hasEnteredVimInsertMode = true;
				this.enterVimInsertMode();
			}
		});

		// Add custom CSS class if provided
		if (options.cls) {
			this.editorEl.classList.add(options.cls);
		}

		// Set initial cursor position
		if (options.cursorLocation) {
			this.editor.cm.dispatch({
				selection: CMEditorSelection.range(
					options.cursorLocation.anchor,
					options.cursorLocation.head
				),
			});
		}
	}

	private getActiveEditorFile(): Nullable<TFile> {
		if (this.options.file !== undefined) {
			return this.options.file ?? null;
		}

		return this.app.workspace.getActiveFile();
	}

	/**
	 * Get the current text content of the editor
	 */
	get value(): string {
		return this.editor.cm.state.doc.toString();
	}

	/**
	 * Set the text content of the editor
	 */
	setValue(value: string): void {
		this.set(value);
	}

	/**
	 * Enter vim insert mode if vim keybindings are enabled in Obsidian.
	 * Uses Obsidian's internal CodeMirrorAdapter.Vim API.
	 */
	private enterVimInsertMode(): void {
		// Use a small delay to ensure vim extension has initialized
		window.setTimeout(() => {
			try {
				// Check if vim mode is enabled in Obsidian settings
				const vimModeEnabled = (this.app.vault as VaultWithConfig).getConfig("vimMode");
				if (!vimModeEnabled) return;

				// Access the Vim API from Obsidian's CodeMirrorAdapter
				const Vim = (window as unknown as WindowWithCodeMirrorAdapter).CodeMirrorAdapter?.Vim;
				if (!Vim) return;

				// Get the CM5 adapter - Obsidian nests it at editor.cm.cm
				// Fallback to activeCM if the standard path doesn't work
				const cm5 = this.editor.cm.cm ?? this.activeCM;
				if (!cm5) return;

				// Enter insert mode by simulating the 'i' key
				Vim.handleKey(cm5, "i", "api");
			} catch {
				// Silently fail if vim integration isn't available
			}
		}, 50);
	}

	/**
	 * Override to handle content changes
	 */
	onUpdate(update: ViewUpdate, changed: boolean): void {
		super.onUpdate(update, changed);
		if (changed) {
			this.options.onChange(this.value, update);
		}
	}

	/**
	 * Build CodeMirror extensions for the editor
	 * This is where we add keyboard handlers and other editor features
	 */
	buildLocalExtensions(): Extension[] {
		const extensions = super.buildLocalExtensions();

		extensions.push(
			tooltips({
				parent: getMarkdownEditorTooltipParent(this.containerEl),
			})
		);

		// Add placeholder if specified
		if (this.options.placeholder) {
			extensions.push(placeholder(this.options.placeholder));
		}

		// Add paste handler
		extensions.push(
			EditorView.domEventHandlers({
				paste: (event) => {
					this.options.onPaste(event, this);
				},
			})
		);

		// Add keyboard handlers with highest precedence
		extensions.push(
			Prec.highest(
				keymap.of([
					{
						key: "Enter",
						run: (cm) => this.options.onEnter(this, false, false),
						shift: (cm) => this.options.onEnter(this, false, true),
					},
					{
						key: "Shift-Mod-Enter",
						run: (cm) => {
							this.options.onSubmit(this, true);
							return true;
						},
					},
					{
						key: "Mod-Enter",
						run: (cm) => {
							this.options.onSubmit(this, false);
							return true;
						},
					},
					{
						key: "Escape",
						run: (cm) => {
							this.options.onEscape(this);
							return true;
						},
					},
					{
						key: "Tab",
						run: (cm) => {
							return this.options.onTab(this, false);
						},
					},
					{
						key: "Shift-Tab",
						run: (cm) => {
							return this.options.onTab(this, true);
						},
					},
				])
			)
		);

		// Add any custom extensions (e.g., autocomplete)
		if (this.options.extensions && this.options.extensions.length > 0) {
			extensions.push(...this.options.extensions);
		}

		return extensions;
	}

	/**
	 * Clean up the editor and remove all event listeners
	 */
	destroy(): void {
		if (this._loaded) {
			this.unload();
		}

		this.app.keymap.popScope(this.scope);
		const workspace = this.app.workspace as unknown as WorkspaceWithActiveEditor;
		if (workspace.activeEditor === this.activeEditorOwner) {
			workspace.activeEditor = null;
		}

		// Call uninstaller to remove monkey-patching
		if (this.uninstaller) {
			this.uninstaller();
			this.uninstaller = undefined;
		}

		this.containerEl.empty();
		super.destroy();
	}

	/**
	 * Obsidian lifecycle method
	 */
	onunload(): void {
		this.destroy();
	}
}
