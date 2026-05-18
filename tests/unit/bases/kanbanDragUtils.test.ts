import {
	applyKanbanTaskDropFrontmatterPlan,
	getKanbanDraggedPaths,
	kanbanDropPlanNeedsWrite,
	planKanbanTaskDropUpdate,
	resolveKanbanContainerDropTarget,
	type KanbanDropTarget,
} from "../../../src/bases/kanbanDragUtils";

describe("kanbanDragUtils", () => {
	describe("resolveKanbanContainerDropTarget", () => {
		const staleTarget: KanbanDropTarget = { taskPath: "Tasks/stale.md", above: true };
		const fallbackTarget: KanbanDropTarget = { taskPath: "Tasks/fallback.md", above: false };

		it("clears a stale cross-scope target", () => {
			expect(
				resolveKanbanContainerDropTarget({
					dropTarget: staleTarget,
					isCrossScope: true,
					targetInDropScope: false,
					fallbackDropTarget: fallbackTarget,
				})
			).toBeUndefined();
		});

		it("uses a fallback target for same-scope drops without a card target", () => {
			expect(
				resolveKanbanContainerDropTarget({
					dropTarget: undefined,
					isCrossScope: false,
					targetInDropScope: false,
					fallbackDropTarget: fallbackTarget,
				})
			).toEqual(fallbackTarget);
		});

		it("keeps a cross-scope target that belongs to the drop scope", () => {
			expect(
				resolveKanbanContainerDropTarget({
					dropTarget: staleTarget,
					isCrossScope: true,
					targetInDropScope: true,
				})
			).toEqual(staleTarget);
		});
	});

	it("returns a cloned batch path list when batch paths exist", () => {
		const batchPaths = ["Tasks/a.md", "Tasks/b.md"];
		const result = getKanbanDraggedPaths(batchPaths, "Tasks/fallback.md");

		expect(result).toEqual(batchPaths);
		expect(result).not.toBe(batchPaths);
	});

	it("plans no frontmatter write for same-column drops without sort order", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: null,
			newGroupValue: "open",
			newSwimLaneValue: null,
			groupByPropertyId: "task.status",
			swimLanePropertyId: null,
			groupByTaskProp: "status",
			swimlaneTaskProp: null,
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});

		expect(plan.needsGroupUpdate).toBe(false);
		expect(plan.needsSwimlaneUpdate).toBe(false);
		expect(kanbanDropPlanNeedsWrite(plan, false)).toBe(false);
		expect(kanbanDropPlanNeedsWrite(plan, true)).toBe(true);
	});

	it("updates scalar group and swimlane properties through a single plan", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: "low",
			newGroupValue: "done",
			newSwimLaneValue: "high",
			groupByPropertyId: "task.status",
			swimLanePropertyId: "task.priority",
			groupByTaskProp: "status",
			swimlaneTaskProp: "priority",
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});
		const frontmatter = { status: "open", priority: "low" };

		applyKanbanTaskDropFrontmatterPlan(frontmatter, plan, {
			coerceGroupValue: (_frontmatterKey, groupKey) => groupKey.toUpperCase(),
		});

		expect(frontmatter).toEqual({ status: "DONE", priority: "HIGH" });
		expect(plan.changedTaskProp).toBe("status");
		expect(plan.oldPropValue).toBe("open");
		expect(plan.newPropValue).toBe("done");
	});

	it("removes source and adds target for list-valued group properties", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "work",
			sourceSwimlane: null,
			newGroupValue: "home",
			newSwimLaneValue: null,
			groupByPropertyId: "task.projects",
			swimLanePropertyId: null,
			groupByTaskProp: "projects",
			swimlaneTaskProp: null,
			isGroupByListProperty: true,
			isSwimlaneListProperty: false,
		});
		const frontmatter = { projects: ["work", "archive"] };

		applyKanbanTaskDropFrontmatterPlan(frontmatter, plan, {
			coerceGroupValue: (_frontmatterKey, groupKey) => groupKey,
		});

		expect(frontmatter.projects).toEqual(["archive", "home"]);
	});

	it("removes source without adding None for list-valued swimlanes", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: "blocked",
			newGroupValue: "open",
			newSwimLaneValue: "None",
			groupByPropertyId: "task.status",
			swimLanePropertyId: "note.contexts",
			groupByTaskProp: "status",
			swimlaneTaskProp: "contexts",
			isGroupByListProperty: false,
			isSwimlaneListProperty: true,
		});
		const frontmatter = { status: "open", contexts: ["blocked"] };

		applyKanbanTaskDropFrontmatterPlan(frontmatter, plan, {
			coerceGroupValue: (_frontmatterKey, groupKey) => groupKey,
		});

		expect(frontmatter).toEqual({ status: "open", contexts: [] });
		expect(plan.needsGroupUpdate).toBe(false);
		expect(plan.needsSwimlaneUpdate).toBe(true);
		expect(plan.changedTaskProp).toBe("contexts");
	});
});
