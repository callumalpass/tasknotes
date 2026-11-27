import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { canonicalTaskNotesResources, TASKNOTES_TASK_CONTRACT_VERSION } from "../canonicalTaskNotesPack";

type Schema = Record<string, unknown>;
const schema = (name: string): Schema => {
	const path = `schemas/${name}/${TASKNOTES_TASK_CONTRACT_VERSION}.schema.json`;
	const resource = canonicalTaskNotesResources.find((entry) => entry.source === path);
	if (!resource) throw new Error(`Missing canonical schema: ${path}`);
	return JSON.parse(resource.document) as Schema;
};
function isLocalDateTime(value: string): boolean {
	const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]+)?)?$/.exec(value);
	if (!match || match[0] !== value) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(0);
	date.setUTCFullYear(year, month - 1, day);
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function createCompiler(): Ajv2020 {
	const compiler = new Ajv2020({ allErrors: true, strict: false });
	addFormats(compiler);
	compiler.addFormat("local-date-time", isLocalDateTime);
	return compiler;
}

export const taskRecordSchema = schema("tasknotes.task");
const ajv = createCompiler();
export const validateTaskRecord = ajv.compile(taskRecordSchema);
export const validateTaskBinding = ajv.compile(schema("tasknotes.task.binding"));

export function validationIssues(validator: ValidateFunction): string[] {
	return (validator.errors ?? []).map((error) =>
		`${error.instancePath || "/"} ${error.message ?? "invalid"} ${JSON.stringify(error.params)}`
	);
}

/** Same declaration checks the engine performs before accepting an implementation. */
export function validateContractMapping(
	fields: Record<string, unknown>, properties: Record<string, unknown>
): string[] {
	const issues: string[] = [];
	for (const role of taskRecordSchema.required as string[]) {
		if (typeof fields[role] !== "string" || !fields[role]) {
			issues.push(`required contract field ${role} must be mapped`);
		}
	}
	const roles = taskRecordSchema.properties as Record<string, unknown>;
	for (const [role, field] of Object.entries(fields)) {
		if (!(role in roles)) issues.push(`contract field ${role} is not declared`);
		if (typeof field === "string" && !(field in properties)) {
			issues.push(`field role ${role} refers to missing schema property ${field}`);
		}
	}
	return issues;
}

export function compileRecordSchema(value: unknown): ValidateFunction {
	// Isolated compiler avoids collisions between user schema $ids and canonical $ids.
	return createCompiler().compile(value as Schema);
}
