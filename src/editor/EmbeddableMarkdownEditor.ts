import { App, Constructor, Scope, TFile, type Editor, type EventRef } from "obsidian";
import { EditorSelection as CMEditorSelection, Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder, ViewUpdate, tooltips } from "@codemirror/view";
import { acceptCompletion, selectedCompletion } from "@codemirror/autocomplete";
import { around } from "monkey-around";
import { EMBEDDED_MARKDOWN_EDITOR_CLASS } from "./MarkdownWidgetContext";
import { resolveMarkdownEditorPrototype } from "./resolveMarkdownEditorPrototype";

declare const app: App;

type Nullable<T> = T | null;

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
 * Gets the editor base class, with fallback for test environments
 * @returns The ScrollableMarkdownEditor constructor or a mock for tests
 */
function getEditorBase(): Constructor<ScrollableMarkdownEditor> {
	// In test environments, app won't be defined, so return a mock base class
	if (typeof app === "undefined") {
		return class MockScrollableMarkdownEditor {
			app: App;
			containerEl: HTMLElement = activeWindow.createDiv();
			editor: MarkdownEditorInternal = {
				cm: new EditorView(),
			};
			editorEl: HTMLElement = activeWindow.createDiv();
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
	return resolveMarkdownEditorPrototype<ScrollableMarkdownEditor>(app);
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
	private menuHiddenByCurrentEvent = false;
	private editorMenuRef?: EventRef;

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
			// The real editor, not a stand-in: Obsidian's commands and plugins such as
			// Templater act on this object and rely on its whole API.
			editor: this.editor as unknown as Editor,
			file: this.getActiveEditorFile(),
			getMode: () => "source",
		};

		// Set before the value, so note widgets never build in an editor that has no note.
		this.editorEl.classList.add(EMBEDDED_MARKDOWN_EDITOR_CLASS);

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

		// Set up blur handler. The scope must always be released: left on the stack, it
		// masks the host modal's scope and Escape stops closing the modal.
		this.editor.cm.contentDOM.addEventListener("blur", () => {
			this.app.keymap.popScope(this.scope);
			if (this._loaded) this.options.onBlur(this);
		});

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

		this.editorMenuRef = this.app.workspace.on?.("editor-menu", (menu, editor) => {
			if ((editor as unknown) !== this.editor) return;
			menu.onHide(() => {
				this.menuHiddenByCurrentEvent = true;
				window.setTimeout(() => (this.menuHiddenByCurrentEvent = false));
			});
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
	 * Whether a visible autocomplete suggestion can be selected. A completion query
	 * that is still pending, with nothing shown, does not count.
	 */
	get hasSelectableCompletion(): boolean {
		return selectedCompletion((this.editor.cm as unknown as EditorView).state) !== null;
	}

	/**
	 * Accept the selected autocomplete suggestion. Returns false if none can be
	 * accepted yet, for example while the popup is within its interaction delay.
	 */
	acceptCompletion(): boolean {
		return acceptCompletion(this.editor.cm as unknown as EditorView);
	}

	/**
	 * Set the text content of the editor
	 */
	setValue(value: string): void {
		this.set(value);
	}

	/**
	 * Focus the editor with its text selected, or with the cursor at the end.
	 */
	focusWithSelection(selection: "all" | "end"): void {
		const length = this.editor.cm.state.doc.toString().length;
		this.editor.cm.focus();
		this.editor.cm.dispatch({
			selection: { anchor: selection === "all" ? 0 : length, head: length },
		});
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
							// Obsidian hides a menu on Escape, then lets the same key reach the editor.
							if (this.menuHiddenByCurrentEvent) return true;
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

		if (this.editorMenuRef) {
			this.app.workspace.offref(this.editorMenuRef);
			this.editorMenuRef = undefined;
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
