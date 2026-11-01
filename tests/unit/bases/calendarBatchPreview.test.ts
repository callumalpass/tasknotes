import { CalendarBatchPreview } from "../../../src/bases/calendarBatchPreview";
import type { CalendarBatchProposal } from "../../../src/bases/calendarBatchMove";
import type { CalendarEventItem } from "../../../src/bases/calendarEngine";

const item = (id: string, start = "2026-11-02T09:00"): CalendarEventItem => ({ id, title: id, start });
function pointer(target: EventTarget, type: string, id = 7) {
	target.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, button: 0 }), { pointerId: id, isPrimary: true }));
}
function harness() {
	const root = document.createElement("div");
	const el = root.appendChild(document.createElement("div")); el.className = "tnc-item";
	const grip = el.appendChild(document.createElement("span")); grip.className = "tnc-resize";
	document.body.append(root);
	const original = item("peer");
	let items = [item("anchor"), original];
	const preview = { ...original, start: "2026-11-03T09:00", isPreview: true };
	const upsert = jest.fn(), remove = jest.fn(), invalid = jest.fn();
	const build = jest.fn(() => [preview]);
	const controller = new CalendarBatchPreview({ root, getItems: () => items, getRevision: () => items,
		build, upsert, remove, onInvalidDrop: invalid });
	const proposal: CalendarBatchProposal = { item: items[0], start: new Date("2026-11-03T09:00Z"), end: new Date("2026-11-03T10:00Z"), allDay: false };
	return { root, el, grip, original, preview, upsert, remove, invalid, build, controller, proposal,
		setItems(next: CalendarEventItem[]) { items = next; } };
}
afterEach(() => { document.body.replaceChildren(); });

it("paints peer proposals once per position and restores canonical values before a drop", () => {
	const h = harness();
	try {
		pointer(h.el, "pointerdown");
		expect(h.controller.allow(h.proposal)).toBe(true);
		expect(h.controller.allow(h.proposal)).toBe(true);
		expect(h.build).toHaveBeenCalledTimes(1);
		expect(h.upsert).toHaveBeenNthCalledWith(1, [h.preview]);
		pointer(document, "pointerup");
		expect(h.upsert).toHaveBeenLastCalledWith([h.original]);
		expect(h.invalid).not.toHaveBeenCalled();
	} finally { h.controller.dispose(); }
});

it.each(["Escape", "pointercancel", "blur"])("cleans all preview items on %s", reason => {
	const h = harness();
	try {
		pointer(h.el, "pointerdown"); h.controller.allow(h.proposal);
		if (reason === "Escape") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		else if (reason === "blur") window.dispatchEvent(new Event("blur"));
		else pointer(document, "pointercancel");
		expect(h.upsert).toHaveBeenLastCalledWith([h.original]);
		expect(h.invalid).not.toHaveBeenCalled();
	} finally { h.controller.dispose(); }
});

it("restores the last valid preview and reports an invalid final drop only once", () => {
	const h = harness();
	try {
		pointer(h.el, "pointerdown"); h.controller.allow(h.proposal);
		h.build.mockImplementation(() => { throw new Error("Incompatible selection"); });
		const bad = { ...h.proposal, allDay: true };
		expect(h.controller.allow(bad)).toBe(false);
		expect(h.controller.allow(bad)).toBe(false);
		expect(h.upsert).toHaveBeenLastCalledWith([h.original]);
		pointer(document, "pointerup"); pointer(document, "pointerup");
		expect(h.invalid).toHaveBeenCalledTimes(1);
	} finally { h.controller.dispose(); }
});

it("uses the latest source values when a task is changed or deleted mid-drag", () => {
	const h = harness();
	try {
		pointer(h.el, "pointerdown"); h.controller.allow(h.proposal);
		const changed = item("peer", "2026-11-20T15:00"); h.setItems([changed]);
		h.controller.clear(); expect(h.upsert).toHaveBeenLastCalledWith([changed]);
		pointer(h.el, "pointerdown"); h.controller.allow(h.proposal);
		h.setItems([]); h.controller.clear(); expect(h.remove).toHaveBeenCalledWith(["peer"]);
	} finally { h.controller.dispose(); }
});

it("does not repaint stale peers after a full source refresh", () => {
	const h = harness();
	try {
		pointer(h.el, "pointerdown"); h.controller.allow(h.proposal);
		h.upsert.mockClear(); h.controller.clear(false); pointer(document, "pointerup");
		expect(h.upsert).not.toHaveBeenCalled();
	} finally { h.controller.dispose(); }
});

it("follows the owner document when the calendar is moved to a popout", () => {
	const h = harness();
	try {
		const popout = document.implementation.createHTMLDocument("Popout");
		popout.body.append(popout.adoptNode(h.root));
		pointer(h.el, "pointerdown"); h.controller.allow(h.proposal);
		pointer(popout, "pointerup");
		expect(h.upsert).toHaveBeenLastCalledWith([h.original]);
	} finally { h.controller.dispose(); }
});

it("does not preview keyboard moves or resizes, and unregisters listeners on disposal", () => {
	const h = harness();
	expect(h.controller.allow(h.proposal)).toBe(true);
	pointer(h.grip, "pointerdown"); expect(h.controller.allow(h.proposal)).toBe(true);
	expect(h.build).not.toHaveBeenCalled();
	h.controller.dispose(); pointer(h.el, "pointerdown"); h.controller.allow(h.proposal);
	expect(h.build).not.toHaveBeenCalled();
});
