import { serialize, deserialize } from "node:v8";
import { buildTaskMovementUndo, applyTaskMovementUndo } from "../../../src/bases/taskMovementUndo";

describe("guarded task movement undo", () => {
	// jsdom does not yet expose the browser's structuredClone API.
	beforeAll(() => {
		globalThis.structuredClone = (value) => deserialize(serialize(value));
	});
	it("restores scalar, list and completion fields without replacing unrelated changes", () => {
		const before = { status: "open", projects: ["One", "Two"], title: "Original" };
		const after = {
			status: "done",
			projects: ["Three"],
			title: "Original",
			completedDate: "2026-10-10",
			modified: "now",
		};
		const changes = buildTaskMovementUndo(before, after, "modified");
		const current: Record<string, unknown> = {
			...after,
			title: "Edited later",
			modified: "later",
		};
		expect(applyTaskMovementUndo(current, changes)).toBe(true);
		expect(current).toEqual({
			status: "open",
			projects: ["One", "Two"],
			title: "Edited later",
			modified: "later",
		});
	});

	it("blocks the entire undo if any moved field was subsequently edited", () => {
		const changes = buildTaskMovementUndo(
			{ status: "open", priority: "high" },
			{ status: "done", priority: "low" },
			"modified"
		);
		const current = { status: "done", priority: "normal" };
		expect(applyTaskMovementUndo(current, changes)).toBe(false);
		expect(current).toEqual({ status: "done", priority: "normal" });
	});

	it("restores cleared properties and preserves typed false and zero values", () => {
		const changes = buildTaskMovementUndo(
			{ owner: "Me", points: 0, flag: false },
			{ points: 1, flag: true },
			"modified"
		);
		const current: Record<string, unknown> = { points: 1, flag: true };
		expect(applyTaskMovementUndo(current, changes)).toBe(true);
		expect(current).toEqual({ owner: "Me", points: 0, flag: false });
	});

	it("does not retain mutable references to list values", () => {
		const before = { projects: ["One"] };
		const after = { projects: ["Two"] };
		const changes = buildTaskMovementUndo(before, after, "modified");
		before.projects.push("Mutated");
		after.projects.push("Mutated");
		const current = { projects: ["Two"] };
		expect(applyTaskMovementUndo(current, changes)).toBe(true);
		expect(current.projects).toEqual(["One"]);
	});

	it("distinguishes missing properties from present undefined properties", () => {
		const changes = buildTaskMovementUndo({}, { owner: undefined }, "modified");
		expect(applyTaskMovementUndo({}, changes)).toBe(false);
		const current = { owner: undefined };
		expect(applyTaskMovementUndo(current, changes)).toBe(true);
		expect(Object.prototype.hasOwnProperty.call(current, "owner")).toBe(false);
	});
});
