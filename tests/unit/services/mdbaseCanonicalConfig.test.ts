import {
	buildTaskNotesMdbaseResources,
	TASKNOTES_TASK_CONTRACT_VERSION,
} from "@tasknotes/model/mdbase";
import { newTaskNotesSettingsFrontmatter } from "@tasknotes/model/settings";
import YAML from "yaml";

import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import {
	applyCanonicalTaskTypeToSettings,
	buildTaskNotesModelConfig,
	mergeCanonicalTaskTypeDocument,
	parseMdbaseTaskTypeDocument,
	portableSettingsFingerprint,
	validateCanonicalTaskType,
} from "../../../src/services/mdbaseCanonicalConfig";

describe("canonical mdbase TaskNotes configuration", () => {
	it("applies the portable task contract to effective TaskNotes settings", () => {
		const settings = clone(DEFAULT_SETTINGS);
		const resources = buildTaskNotesMdbaseResources({
			tasksFolder: "Work/Tasks",
			modelConfig: {
				fieldMapping: { status: "state", priority: "importance" },
				statuses: [
					{
						id: "queued",
						value: "queued",
						label: "Queued",
						color: "#777777",
						isCompleted: false,
						order: 0,
						autoArchive: false,
						autoArchiveDelay: 5,
					},
					{
						id: "shipped",
						value: "shipped",
						label: "Shipped",
						color: "#00aa00",
						isCompleted: true,
						order: 1,
						autoArchive: true,
						autoArchiveDelay: 10,
					},
				],
				priorities: [
					{
						id: "routine",
						value: "routine",
						label: "Routine",
						color: "#777777",
						weight: 1,
					},
				],
				defaults: {
					status: "queued",
					priority: "routine",
					taskTag: "action",
				},
				taskIdentification: {
					method: "tag",
					tag: "action",
					propertyName: "",
					propertyValue: "",
				},
				recurrence: {
					maintainDueDateOffset: true,
					resetCheckboxesOnRecurrence: true,
				},
				timeTracking: {
					autoStopOnComplete: false,
					autoStopNotification: false,
					defaultSessionDescription: "Work",
				},
			},
			title: { filenameFormat: "timestamp" },
			links: { writeFormat: "markdown" },
			archive: { moveOnArchive: true, folder: "Archive/Tasks" },
			templating: {
				enabled: true,
				templatePath: "Templates/Task.md",
				occurrenceEnabled: true,
				occurrenceTemplatePath: "Templates/Occurrence.md",
			},
		});

		// rc.6: app behaviour comes from the settings record, not the binding.
		applyCanonicalTaskTypeToSettings(settings, resources.type, {
			record: newTaskNotesSettingsFrontmatter(resources.appSettings),
		});

		expect(settings.tasksFolder).toBe("Work/Tasks");
		expect(settings.fieldMapping.status).toBe("state");
		expect(settings.fieldMapping.priority).toBe("importance");
		expect(settings.customStatuses.map((status) => status.value)).toEqual([
			"queued",
			"shipped",
		]);
		expect(settings.defaultTaskStatus).toBe("queued");
		expect(settings.defaultTaskPriority).toBe("routine");
		expect(settings.taskIdentificationMethod).toBe("tag");
		expect(settings.taskTag).toBe("action");
		expect(settings.taskFilenameFormat).toBe("timestamp");
		expect(settings.useFrontmatterMarkdownLinks).toBe(true);
		expect(settings.moveArchivedTasks).toBe(true);
		expect(settings.archiveFolder).toBe("Archive/Tasks");
		expect(settings.maintainDueDateOffsetInRecurring).toBe(true);
		expect(settings.resetCheckboxesOnRecurrence).toBe(true);
		expect(settings.autoStopTimeTrackingOnComplete).toBe(false);
		expect(settings.taskCreationDefaults).toEqual(
			expect.objectContaining({
				useBodyTemplate: true,
				bodyTemplate: "Templates/Task.md",
				useOccurrenceBodyTemplate: true,
				occurrenceBodyTemplate: "Templates/Occurrence.md",
			})
		);
	});

	it("reads a status only the schema allows, and writes one list back", () => {
		const settings = clone(DEFAULT_SETTINGS);
		const resources = buildTaskNotesMdbaseResources({ modelConfig: buildTaskNotesModelConfig(settings) });
		const type = clone(resources.type);
		const schema = type.schema as {
			value: { properties: Record<string, { enum?: string[] }> };
		};
		const before = [...(schema.value.properties.status.enum ?? [])];
		schema.value.properties.status.enum = [...before, "blocked"];

		expect(validateCanonicalTaskType(type)).toEqual({ valid: true });
		applyCanonicalTaskTypeToSettings(settings, type);
		expect(settings.customStatuses.map((status) => status.value)).toEqual([...before, "blocked"]);

		const written = parseMdbaseTaskTypeDocument(
			mergeCanonicalTaskTypeDocument(
				`---\n${initialDocumentYaml(type)}---\n`,
				buildTaskNotesMdbaseResources({ modelConfig: buildTaskNotesModelConfig(settings) })
			)
		).type;
		const status = implementation(written).binding as { status: { values: string[] } };
		expect(status.status.values).toEqual([...before, "blocked"]);
		expect((written.schema as typeof schema).value.properties.status.enum).toEqual([...before, "blocked"]);
	});

	it("keeps a status the schema lost while the binding still describes it", () => {
		const type = clone(buildTaskNotesMdbaseResources().type);
		const schema = type.schema as {
			value: { properties: Record<string, { enum?: string[] }> };
		};
		const before = [...(schema.value.properties.status.enum ?? [])];
		schema.value.properties.status.enum = ["open", "done"];
		const settings = clone(DEFAULT_SETTINGS);

		expect(validateCanonicalTaskType(type)).toEqual({ valid: true });
		applyCanonicalTaskTypeToSettings(settings, type);
		expect(settings.customStatuses.map((status) => status.value)).toEqual(before);
	});

	it("rejects mirrors that cannot be made to agree", () => {
		const type = clone(buildTaskNotesMdbaseResources().type);
		const schema = type.schema as {
			value: { properties: Record<string, { enum?: string[] }> };
		};
		schema.value.properties.status.enum = ["open", "done"];
		// With every status completed there is no list a collection could hold.
		const binding = implementation(type).binding as {
			status: { values: string[]; completed_values: string[]; definitions: Array<{ is_completed: boolean }> };
		};
		binding.status.completed_values = [...binding.status.values];
		binding.status.definitions.forEach((definition) => (definition.is_completed = true));

		expect(validateCanonicalTaskType(type)).toEqual({
			valid: false,
			issues: expect.arrayContaining(["status.values contradicts schema enum for status"]),
		});
	});

	it("rejects contracts that omit required canonical metadata", () => {
		const resources = buildTaskNotesMdbaseResources();
		const type = clone(resources.type);
		const taskImplementation = implementation(type);
		delete (taskImplementation.binding as Record<string, unknown>).status;

		expect(validateCanonicalTaskType(type)).toEqual({
			valid: false,
			issues: expect.arrayContaining([
				"the TaskNotes implementation binding.status must be an object",
			]),
		});
	});

	it("replaces the managed task-identification rule instead of retaining stale predicates", () => {
		const initial = buildTaskNotesMdbaseResources({
			modelConfig: {
				taskIdentification: {
					method: "tag",
					tag: "action",
					propertyName: "",
					propertyValue: "",
				},
			},
		});
		const desired = buildTaskNotesMdbaseResources({
			modelConfig: {
				taskIdentification: {
					method: "property",
					tag: "action",
					propertyName: "kind",
					propertyValue: "task",
				},
			},
		});

		const merged = mergeCanonicalTaskTypeDocument(initial.typeDocument, desired);
		const parsed = parseMdbaseTaskTypeDocument(merged);

		expect(parsed.type.match).toEqual({
			where: {
				kind: { eq: "task" },
			},
		});
		expect(validateCanonicalTaskType(parsed.type)).toEqual({ valid: true });
	});

	it("updates managed fields while preserving unknown extensions and user body text", () => {
		const initial = buildTaskNotesMdbaseResources({
			modelConfig: {
				userFields: [
					{
						id: "effort",
						displayName: "Effort",
						key: "effort",
						type: "number",
					},
				],
			},
		});
		const initialType = clone(initial.type);
		initialType["x-another-tool"] = { enabled: true };
		(initialType.implements as unknown[]).push({
			contract: "example.audit",
			version: "1.0.0",
			fields: { created: "dateCreated" },
		});
		const initialDocument = initial.typeDocument
			.replace(
				initial.typeDocument.match(/^---\n[\s\S]*?\n---\n/)?.[0] ?? "",
				`---\n${initialDocumentYaml(initialType)}---\n`
			)
			.replace("name: task\n", "name: task # keep this comment\n");
		const customized = `${initialDocument.trimEnd()}\n\nUser-maintained notes.\n`;
		const desired = buildTaskNotesMdbaseResources({
			modelConfig: {
				statuses: [
					{
						id: "todo",
						value: "todo",
						label: "To do",
						color: "#777777",
						isCompleted: false,
						order: 0,
						autoArchive: false,
						autoArchiveDelay: 5,
					},
					{
						id: "done",
						value: "done",
						label: "Done",
						color: "#00aa00",
						isCompleted: true,
						order: 1,
						autoArchive: false,
						autoArchiveDelay: 5,
					},
				],
				defaults: { status: "todo" },
				userFields: [],
			},
		});

		const merged = mergeCanonicalTaskTypeDocument(customized, desired);
		const parsed = parseMdbaseTaskTypeDocument(merged);
		const schema = parsed.type.schema as {
			value: { properties: Record<string, unknown> };
		};

		expect(parsed.type["x-another-tool"]).toEqual({ enabled: true });
		expect(parsed.type.implements).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					contract: "example.audit",
					version: "1.0.0",
				}),
			])
		);
		expect(schema.value.properties).not.toHaveProperty("effort");
		expect(merged).toContain("name: task # keep this comment");
		expect(merged).toContain("User-maintained notes.");
	});
	it("round-trips the saved filename format and user field identity on import", () => {
		const settings = clone(DEFAULT_SETTINGS);
		settings.storeTitleInFilename = true;
		settings.taskFilenameFormat = "zettel";
		// v4 saved keys with surrounding whitespace; the type stores them trimmed.
		settings.userFields = [{ id: "effort-id", displayName: "Effort level", key: " effort ", type: "number" }];
		const modelConfig = buildTaskNotesModelConfig(settings);
		modelConfig.userFields = modelConfig.userFields.map((field) => ({ ...field, key: field.key.trim() }));
		const resources = buildTaskNotesMdbaseResources({
			tasksFolder: settings.tasksFolder,
			modelConfig,
			title: { filenameFormat: "title" },
		});

		applyCanonicalTaskTypeToSettings(settings, resources.type);

		expect(settings.taskFilenameFormat).toBe("zettel");
		expect(settings.userFields).toEqual([
			expect.objectContaining({ id: "effort-id", displayName: "Effort level", key: "effort" }),
		]);
	});

	it("shares a custom field's name through the type", () => {
		const settings = clone(DEFAULT_SETTINGS);
		settings.userFields = [{ id: "effort-id", displayName: "Effort", key: "effort", type: "number" }];
		const generate = () => buildTaskNotesMdbaseResources({ modelConfig: buildTaskNotesModelConfig(settings) });
		const first = generate();
		expect(titleOf(first.type, "effort")).toBe("Effort");

		// Renamed here: the type follows, and the fingerprint notices.
		const fingerprint = portableSettingsFingerprint(settings);
		settings.userFields[0].displayName = "Effort level";
		expect(portableSettingsFingerprint(settings)).not.toBe(fingerprint);
		const renamed = parseMdbaseTaskTypeDocument(
			mergeCanonicalTaskTypeDocument(first.typeDocument, generate())
		).type;
		expect(titleOf(renamed, "effort")).toBe("Effort level");

		// Renamed by another client: this device follows the type.
		const elsewhere = clone(renamed);
		(elsewhere.schema as { value: { properties: Record<string, { title?: string }> } }).value.properties.effort.title = "Size";
		applyCanonicalTaskTypeToSettings(settings, elsewhere);
		expect(settings.userFields).toEqual([
			expect.objectContaining({ id: "effort-id", displayName: "Size", key: "effort" }),
		]);

		// A type written before names were stored keeps this device's name.
		delete (elsewhere.schema as { value: { properties: Record<string, { title?: string }> } }).value.properties.effort.title;
		applyCanonicalTaskTypeToSettings(settings, elsewhere);
		expect(settings.userFields[0].displayName).toBe("Size");
	});

});

function initialDocumentYaml(value: Record<string, unknown>): string {
	return `${YAML.stringify(value, { lineWidth: 0 }).trimEnd()}\n`;
}

function titleOf(type: Record<string, unknown>, field: string): unknown {
	return (type.schema as { value: { properties: Record<string, { title?: string }> } }).value.properties[field]?.title;
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function implementation(type: Record<string, unknown>): Record<string, unknown> {
	const implementations = type.implements as Record<string, unknown>[];
	const implementation = implementations.find(
		(candidate) =>
			candidate.contract === "tasknotes.task" &&
			candidate.version === TASKNOTES_TASK_CONTRACT_VERSION
	);
	if (!implementation) throw new Error("Missing TaskNotes implementation");
	return implementation;
}
