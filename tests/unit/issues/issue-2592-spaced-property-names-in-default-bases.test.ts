import { parse } from "yaml";
import { generateBasesFileTemplate } from "../../../src/templates/defaultBasesFiles";

// #2592: mapped property names that are not plain identifiers must be read as
// note["…"] in generated expressions, and stay plain in property-id entries.
const spaced = {
	status: "task status",
	priority: "task priority",
	due: "due date",
	scheduled: "scheduled date",
	projects: "my projects",
	contexts: "my contexts",
	recurrence: "repeat rule",
	recurrenceParent: "recurrence parent",
	occurrenceDate: "occurrence date",
	completeInstances: "complete instances",
	blockedBy: "blocked by",
	sortOrder: "manual order",
	timeEstimate: "time-estimate",
	timeEntries: "time entries",
	pomodoros: "pomodoros",
	archiveTag: "archived",
};

const createPlugin = (fieldMapping: Record<string, string>) => ({
	settings: {
		taskTag: "task",
		taskIdentificationMethod: "tag",
		customPriorities: [{ value: "high", label: "High", weight: 0 }],
		customStatuses: [
			{ value: "open", label: "Open", isCompleted: false },
			{ value: "done", label: "Done", isCompleted: true },
		],
		defaultVisibleProperties: ["status", "due", "scheduled", "user:effort", "tags"],
		calendarViewSettings: { firstDay: 1 },
		userFields: [{ id: "effort", key: "effort level" }],
		fieldMapping,
	},
	fieldMapper: {
		toUserField: (key: string) => fieldMapping[key] ?? key,
		getMapping: () => fieldMapping,
	},
});

const commands = [
	"open-tasks-view",
	"open-kanban-view",
	"open-advanced-calendar-view",
	"open-agenda-view",
	"open-calendar-view",
	"relationships",
];

function expressions(base: any): string[] {
	const out: string[] = [];
	const walk = (node: unknown) => {
		if (typeof node === "string") out.push(node);
		else if (Array.isArray(node)) node.forEach(walk);
		else if (node && typeof node === "object") Object.values(node).forEach(walk);
	};
	walk(base.filters);
	walk(base.formulas);
	for (const view of base.views ?? []) walk(view.filters);
	return out;
}

function propertyIds(base: any): string[] {
	const ids: string[] = [];
	for (const view of base.views ?? []) {
		ids.push(...(view.order ?? []));
		for (const sort of view.sort ?? []) ids.push(sort.column ?? sort.property);
		if (view.groupBy) ids.push(view.groupBy.property);
		if (view.dateProperty) ids.push(view.dateProperty);
	}
	return ids;
}

describe("Issue #2592: spaced property names in generated default Bases", () => {
	const plugin = createPlugin(spaced);
	const bases = Object.fromEntries(
		commands.map((command) => [
			command,
			parse(generateBasesFileTemplate(command, plugin as any)),
		])
	);

	it.each(commands)("%s never uses a spaced name as a bare identifier", (command) => {
		const exprs = expressions(bases[command]).join("\n");
		for (const name of Object.values(spaced)) {
			if (/^[A-Za-z_]\w*$/.test(name)) continue;
			// Outside string literals (labels such as "No due date"), every occurrence
			// must sit inside a quoted note["…"] / ["…"] accessor.
			const bare = exprs
				.split(`["${name}"]`)
				.join("")
				.replace(/"(?:[^"\\]|\\.)*"/g, '""')
				.includes(name);
			expect({ name, bare }).toEqual({ name, bare: false });
		}
		expect(exprs).not.toContain("note.");
	});

	it("quotes every mapped field read by the formulas", () => {
		const formulas = Object.values(bases["open-tasks-view"].formulas).join("\n");
		for (const name of [
			"task status",
			"task priority",
			"due date",
			"scheduled date",
			"my projects",
			"my contexts",
			"repeat rule",
			"time-estimate",
			"time entries",
		]) {
			expect(formulas).toContain(`note["${name}"]`);
		}
		expect(formulas).toContain("formula.daysUntilDue");
		expect(formulas).toContain("file.ctime");
	});

	it("quotes mapped fields in the task view filters", () => {
		const views = bases["open-tasks-view"].views;
		const filters = (name: string) =>
			expressions({ views: [views.find((v: any) => v.name === name)] }).join("\n");
		expect(filters("Inbox")).toContain('note["my projects"].isEmpty()');
		expect(filters("Overdue")).toContain('date(note["due date"]) < today()');
		expect(filters("Today")).toContain(
			'note["complete instances"].map(date(value).format("YYYY-MM-DD"))'
		);
		expect(filters("Not Blocked")).toContain('.properties["task status"] != "done"');
		expect(filters("Not Blocked")).toContain('list(note["blocked by"])');
	});

	it("quotes mapped fields in relationship filters, including `this`", () => {
		const text = expressions(bases.relationships).join("\n");
		expect(text).toContain('list(note["my projects"])');
		expect(text).toContain('list(this["my projects"])');
		expect(text).toContain('list(this.note["blocked by"])');
		expect(text).toContain('note["recurrence parent"] && file(note["recurrence parent"]');
	});

	it.each(commands)("%s keeps order, sort, groupBy and dateProperty ids plain", (command) => {
		const ids = propertyIds(bases[command]);
		expect(ids.every((id) => !id.includes("note[") && !id.includes('"'))).toBe(true);
	});

	it("uses the mapped names, including user fields, as property ids", () => {
		const tasks = bases["open-tasks-view"].views;
		expect(tasks[0].order).toEqual(
			expect.arrayContaining(["task status", "due date", "effort level", "file.tags"])
		);
		const allTasks = tasks.find((v: any) => v.name === "All Tasks");
		expect(allTasks.sort).toEqual([{ column: "due date", direction: "ASC" }]);
		const manual = tasks.find((v: any) => v.name === "Manual Order");
		expect(manual.sort[0].column).toBe("manual order");
		expect(manual.groupBy.property).toBe("task status");
		expect(bases["open-calendar-view"].views[0].dateProperty).toBe("due date");
		const occurrences = bases.relationships.views.find((v: any) => v.name === "Occurrences");
		expect(occurrences.sort[0].column).toBe("occurrence date");
	});

	it("quotes reserved words and YAML-unsafe names", () => {
		const reserved = createPlugin({ ...spaced, due: "file", status: "a: b" });
		const tasks = parse(generateBasesFileTemplate("open-tasks-view", reserved as any));
		expect(tasks.formulas.daysUntilDue).toContain('date(note["file"])');
		expect(tasks.formulas.isOverdue).toContain('note["a: b"] != "done"');
		const manual = tasks.views.find((v: any) => v.name === "Manual Order");
		expect(manual.groupBy.property).toBe("a: b");
	});

	it("leaves identifier names unquoted", () => {
		const plain = createPlugin({ ...spaced, due: "due", status: "status" });
		const tasks = parse(generateBasesFileTemplate("open-tasks-view", plain as any));
		expect(tasks.formulas.daysUntilDue).toContain("date(due)");
		expect(tasks.formulas.isOverdue).toContain('status != "done"');
	});
});
