import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { appSettingsSupportResources } from "../../../src/services/mdbase/appSettingsResources";

const pack = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../vendor/mdbase-contracts/tasknotes.task-0.3.0-rc.21.json"), "utf8"));

describe("canonical settings resources", () => {
	it.each([
		["_mdbase/types", "_mdbase/contracts", "_mdbase/schemas"],
		["_types", "_contracts", "schemas"],
		["Metadata/types", "Metadata/contracts", "Metadata/schemas"],
	])("matches the installer targets and bytes under %s", (types, contracts, schemas) => {
		const resources = appSettingsSupportResources(contracts, types);
		expect(resources).toHaveLength(7);
		for (const resource of resources) {
			const entry = pack.manifest.resources.find((entry: { target: string }) =>
				entry.target.replace(/^_types\//, `${types}/`).replace(/^_contracts\//, `${contracts}/`).replace(/^schemas\//, `${schemas}/`) === resource.path);
			expect(entry).toBeDefined();
			expect(resource.seed).toBe(entry.mode === "seed");
			expect(resource.content).toBe(pack.resources.find((candidate: { source: string }) => candidate.source === entry.source).document);
		}
		for (const id of ["mdbase.app-settings", "tasknotes.settings"]) {
			expect(resources.some((resource) => resource.path === `${contracts}/${id}/1.0.0.md`)).toBe(true);
			expect(resources.some((resource) => resource.path === `${schemas}/${id}/1.0.0.schema.json`)).toBe(true);
		}
		const seed = resources.find((resource) => resource.seed)!;
		const type = YAML.parse(seed.content.match(/^---\n([\s\S]*?)\n---/)![1]);
		expect(type.version).toBe(2);
		expect(type.implements).toEqual(expect.arrayContaining([
			expect.objectContaining({ contract: "mdbase.app-settings", version: "2.0.0" }),
			expect.objectContaining({ contract: "tasknotes.settings", version: "1.1.0" }),
		]));
	});
});
