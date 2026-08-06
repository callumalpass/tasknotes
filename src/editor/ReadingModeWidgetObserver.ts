import { MarkdownView, WorkspaceLeaf } from "obsidian";
import { shouldSkipMarkdownWidgetLeaf } from "./MarkdownWidgetContext";

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
	shouldRefresh: (leaf: WorkspaceLeaf) => boolean
): void {
	const containerEl = getReadingModeContainer(leaf);
	if (!containerEl || observedContainers.has(containerEl)) {
		return;
	}

	let pendingFrame: FrameHandle | null = null;
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
			if (sizer && !sizer.querySelector(widgetSelector)) {
				scheduleInjection(leaf);
			}
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
		observer.disconnect();
	});
}
