import {
	hasRelationshipFieldValue,
	shouldRenderRelationshipsWidget,
	type RelationshipsWidgetState,
} from "../../../src/editor/RelationshipsDecorations";
import { getRelationshipsDisplayMode } from "../../../src/settings/relationshipSettings";

const emptyTaskState: RelationshipsWidgetState = {
	isTaskNote: true,
	isProjectNote: false,
	hasSubtasks: false,
	hasProjectLinks: false,
	hasBlockingDependencies: false,
	hasBlockedTasks: false,
};

describe("Issue #1216: relationships widget display mode", () => {
	it("keeps legacy disabled settings mapped to Never", () => {
		expect(
			getRelationshipsDisplayMode({
				showRelationships: false,
				relationshipsDisplayMode: "always",
			})
		).toBe("never");
	});

	it("shows empty task widgets in Always mode for backwards compatibility", () => {
		expect(shouldRenderRelationshipsWidget("always", emptyTaskState)).toBe(true);
	});

	it("hides empty task widgets in When populated mode", () => {
		expect(shouldRenderRelationshipsWidget("whenPopulated", emptyTaskState)).toBe(false);
	});

	it("shows populated widgets when any relationship bucket has content", () => {
		const populatedStates: RelationshipsWidgetState[] = [
			{ ...emptyTaskState, hasSubtasks: true },
			{ ...emptyTaskState, hasProjectLinks: true },
			{ ...emptyTaskState, hasBlockingDependencies: true },
			{ ...emptyTaskState, hasBlockedTasks: true },
		];

		for (const state of populatedStates) {
			expect(shouldRenderRelationshipsWidget("whenPopulated", state)).toBe(true);
		}
	});

	it("does not render on unrelated notes even in Always mode", () => {
		expect(
			shouldRenderRelationshipsWidget("always", {
				...emptyTaskState,
				isTaskNote: false,
				isProjectNote: false,
			})
		).toBe(false);
	});

	it("treats non-empty relationship arrays and dependency objects as populated", () => {
		expect(hasRelationshipFieldValue(["[[Projects/Home]]"])).toBe(true);
		expect(hasRelationshipFieldValue([{ uid: "[[Tasks/Blocking task]]" }])).toBe(true);
		expect(hasRelationshipFieldValue(["", null, undefined])).toBe(false);
	});
});
