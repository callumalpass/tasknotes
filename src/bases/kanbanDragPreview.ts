import { createElementInDocument } from "../utils/documentDom";

export class KanbanDragPreview {
	private floatingDragPreviewEl: HTMLElement | null = null;
	private floatingDragPreviewDocument: Document | null = null;
	private floatingDragPreviewMoveHandler: ((event: DragEvent) => void) | null = null;
	private floatingDragPreviewRafId: number | null = null;
	private floatingDragPreviewWidth = 280;
	private floatingDragPreviewHeight = 40;
	private floatingDragPreviewPendingX = 0;
	private floatingDragPreviewPendingY = 0;
	private invalidReason: string | null = null;
	show(
		sourceElement: HTMLElement,
		event: Pick<DragEvent, "clientX" | "clientY">,
		count: number,
		fallbackTitle: string,
		className?: string
	): void {
		this.destroy();

		const doc = sourceElement.ownerDocument;
		const body = doc.body;
		if (!body) return;

		const rect = sourceElement.getBoundingClientRect();
		const preview = createElementInDocument(doc, "div");
		const title = this.getFloatingDragPreviewTitle(sourceElement, fallbackTitle);
		const titleEl = createElementInDocument(doc, "span");

		titleEl.className = "kanban-view__floating-drag-preview-title";
		titleEl.textContent = title;

		preview.classList.add("tasknotes-plugin", "kanban-view__floating-drag-preview");
		if (className) preview.classList.add(className);
		const sourceCard = sourceElement.matches(".task-card")
			? sourceElement
			: sourceElement.querySelector(".task-card");
		if (sourceCard) {
			const wrapper = preview.createDiv({ cls: "kanban-view__card-wrapper" });
			const card = sourceCard.cloneNode(true) as HTMLElement;
			card.classList.remove(
				"task-card--selected", "task-card--selected-primary", "tn-task-focused", "tn-task-arrived",
				"task-card--dragging", "task-list-view__drag-source", "kanban-view__card--dragging",
				"task-card--reorderable", "task-card--drag-handle-only"
			);
			card.querySelectorAll(".task-card__drag-handle").forEach(element => element.remove());
			card.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
			card.removeAttribute("id");
			card.removeAttribute("data-task-path");
			card.removeAttribute("data-keyboard-id");
			card.querySelectorAll("[data-task-path], [data-keyboard-id]").forEach(element => {
				element.removeAttribute("data-task-path");
				element.removeAttribute("data-keyboard-id");
			});
			wrapper.appendChild(card);
		} else {
			preview.appendChild(titleEl);
		}
		preview.setAttribute("aria-hidden", "true");
		preview.setAttribute("draggable", "false");
		preview.inert = true;
		if (count > 1) {
			preview.dataset.dragCount = `${count}`;
		}
		this.floatingDragPreviewWidth = Math.min(Math.max(rect.width, 180), 320);
		preview.setCssProps({
			"--tn-kanban-drag-preview-width": `${this.floatingDragPreviewWidth}px`,
			"--tn-kanban-drag-preview-transform": "translate3d(-9999px, -9999px, 0)",
		});

		body.appendChild(preview);
		this.floatingDragPreviewHeight = preview.getBoundingClientRect().height;
		this.floatingDragPreviewEl = preview;
		this.floatingDragPreviewDocument = doc;

		const handleMove = (dragEvent: DragEvent) => {
			this.move(dragEvent.clientX, dragEvent.clientY);
		};
		this.floatingDragPreviewMoveHandler = handleMove;
		doc.addEventListener("drag", handleMove, true);
		doc.addEventListener("dragover", handleMove, true);

		this.move(event.clientX, event.clientY);
	}

	setInvalid(reason: string | null): void {
		const preview = this.floatingDragPreviewEl;
		if (!preview || this.invalidReason === reason) return;
		this.invalidReason = reason;
		preview.classList.toggle("kanban-view__floating-drag-preview--invalid", reason !== null);
		let feedback = preview.querySelector<HTMLElement>(".kanban-view__drag-feedback");
		if (reason) {
			feedback ??= preview.createDiv({ cls: "kanban-view__drag-feedback", attr: { role: "status" } });
			feedback.textContent = reason;
		} else {
			feedback?.remove();
		}
		this.floatingDragPreviewHeight = preview.getBoundingClientRect().height;
	}

	move(clientX: number, clientY: number): void {
		const preview = this.floatingDragPreviewEl;
		if (!preview || (clientX === 0 && clientY === 0)) return;

		const win = preview.ownerDocument.defaultView ?? window;
		const margin = 8;
		const offset = 14;
		const width = this.floatingDragPreviewWidth;
		const height = this.floatingDragPreviewHeight;
		let x = clientX + offset;
		let y = clientY + offset;

		if (x + width > win.innerWidth - margin) {
			x = clientX - width - offset;
		}
		if (y + height > win.innerHeight - margin) {
			y = clientY - height - offset;
		}

		x = Math.max(margin, Math.min(x, Math.max(margin, win.innerWidth - width - margin)));
		y = Math.max(margin, Math.min(y, Math.max(margin, win.innerHeight - height - margin)));
		x += win.scrollX;
		y += win.scrollY;
		this.floatingDragPreviewPendingX = x;
		this.floatingDragPreviewPendingY = y;

		if (this.floatingDragPreviewRafId !== null) {
			return;
		}

		this.floatingDragPreviewRafId = win.requestAnimationFrame(() => {
			this.floatingDragPreviewRafId = null;
			const pendingX = this.floatingDragPreviewPendingX;
			const pendingY = this.floatingDragPreviewPendingY;
			this.floatingDragPreviewEl?.setCssProps({
				"--tn-kanban-drag-preview-transform": `translate3d(${pendingX}px, ${pendingY}px, 0)`,
			});
		});
	}

	private getFloatingDragPreviewTitle(sourceElement: HTMLElement, fallbackTitle: string): string {
		const title =
			sourceElement.querySelector<HTMLElement>(".task-card__title-text")?.textContent ||
			sourceElement.querySelector<HTMLElement>(".task-card__title")?.textContent ||
			sourceElement.dataset.taskPath?.split("/").pop()?.replace(/\.md$/i, "") ||
			fallbackTitle;
		const normalized = title.trim().replace(/\s+/g, " ");
		return normalized.length > 80 ? `${normalized.slice(0, 77).trimEnd()}...` : normalized;
	}

	destroy(): void {
		this.invalidReason = null;
		if (this.floatingDragPreviewRafId !== null) {
			const win = this.floatingDragPreviewDocument?.defaultView ?? window;
			win.cancelAnimationFrame(this.floatingDragPreviewRafId);
			this.floatingDragPreviewRafId = null;
		}
		if (this.floatingDragPreviewMoveHandler && this.floatingDragPreviewDocument) {
			this.floatingDragPreviewDocument.removeEventListener(
				"drag",
				this.floatingDragPreviewMoveHandler,
				true
			);
			this.floatingDragPreviewDocument.removeEventListener(
				"dragover",
				this.floatingDragPreviewMoveHandler,
				true
			);
		}
		this.floatingDragPreviewEl?.remove();
		this.floatingDragPreviewEl = null;
		this.floatingDragPreviewDocument = null;
		this.floatingDragPreviewMoveHandler = null;
		this.floatingDragPreviewWidth = 280;
		this.floatingDragPreviewHeight = 40;
		this.floatingDragPreviewPendingX = 0;
		this.floatingDragPreviewPendingY = 0;
	}
}
