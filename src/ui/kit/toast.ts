import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";
export interface ToastAction {
	label: string;
	run: () => void | Promise<unknown>;
}

export class UndoConflictError extends Error {
	constructor(readonly notePaths: readonly string[]) {
		super(`Note changed: ${notePaths.join(", ")}`);
	}
}

export interface ToastOptions {
	message: string;
	intent?: "error";
	action?: ToastAction;
	durationMs?: number;
	undoScope?: object;
	undoMessage?: string;
}

const DEFAULT_DURATION_MS = 5000;
const histories = new WeakMap<object, Array<ToastAction & { message: string; undoMessage?: string }>>();
const running = new WeakMap<object, Promise<void>>();
let toastRevision = 0;

export async function undoLatest(scope: object): Promise<void> {
	const previous = running.get(scope) ?? Promise.resolve();
	const pending = previous.then(async () => {
		const revision = toastRevision;
		const history = histories.get(scope);
		const action = history?.[history.length - 1];
		if (!action) return;
		try {
			await action.run();
			const index = history?.indexOf(action) ?? -1;
			if (index >= 0) history?.splice(index, 1);
			if (toastRevision === revision) {
				showToast({
					message: action.undoMessage ?? uiText(msg({ message: "Undid: {action}", context: "interaction undo confirmation" }), { action: action.message }),
				});
			}
		} catch (error) {
			if (toastRevision !== revision) return;
			showToast({
				intent: "error",
				message: `${action.message} · ${uiText(
					msg({
						message: "Cannot undo: the note has changed.",
						context: "interaction undo conflict",
					})
				)}${error instanceof UndoConflictError ? ` · ${error.notePaths.join(", ")}` : ""}`,
			});
		}
	});
	running.set(scope, pending);
	await pending;
	if (running.get(scope) === pending) running.delete(scope);
}

export function registerUndoKeyboard(root: HTMLElement, scope: object): () => void {
	const listener = (event: KeyboardEvent) => {
		if (
			!(event.ctrlKey || event.metaKey) ||
			event.shiftKey ||
			event.altKey ||
			event.key.toLowerCase() !== "z"
		)
			return;
		const target = event.target as HTMLElement | null;
		const inlineControl = target?.closest(".task-card--layout-inline [role=button], .task-card--layout-inline button");
		if (!inlineControl && target?.closest("input, textarea, [contenteditable=true], .cm-editor")) return;
		if (!histories.get(scope)?.length) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		void undoLatest(scope);
	};
	root.addEventListener("keydown", listener, true);
	return () => root.removeEventListener("keydown", listener, true);
}

/** One-line transient message. Prefer this over Notice when the action can be undone. */
export function showToast(options: ToastOptions): { dismiss: () => void } {
	toastRevision++;
	const doc = activeDocument;
	const win = doc.defaultView ?? window;
	doc.body.querySelector(".tn-toast")?.dispatchEvent(new Event("tn-dismiss"));
	const focused = doc.activeElement as HTMLElement | null;
	const returnFocus =
		focused?.closest<HTMLElement>(
			".tn-tasknotesTaskList, .tn-tasknotesKanban, .tn-tasknotesCalendar, .advanced-calendar-view"
		) ??
		doc.querySelector<HTMLElement>(".workspace-leaf.mod-active .tasknotes-plugin[tabindex]");
	let action = options.action;
	if (action && options.undoScope) {
		const scope = options.undoScope;
		const history = histories.get(scope) ?? [];
		const entry = { ...action, message: options.message, undoMessage: options.undoMessage };
		history.push(entry);
		if (history.length > 20) history.shift();
		histories.set(scope, history);
		action = {
			label: entry.label,
			run: async () => {
				if (history[history.length - 1] !== entry) return;
				await undoLatest(scope);
			},
		};
	}

	const el = doc.body.createDiv({
		cls: `tasknotes-plugin tn-toast${options.intent === "error" ? " is-error" : ""}`,
		attr: { role: options.intent === "error" ? "alert" : "status", "aria-live": options.intent === "error" ? "assertive" : "polite" },
	});
	el.createSpan({ cls: "tn-toast__message", text: options.message });

	const dismiss = () => {
		win.clearTimeout(timer);
		el.remove();
	};
	let remaining = options.durationMs ?? DEFAULT_DURATION_MS;
	let started = Date.now();
	let timer = win.setTimeout(dismiss, remaining);
	let paused = false;
	let actionPending = false;
	const pause = () => {
		if (paused) return;
		paused = true;
		win.clearTimeout(timer);
		remaining = Math.max(0, remaining - (Date.now() - started));
	};
	const resume = () => {
		if (!paused || actionPending || el.matches(":hover") || el.contains(doc.activeElement)) return;
		paused = false;
		started = Date.now();
		timer = win.setTimeout(dismiss, remaining);
	};
	el.addEventListener("tn-dismiss", dismiss);
	el.addEventListener("mouseenter", pause);
	el.addEventListener("mouseleave", resume);
	el.addEventListener("focusin", pause);
	el.addEventListener("focusout", () => queueMicrotask(resume));

	if (action) {
		const { label, run } = action;
		const button = el.createEl("button", { cls: "tn-toast__action", text: label });
		button.addEventListener("click", () => {
			if (button.disabled) return;
			pause();
			actionPending = true;
			button.disabled = true;
			button.setAttribute("aria-busy", "true");
			if (returnFocus?.isConnected) returnFocus.focus();
			void Promise.resolve().then(run).then(
				() => {
					actionPending = false;
					dismiss();
					if (returnFocus?.isConnected) returnFocus.focus();
				},
				() => {
					actionPending = false;
					button.disabled = false;
					button.removeAttribute("aria-busy");
					el.addClass("is-error");
					el.setAttribute("role", "alert");
					el.setAttribute("aria-live", "assertive");
				}
			);
		});
	}

	return { dismiss };
}
