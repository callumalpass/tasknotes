import { MarkdownView, WorkspaceLeaf } from "obsidian";
import { shouldSkipMarkdownWidgetLeaf } from "./MarkdownWidgetContext";

/**
 * How long after the last scroll event re-injection stays deferred.
 *
 * Obsidian's virtualised reading view deletes direct children of
 * `.markdown-preview-sizer` on every render pass (`setChildrenInPlace`), so a
 * widget injected between sections is removed again while the user scrolls.
 * Re-injecting per frame against that churn perturbs the renderer's scroll
 * model and makes the note visibly jump (#2255). These widgets sit at the top
 * or bottom of the note, so deferring their return until scrolling settles is
 * invisible in practice and stops the add/remove cycle.
 */
export const DEFAULT_SCROLL_QUIET_PERIOD_MS = 200;

export interface ReadingModeObserverOptions {
	/** Override the quiet period; 0 disables scroll deferral (used by tests). */
	scrollQuietPeriodMs?: number;
}

type FrameHandle = {
	id: number;
	cancel: () => void;
};

function scheduleBeforePaint(win: Window, callback: () => void): FrameHandle {
	if (typeof win.requestAnimationFrame === "function") {
		const id = win.requestAnimationFrame(callback);
		return {
			id,
			cancel: () => win.cancelAnimationFrame(id),
		};
	}

	const id = win.setTimeout(callback, 0);
	return {
		id,
		cancel: () => win.clearTimeout(id),
	};
}

function nowIn(win: Window): number {
	if (typeof win.performance?.now === "function") {
		return win.performance.now();
	}
	return Date.now();
}

function nodeContainsSelector(node: Node, selector: string): boolean {
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return false;
	}

	const element = node as Element;
	return element.matches(selector) || Boolean(element.querySelector(selector));
}

function mutationTouchesPreviewWidget(mutation: MutationRecord, widgetSelector: string): boolean {
	const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
	return changedNodes.some(
		(node) =>
			nodeContainsSelector(node, widgetSelector) ||
			nodeContainsSelector(node, ".markdown-preview-sizer")
	);
}

function getReadingModeContainer(leaf: WorkspaceLeaf): HTMLElement | null {
	const view = leaf.view;
	if (!(view instanceof MarkdownView) || view.getMode() !== "preview") {
		return null;
	}

	if (shouldSkipMarkdownWidgetLeaf(leaf)) {
		return null;
	}

	return view.previewMode.containerEl;
}

export function observeReadingModeWidgetMutations(
	leaf: WorkspaceLeaf,
	widgetSelector: string,
	scheduleInjection: (leaf: WorkspaceLeaf) => void,
	observedContainers: WeakSet<HTMLElement>,
	cleanupCallbacks: Array<() => void>,
	shouldRefresh: (leaf: WorkspaceLeaf) => boolean,
	options: ReadingModeObserverOptions = {}
): void {
	const containerEl = getReadingModeContainer(leaf);
	if (!containerEl || observedContainers.has(containerEl)) {
		return;
	}

	const scrollQuietPeriodMs = options.scrollQuietPeriodMs ?? DEFAULT_SCROLL_QUIET_PERIOD_MS;

	let pendingFrame: FrameHandle | null = null;
	let lastScrollAt = Number.NEGATIVE_INFINITY;

	const handleScroll = () => {
		lastScrollAt = nowIn(containerEl.ownerDocument.defaultView ?? window);
	};

	// Scroll events do not bubble, so capture them from the container down to
	// catch whichever descendant is the actual preview scroller.
	containerEl.addEventListener("scroll", handleScroll, { capture: true, passive: true });

	const requestRefresh = () => {
		if (pendingFrame) {
			return;
		}

		const win = containerEl.ownerDocument.defaultView ?? window;
		pendingFrame = scheduleBeforePaint(win, () => {
			pendingFrame = null;
			if (!containerEl.isConnected || !shouldRefresh(leaf)) {
				return;
			}

			const sizer = containerEl.querySelector<HTMLElement>(".markdown-preview-sizer");
			if (!sizer || sizer.querySelector(widgetSelector)) {
				return;
			}

			// While scrolling, Obsidian's own virtualisation keeps removing the
			// widget. Re-injecting every frame only creates DOM churn and scroll
			// corrections, so wait until scrolling settles before restoring it.
			if (scrollQuietPeriodMs > 0 && nowIn(win) - lastScrollAt < scrollQuietPeriodMs) {
				requestRefresh();
				return;
			}

			scheduleInjection(leaf);
		});
	};

	const observer = new MutationObserver((mutations) => {
		if (mutations.some((mutation) => mutationTouchesPreviewWidget(mutation, widgetSelector))) {
			requestRefresh();
		}
	});

	observer.observe(containerEl, {
		childList: true,
		subtree: true,
	});

	observedContainers.add(containerEl);
	cleanupCallbacks.push(() => {
		pendingFrame?.cancel();
		containerEl.removeEventListener("scroll", handleScroll, { capture: true });
		observer.disconnect();
	});
}
