import { Component, Scope } from "obsidian";
import type TaskNotesPlugin from "../main";
import { TaskListFocusController } from "./TaskListFocusController";
import { TaskListInputOwnershipController } from "./TaskListInputOwnershipController";
import { resolveTaskListTargetPaths } from "./taskListTargetResolver";
import {
	resolveTaskListKeyboardAction,
	taskListShortcutToScopeBinding,
	TASK_LIST_KEYBOARD_ACTIONS,
	type TaskListAction,
} from "./taskListKeyboardActions";
import { executeBasesTaskCardAction, type BasesTaskCardActionContext } from "./basesTaskCardActions";

/**
 * Everything a view must supply to run task-card actions. The controller fills
 * in the focus/overlay-bound fields (`getTargetPaths`, `restoreFocus`, `getAnchor`,
 * `onOverlayClosed`) itself from its own focus and input-ownership state.
 */
export type BasesTaskCardActionViewContext = Omit<
	BasesTaskCardActionContext,
	"getTargetPaths" | "restoreFocus" | "getAnchor" | "onOverlayClosed"
> & {
	/** Anchor to use for context menus when no card is currently focused. */
	fallbackAnchor?: HTMLElement | null;
};

export interface BasesTaskCardKeyboardOptions {
	/** Whether hover may currently claim task-card focus (embedded-note guard). */
	canClaimHover?: () => boolean;
	/** Whether keyboard focus should land on a card as soon as the view first renders. */
	autoFocusInitial?: boolean;
	/**
	 * The sub-element that actually renders task cards (e.g. Task List's item
	 * container), as opposed to chrome like a toolbar or search box that also
	 * lives under `root`. A root-level keydown whose target falls outside this
	 * element is allowed to fall back to the remembered focused card; one whose
	 * target falls inside it defers to whatever `TaskListFocusController` itself
	 * resolves from the target. Defaults to `root` when omitted.
	 */
	cardAreaElement?: HTMLElement;
	/**
	 * Whether `action` is currently dispatchable by this view. Unsupported actions
	 * are left untouched so the key can still reach Obsidian's own commands. Called
	 * live on every keydown, so a view whose supported set changes at runtime (for
	 * example Calendar switching between list and grid modes) reacts immediately.
	 */
	isActionSupported(action: TaskListAction): boolean;
	/** Builds the view-supplied half of the action context; called once per dispatch. */
	buildViewContext(): BasesTaskCardActionViewContext;
}

type LeafLike = { view?: { containerEl?: HTMLElement } } | null;

const NAVIGATION_DIRECTIONS = {
	"navigate-next": "next",
	"navigate-previous": "previous",
	"jump-first": "first",
	"jump-last": "last",
} as const;

const OVERLAY_ACTIONS: ReadonlySet<TaskListAction> = new Set([
	"edit-task",
	"open-context-menu",
	"edit-due",
	"edit-scheduled",
	"edit-priority",
	"mark-complete",
	"edit-status",
	"edit-recurrence",
	"add-tags",
	"add-context",
	"add-project",
	"delete-tasks",
]);

function opensOverlay(action: TaskListAction): boolean {
	return OVERLAY_ACTIONS.has(action) || action.startsWith("edit-user-field:");
}

/**
 * Owns roving task-card focus, keyboard-shortcut dispatch, and Obsidian Scope
 * activation for one Bases task-card view (Task List, Kanban, or Calendar's
 * Agenda/list mode). Generalized out of `TaskListView`'s original private
 * focus/input-ownership/keydown wiring so every card-based Bases view shares one
 * implementation instead of each reimplementing it.
 */
export class BasesTaskCardKeyboardController {
	readonly focusController: TaskListFocusController;
	private readonly inputOwnershipController: TaskListInputOwnershipController;
	private readonly cardAreaElement: HTMLElement;
	private leafActive = false;
	private shortcutScope: Scope | null = null;

	constructor(
		private readonly component: Component,
		private readonly root: HTMLElement,
		private readonly containerEl: HTMLElement,
		private readonly plugin: TaskNotesPlugin,
		private readonly options: BasesTaskCardKeyboardOptions
	) {
		this.cardAreaElement = options.cardAreaElement ?? root;
		this.focusController = new TaskListFocusController(
			root,
			options.autoFocusInitial ?? false,
			options.canClaimHover ?? (() => true)
		);
		this.inputOwnershipController = new TaskListInputOwnershipController(root, this.focusController);
		this.registerListeners();
	}

	prepareForRender(): void {
		this.focusController.prepareForRender();
	}

	restoreAfterRender(): void {
		this.focusController.restoreAfterRender();
	}

	/** Shared gate for the Shift+Arrow range-select shortcuts BasesViewBase wires up. */
	canHandleSelectionKeyDown(event: KeyboardEvent): boolean {
		return (
			this.inputOwnershipController.canHandleListKeyDown(event) &&
			event.shiftKey &&
			["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
		);
	}


	/**
	 * Exposed so a view's own supplementary keydown handling — for example
	 * Calendar's grid-mode hover-target hotkeys, which have no card to
	 * anchor a roving focus model to — can share this controller's editable
	 * target / open-overlay guard instead of building a second one.
	 */
	canHandleKeyDown(event: KeyboardEvent, allowDocumentBody = false): boolean {
		return this.inputOwnershipController.canHandleListKeyDown(event, allowDocumentBody);
	}

	destroy(): void {
		this.deactivateShortcutScope();
		this.inputOwnershipController.destroy();
		this.focusController.clear();
	}

	private registerListeners(): void {
		const { component, root, plugin } = this;
		component.registerDomEvent(root, "focusin", (event: FocusEvent) => {
			this.focusController.handleFocusIn(event);
		});
		component.registerDomEvent(root, "pointerdown", (event: PointerEvent) => {
			this.focusController.handlePointerDown(event);
		});
		component.registerDomEvent(root, "mousemove", (event: MouseEvent) => {
			// Context-menu edits operate on the focused task/selection. While an
			// Obsidian menu is open, hovering cards underneath it must not move the
			// cursor and change the edit target.
			if (root.ownerDocument.querySelector(".menu")) return;
			this.focusController.handleMouseMove(event);
		});
		// Resolve view-local shortcuts during capture so Obsidian commands such as
		// Ctrl+B/Ctrl+D cannot stop propagation before this view sees a configured chord.
		component.registerDomEvent(
			root,
			"keydown",
			(event: KeyboardEvent) => this.handleRootKeyDown(event),
			true
		);

		const doc = root.ownerDocument;
		component.registerDomEvent(doc, "focusin", (event: FocusEvent) => {
			this.inputOwnershipController.handleDocumentFocusIn(event);
			this.syncShortcutScopeForFocusTarget(event.target);
		});
		component.registerDomEvent(doc, "pointerdown", (event: PointerEvent) => {
			this.inputOwnershipController.handleOverlayInteraction(event);
		});
		component.registerDomEvent(
			doc,
			"keydown",
			(event: KeyboardEvent) => {
				if (event.key === "Escape" || event.key === "Backspace") {
					this.inputOwnershipController.handleOverlayInteraction(event);
				}
			},
			true
		);

		component.registerEvent(
			plugin.app.workspace.on("active-leaf-change", (leaf) => {
				this.syncShortcutScopeForLeaf(leaf);
				this.restoreFocusForActivatedLeaf(leaf);
			})
		);
		component.registerDomEvent(
			doc,
			"click",
			(event: MouseEvent) => {
				const target = event.target;
				if (!(target instanceof Element) || !target.closest(".workspace-tab-header")) return;
				const win = doc.defaultView ?? window;
				win.setTimeout(() => {
					const leaf = plugin.app.workspace.getMostRecentLeaf();
					this.syncShortcutScopeForLeaf(leaf);
					this.restoreFocusForActivatedLeaf(leaf);
				}, 0);
			},
			true
		);

		this.syncShortcutScopeForLeaf(plugin.app.workspace.getMostRecentLeaf());
	}

private handleRootKeyDown(event: KeyboardEvent): void {
		const startedInCardArea = this.cardAreaElement.contains(event.target as Node);
		this.handleKeyDown(event, !startedInCardArea);
	}

	private isThisLeaf(leaf: LeafLike): boolean {
		return Boolean(leaf?.view?.containerEl?.contains(this.containerEl));
	}

	private restoreFocusForActivatedLeaf(leaf: LeafLike): void {
		if (!this.isThisLeaf(leaf)) return;

		const win = this.containerEl.ownerDocument.defaultView ?? window;
		win.setTimeout(() => {
			if (this.root.isConnected) this.focusController.restoreFocusedElement();
		}, 0);
	}

	private syncShortcutScopeForLeaf(leaf: LeafLike): void {
		this.leafActive = this.isThisLeaf(leaf);
		this.syncShortcutScopeForFocusTarget(this.containerEl.ownerDocument.activeElement);
	}

	private syncShortcutScopeForFocusTarget(target: EventTarget | null): void {
		if (this.leafActive && this.inputOwnershipController.canOwnKeyboardTarget(target, true)) {
			this.activateShortcutScope();
			return;
		}
		this.deactivateShortcutScope();
	}

	private activateShortcutScope(): void {
		if (this.shortcutScope) return;

		// A child Obsidian scope lets view-local configurable chords win over global
		// editor commands while this view's leaf is active.
		const scope = new Scope(this.plugin.app.scope);
		const shortcuts = this.plugin.settings.taskListShortcuts;
		const userFieldShortcuts = this.plugin.settings.taskListUserFieldShortcuts ?? {};
		const allShortcuts: string[] = [
			...TASK_LIST_KEYBOARD_ACTIONS.flatMap((action) => shortcuts[action] ?? []),
			...Object.values(userFieldShortcuts).flat(),
		];
		for (const shortcut of allShortcuts) {
			const binding = taskListShortcutToScopeBinding(shortcut);
			if (!binding) continue;
			scope.register(binding.modifiers, binding.key, (event) => {
				if (!this.leafActive) return;
				if (!this.handleKeyDown(event, true)) return;
				return false;
			});
		}

		this.shortcutScope = scope;
		this.plugin.app.keymap.pushScope(scope);
	}

	private deactivateShortcutScope(): void {
		if (!this.shortcutScope) return;
		this.plugin.app.keymap.popScope(this.shortcutScope);
		this.shortcutScope = null;
	}

	private handleKeyDown(event: KeyboardEvent, allowRememberedFocus = false): boolean {
		if (!this.inputOwnershipController.canHandleListKeyDown(event, allowRememberedFocus)) {
			return false;
		}
		return this.handleActionKeyDown(event, allowRememberedFocus);
	}

	private handleActionKeyDown(event: KeyboardEvent, allowRememberedFocus: boolean): boolean {
		const action = resolveTaskListKeyboardAction(
			event,
			this.plugin.settings.taskListShortcuts,
			this.plugin.settings.taskListUserFieldShortcuts
		);
		if (!action || !this.options.isActionSupported(action)) return false;

		const focusedPath = this.focusController.getFocusedPathForEvent(
			event,
			true,
			allowRememberedFocus
		);
		if (!focusedPath && action !== "clear-focus-and-selection" && action !== "select-all") {
			return false;
		}

		if (action in NAVIGATION_DIRECTIONS) {
			return this.focusController.moveFocus(
				event,
				NAVIGATION_DIRECTIONS[action as keyof typeof NAVIGATION_DIRECTIONS]
			);
		}

		event.preventDefault();
		event.stopPropagation();
		if (opensOverlay(action)) {
			// User-field editors are overlays too; recording this before opening lets
			// input ownership restore the remembered card when the modal closes.
			this.inputOwnershipController.noteOverlayOpening();
		}
		void executeBasesTaskCardAction(action, focusedPath ?? null, this.buildActionContext());
		return true;
	}

	private buildActionContext(): BasesTaskCardActionContext {
		const viewContext = this.options.buildViewContext();
		return {
			...viewContext,
			getTargetPaths: () =>
				resolveTaskListTargetPaths(
					viewContext.taskSelectionService,
					this.focusController.getFocusedIdentity()?.path
				).filter((path) => viewContext.isPathVisible(path)),
			restoreFocus: () => this.focusController.restoreFocusedElement(),
			getAnchor: () =>
				this.focusController.getFocusedElement() ?? viewContext.fallbackAnchor ?? null,
			onOverlayClosed: () => this.restoreAfterOverlayClose(),
		};
	}

	/** Restores card focus after Obsidian completes its modal selection cleanup. */
	private restoreAfterOverlayClose(): void {
		// Obsidian restores the modal's saved selection after onClose; defer card
		// focus until that cleanup has finished so keyboard ownership is retained.
		const win = this.containerEl.ownerDocument.defaultView ?? window;
		win.setTimeout(() => {
			this.focusController.restoreFocusedElement();
			this.inputOwnershipController.resumeAfterOverlayClose();
			this.syncShortcutScopeForFocusTarget(this.containerEl.ownerDocument.activeElement);
			if (this.leafActive) this.activateShortcutScope();
		}, 0);
	}
}
