import {
	App,
	Constructor,
	Scope,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { EditorSelection, Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder, ViewUpdate, tooltips } from "@codemirror/view";
import { around } from "monkey-around";

/* eslint-disable no-undef, no-restricted-globals */
declare const app: App;

// Internal Obsidian type - not exported in official API
interface ScrollableMarkdownEditor {
	app: App;
	containerEl: HTMLElement;
	editor: any;
	editorEl: HTMLElement;
	activeCM: any;
	owner: any;
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
	editMode: any;
	showEditor(): void;
	unload(): void;
}

/**
 * Resolves the internal ScrollableMarkdownEditor prototype from Obsidian
 * @param app - The Obsidian App instance
 * @returns The ScrollableMarkdownEditor constructor
 */
function resolveEditorPrototype(app: App): Constructor<ScrollableMarkdownEditor> {
	// @ts-expect-error - Using internal API
	const widgetEditorView = app.embedRegistry.embedByExtension.md(
		{ app, containerEl: document.createElement("div") },
		null as unknown as TFile,
		""
	) as WidgetEditorView;

	widgetEditorView.editable = true;
	widgetEditorView.showEditor();

	const MarkdownEditor = Object.getPrototypeOf(
		Object.getPrototypeOf(widgetEditorView.editMode!)
	);

	widgetEditorView.unload();
	return MarkdownEditor.constructor as Constructor<ScrollableMarkdownEditor>;
}

/**
 * Gets the editor base class, with fallback for test environments
 * @returns The ScrollableMarkdownEditor constructor or a mock for tests
 */
function getEditorBase(): Constructor<ScrollableMarkdownEditor> {
	// In test environments, app won't be defined, so return a mock base class
	if (typeof app === 'undefined') {
		return class MockScrollableMarkdownEditor {
			app: any;
			containerEl: HTMLElement = document.createElement('div');
			editor: any;
			editorEl: HTMLElement = document.createElement('div');
			activeCM: any;
			owner: any = { editMode: null, editor: null };
			_loaded: boolean = false;
			set(value: string): void {}
			onUpdate(update: ViewUpdate, changed: boolean): void {}
			buildLocalExtensions(): Extension[] { return []; }
			destroy(): void {}
			unload(): void {}
			constructor(app: App, container: HTMLElement, options: any) {
				this.app = app;
				this.containerEl = container;
			}
		} as any as Constructor<ScrollableMarkdownEditor>;
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
	onTab?: (editor: EmbeddableMarkdownEditor) => boolean;
	/** Handler for Ctrl/Cmd+Enter */
	onSubmit?: (editor: EmbeddableMarkdownEditor) => void;
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
}

const defaultProperties: Required<MarkdownEditorProps> = {
	cursorLocation: undefined as any, // Don't set cursor by default
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
};

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
	options: Required<MarkdownEditorProps>;
	initial_value: string;
	scope: Scope;
	private uninstaller?: () => void;
	private hasEnteredVimInsertMode = false;

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

		this.owner.editMode = this;
		this.owner.editor = this.editor;

		// IMPORTANT: From Obsidian 1.5.8+, must explicitly set value
		this.set(options.value || "");

		// Prevent workspace from stealing focus when editing
		this.uninstaller = around(this.app.workspace, {
			setActiveLeaf: (oldMethod: any) => {
				return function (this: any, ...args: any[]) {
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
			this.app.workspace.activeEditor = this.owner;

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
				selection: EditorSelection.range(
					options.cursorLocation.anchor,
					options.cursorLocation.head
				),
			});
		}
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
		setTimeout(() => {
			try {
				// Check if vim mode is enabled in Obsidian settings
				const vimModeEnabled = (this.app.vault as any).getConfig("vimMode");
				if (!vimModeEnabled) return;

				// Access the Vim API from Obsidian's CodeMirrorAdapter
				const Vim = (window as any).CodeMirrorAdapter?.Vim;
				if (!Vim) return;

				// Get the CM5 adapter - Obsidian nests it at editor.cm.cm
				// Fallback to activeCM if the standard path doesn't work
				const cm5 = (this.editor as any)?.cm?.cm ?? (this as any).activeCM;
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

		// Explicitly hide line numbers with CSS
		extensions.push(
			EditorView.theme({
				".cm-lineNumbers": { display: "none !important" },
				".cm-gutters": { display: "none !important" },
			})
		);

		extensions.push(
			tooltips({
				parent: document.body,
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
						key: "Mod-Enter",
						run: (cm) => {
							this.options.onSubmit(this);
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
							return this.options.onTab(this);
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
		this.app.workspace.activeEditor = null;

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
