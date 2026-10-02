import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { canonicalTaskNotesResources } from "../canonicalTaskNotesPack";

type Schema = Record<string, unknown>;
const schema = (prefix: string): Schema => {
	const resource = canonicalTaskNotesResources.find((entry) => entry.source.startsWith(prefix));
	if (!resource) throw new Error(`Missing canonical schema: ${prefix}`);
	return JSON.parse(resource.document) as Schema;
};
export const taskRecordSchema = schema("schemas/tasknotes.task/");
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
export const validateTaskRecord = ajv.compile(taskRecordSchema);
export const validateTaskBinding = ajv.compile(schema("schemas/tasknotes.task.binding/"));

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
	const compiler = new Ajv2020({ allErrors: true, strict: false });
	addFormats(compiler);
	return compiler.compile(value as Schema);
}
