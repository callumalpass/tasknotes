import type { CalendarEventItem } from "./calendarEngine";
import type { CalendarBatchProposal } from "./calendarBatchMove";

interface CalendarBatchPreviewOptions {
	root: HTMLElement;
	getItems(): readonly CalendarEventItem[];
	/** Stable identity of the current canonical item set; invalidates the proposal cache. */
	getRevision(): unknown;
	build(proposal: CalendarBatchProposal): CalendarEventItem[] | null;
	upsert(items: CalendarEventItem[]): void;
	remove(ids: string[]): void;
	onInvalidDrop(): void;
}

/** Paint peers through the engine's public API; never replace the canonical item set. */
export class CalendarBatchPreview {
	private pointerId: number | null = null;
	private previewIds = new Set<string>();
	private denied = false;
	private lastKey: string | null = null;
	private lastRevision: unknown;
	private readonly cleanup: Array<() => void> = [];
	private boundDocument: Document | null = null;
	private unbindDocument: (() => void) | null = null;

	constructor(private readonly options: CalendarBatchPreviewOptions) {
		const { root } = options;
		const start = (event: PointerEvent) => {
			if (event.isPrimary === false || event.button !== 0) return;
			this.bindDocument();
			this.clear();
			const target = event.target as Element | null;
			if (target?.closest(".tnc-item") && !target.closest(".tnc-resize")) this.pointerId = event.pointerId;
		};
		root.addEventListener("pointerdown", start, true);
		this.cleanup.push(() => root.removeEventListener("pointerdown", start, true));
		this.bindDocument();
	}

	/** Root listeners move with Obsidian popouts; document listeners must follow them. */
	private bindDocument(): void {
		const doc = this.options.root.ownerDocument;
		if (doc === this.boundDocument) return;
		this.clear();
		this.unbindDocument?.();
		this.boundDocument = doc;
		const win = doc.defaultView;
		const end = (event: PointerEvent) => {
			if (event.pointerId !== this.pointerId) return;
			const invalid = this.denied && event.type === "pointerup";
			this.clear();
			if (invalid) this.options.onInvalidDrop();
		};
		const key = (event: KeyboardEvent) => { if (event.key === "Escape") this.clear(); };
		const blur = () => this.clear();
		const visibility = () => { if (doc.hidden) this.clear(); };
		doc.addEventListener("pointerup", end, true);
		doc.addEventListener("pointercancel", end, true);
		doc.addEventListener("keydown", key, true);
		doc.addEventListener("visibilitychange", visibility);
		win?.addEventListener("blur", blur);
		this.unbindDocument = () => {
			doc.removeEventListener("pointerup", end, true);
			doc.removeEventListener("pointercancel", end, true);
			doc.removeEventListener("keydown", key, true);
			doc.removeEventListener("visibilitychange", visibility);
			win?.removeEventListener("blur", blur);
		};
	}

	/** Called by canDrop before the engine paints the dragged anchor. Resizes/keyboard skip it. */
	allow(proposal: CalendarBatchProposal): boolean {
		if (this.pointerId === null) return true;
		const key = `${proposal.item.id}:${proposal.start.getTime()}:${proposal.end.getTime()}:${proposal.allDay}`;
		const revision = this.options.getRevision();
		if (key === this.lastKey && revision === this.lastRevision) return !this.denied;
		this.restore();
		this.lastKey = key;
		this.lastRevision = revision;
		this.denied = false;
		try {
			const items = this.options.build(proposal);
			if (items?.length) {
				this.previewIds = new Set(items.map(item => item.id));
				this.options.upsert(items);
			}
		} catch {
			this.restore();
			this.denied = true;
		}
		return !this.denied;
	}

	/** A full source refresh supersedes preview items, so need not repaint the old set. */
	clear(restore = true): void {
		if (restore) this.restore();
		else this.previewIds.clear();
		this.pointerId = null;
		this.denied = false;
		this.lastKey = null;
		this.lastRevision = undefined;
	}

	private restore(): void {
		if (!this.previewIds.size) return;
		const ids = this.previewIds;
		this.previewIds = new Set();
		// Read the latest source values, not snapshots that could overwrite a concurrent refresh.
		const items = this.options.getItems().filter(item => ids.has(item.id));
		const present = new Set(items.map(item => item.id));
		const removed = [...ids].filter(id => !present.has(id));
		if (items.length) this.options.upsert([...items]);
		if (removed.length) this.options.remove(removed);
	}

	dispose(): void {
		this.clear();
		this.unbindDocument?.();
		this.unbindDocument = null;
		this.boundDocument = null;
		for (const cleanup of this.cleanup) cleanup();
	}
}
