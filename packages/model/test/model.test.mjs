import assert from "node:assert/strict";
import test from "node:test";
import {
	DEFAULT_FIELD_MAPPING,
	buildRecurringTaskCompletePlan,
	buildSpecCompleteTaskUpdate,
	buildSpecRecurringSkipUpdate,
	buildSpecStartTimeTrackingUpdate,
	buildSpecStopTimeTrackingUpdate,
	buildStartTimeTrackingPlan,
	calculateTotalTrackedMinutes,
	executeConformanceOperation,
	formatDateForStorage,
	getDatePart,
	mapTaskFromFrontmatter,
	mapTaskToFrontmatter,
	parseDateToUTC,
	parseTaskDocument,
	recalculateRecurringSchedule,
	serializeTaskDocument,
} from "../dist/esm/index.js";

test("maps TaskNotes frontmatter to normalized task data", () => {
	const task = mapTaskFromFrontmatter(
		DEFAULT_FIELD_MAPPING,
		{
			title: "Ship model",
			status: "Done",
			priority: "high",
			due: "2026-06-01",
			tags: ["task", "archived"],
			complete_instances: ["2026-05-30", "not-a-date"],
		},
		"Tasks/Ship model.md",
		false,
		[],
		[
			{
				id: "done",
				value: "done",
				label: "Done",
				color: "#00aa00",
				isCompleted: true,
				order: 0,
				autoArchive: false,
				autoArchiveDelay: 5,
			},
		]
	);

	assert.equal(task.title, "Ship model");
	assert.equal(task.status, "done");
	assert.equal(task.archived, true);
	assert.deepEqual(task.complete_instances, ["2026-05-30"]);
});

test("denormalizes task data to configured frontmatter", () => {
	const frontmatter = mapTaskToFrontmatter(DEFAULT_FIELD_MAPPING, {
		title: "Ship model",
		status: "done",
		priority: "high",
		path: "Tasks/Ship model.md",
		archived: false,
		tags: ["task"],
	});

	assert.equal(frontmatter.title, "Ship model");
	assert.equal(frontmatter.status, "done");
	assert.deepEqual(frontmatter.tags, ["task"]);
});

test("parses dates with UTC storage semantics", () => {
	assert.equal(formatDateForStorage(parseDateToUTC("2026-02-28")), "2026-02-28");
	assert.equal(getDatePart("2026-02-28T10:30:00"), "2026-02-28");
	assert.throws(() => parseDateToUTC("2026-02-30"), /Invalid date/);
});

test("recalculates recurring schedules with DTSTART", () => {
	const result = recalculateRecurringSchedule({
		recurrence: "FREQ=DAILY;COUNT=3",
		scheduled: "2026-06-01",
		referenceDate: "2026-06-01",
		completeInstances: ["2026-06-01"],
	});

	assert.equal(result.updatedRecurrence, "DTSTART:20260601;FREQ=DAILY;COUNT=3");
	assert.equal(result.nextScheduled, "2026-06-02");
});

test("builds recurring complete plans without host IO", () => {
	const plan = buildRecurringTaskCompletePlan({
		freshTask: {
			title: "Daily task",
			status: "open",
			priority: "normal",
			path: "Tasks/Daily task.md",
			archived: false,
			recurrence: "FREQ=DAILY",
			scheduled: "2026-06-01",
		},
		targetDate: parseDateToUTC("2026-06-01"),
		currentTimestamp: "2026-06-01T12:00:00Z",
		maintainDueDateOffsetInRecurring: true,
	});

	assert.equal(plan.newComplete, true);
	assert.deepEqual(plan.updatedTask.complete_instances, ["2026-06-01"]);
	assert.equal(plan.updatedTask.dateModified, "2026-06-01T12:00:00Z");
});

test("plans time tracking and total reporting", () => {
	const start = buildStartTimeTrackingPlan(
		{
			title: "Timed task",
			status: "open",
			priority: "normal",
			path: "Tasks/Timed task.md",
			archived: false,
		},
		"2026-06-01T09:00:00Z"
	);
	const entries = [
		{ ...start.newEntry, endTime: "2026-06-01T09:30:00Z" },
		{ startTime: "2026-06-01T10:00:00Z", endTime: "2026-06-01T10:45:00Z" },
	];

	assert.equal(calculateTotalTrackedMinutes(entries), 75);
});

test("builds spec-normalized updates for adapter surfaces", () => {
	const complete = buildSpecCompleteTaskUpdate({
		frontmatter: {
			title: "Daily task",
			status: "open",
			priority: "normal",
			recurrence: "FREQ=DAILY",
			scheduled: "2026-06-01",
			completeInstances: [],
			skippedInstances: ["2026-06-01"],
		},
		targetDate: "2026-06-01",
		completedStatus: "done",
		currentTimestamp: "2026-06-01T12:00:00Z",
		path: "Tasks/Daily task.md",
	});

	assert.equal(complete.fields.recurrence, "DTSTART:20260601;FREQ=DAILY");
	assert.equal(complete.fields.scheduled, "2026-06-02");
	assert.deepEqual(complete.fields.completeInstances, ["2026-06-01"]);
	assert.deepEqual(complete.fields.skippedInstances, []);

	const skip = buildSpecRecurringSkipUpdate({
		frontmatter: complete.fields,
		targetDate: "2026-06-02",
		skip: true,
	});

	assert.deepEqual(skip.fields.skippedInstances, ["2026-06-02"]);
	assert.equal(skip.fields.scheduled, "2026-06-03");

	const start = buildSpecStartTimeTrackingUpdate({
		frontmatter: { title: "Timed task", status: "open", priority: "normal" },
		currentTimestamp: "2026-06-01T09:00:00Z",
	});
	assert.deepEqual(start.fields.timeEntries, [{ startTime: "2026-06-01T09:00:00Z" }]);

	const stop = buildSpecStopTimeTrackingUpdate({
		frontmatter: start.fields,
		currentTimestamp: "2026-06-01T09:30:00Z",
	});
	assert.deepEqual(stop.fields.timeEntries, [
		{
			startTime: "2026-06-01T09:00:00Z",
			endTime: "2026-06-01T09:30:00Z",
		},
	]);
});

test("round-trips markdown task documents", () => {
	const document = parseTaskDocument("---\ntitle: Test\nstatus: open\n---\nBody\n", {
		path: "Tasks/Test.md",
	});

	assert.equal(document.task.title, "Test");
	assert.equal(document.body, "Body\n");
	assert.match(serializeTaskDocument(document.task, document.body), /title: Test/);
});

test("exposes conformance envelopes", () => {
	const result = executeConformanceOperation("date.validate", { value: "2026-06-01" });
	assert.equal(result.ok, true);
	assert.deepEqual(result.result, { value: "2026-06-01" });
});
