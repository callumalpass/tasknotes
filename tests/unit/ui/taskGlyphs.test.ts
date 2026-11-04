import { DEFAULT_STATUSES } from "../../../src/settings/defaults";
import { priorityGlyphState, renderPriorityGlyph, renderStatusGlyph, statusGlyphState } from "../../../src/ui/kit/glyphs";
import { taskDateLabel } from "../../../src/ui/kit/dateLabel";

describe("shared task identity", () => {
	it("starts the seeded active workflow with an empty ring without reserving editable values", () => {
		expect(statusGlyphState("open", DEFAULT_STATUSES)).toEqual({ kind: "open", progress: 0 });
		expect(statusGlyphState("none", DEFAULT_STATUSES).kind).toBe("unset");
		const custom = [
			{ id: "first", value: "none", order: 8, isCompleted: false },
			{ id: "second", value: "review", order: 2, isCompleted: false },
		];
		expect(statusGlyphState("review", custom).kind).toBe("open");
		expect(statusGlyphState("none", custom).kind).toBe("progress");
		expect(custom.map(status => status.order)).toEqual([8, 2]);
	});

	it("keeps unknown values distinct from empty and configured zero-weight priority", () => {
		expect(statusGlyphState("retired", DEFAULT_STATUSES).kind).toBe("unknown");
		expect(statusGlyphState("", []).kind).toBe("unset");
		expect(priorityGlyphState("retired", []).kind).toBe("unknown");
		expect(priorityGlyphState(undefined, []).kind).toBe("unset");
		expect(priorityGlyphState("quiet", [{ value: "quiet", weight: 0 }]).kind).toBe("unset");
		const host = document.createElement("span");
		renderPriorityGlyph(host, { kind: "unknown" });
		expect(host.dataset.tnGlyph).toBe("unknown");
		renderStatusGlyph(host, { kind: "unknown", progress: 0 });
		expect(host.dataset.tnGlyph).toBe("unknown");
	});

	it("uses one relative day, fallback and time format", () => {
		const today = new Date(2026, 10, 5, 12);
		expect(taskDateLabel("2026-11-05", "24", today)).toBe("Today");
		expect(taskDateLabel("2026-11-06T15:30:00", "24", today)).toBe("Tomorrow 15:30");
		expect(taskDateLabel("2026-11-04", "24", today)).toBe("Yesterday");
		expect(taskDateLabel("2026-12-04", "24", today)).toBe("Dec 4");
		expect(taskDateLabel("2027-12-04", "24", today)).toBe("Dec 4, 2027");
	});
});
