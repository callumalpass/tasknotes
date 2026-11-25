import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { compileRecordSchema } from "../../src/services/mdbase/contractValidation";
import { requireFrontmatter } from "../../src/services/mdbase/frontmatter";
import { closeObsidian, launchObsidian } from "../obsidian";

test("TaskNotes-written local times validate against its generated task type", async () => {
	const app = await launchObsidian();
	try {
		const scheduled = "2026-11-30T16:00";
		const due = "2026-11-30T17:30";
		const { content, vaultPath } = await app.page.evaluate(async ({ scheduled, due }) => {
			const { vault, plugins } = (window as any).app;
			const { file } = await plugins.plugins.tasknotes.taskService.createTask({
				title: "Timed task", scheduled, due,
			});
			return { content: await vault.read(file), vaultPath: vault.adapter.basePath as string };
		}, { scheduled, due });

		const record = YAML.parse(requireFrontmatter(content).frontmatter);
		expect(record).toMatchObject({ scheduled: "2026-11-30T16:00", due: "2026-11-30T17:30" });

		const typePath = join(vaultPath, "_mdbase/types/task.md");
		await expect.poll(() => {
			const type = YAML.parse(requireFrontmatter(readFileSync(typePath, "utf8")).frontmatter);
			const validate = compileRecordSchema(type.schema.value);
			return validate(record) ? [] : validate.errors;
		}).toEqual([]);
	} finally {
		await closeObsidian(app);
	}
});
