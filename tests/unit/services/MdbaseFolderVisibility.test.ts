import { mdbaseFolderCss, mdbaseHiddenFolders } from "../../../src/services/MdbaseFolderVisibility";

const folders =
	(...paths: string[]) =>
	(path: string) =>
		paths.includes(path);

describe("mdbase file explorer folders", () => {
	it("hides the new metadata root and the legacy settings folder without redundant children", () => {
		expect(
			mdbaseHiddenFolders(
				{ types_folder: "_mdbase/types", contracts_folder: "_mdbase/contracts" },
				folders(
					"_mdbase",
					"_mdbase/types",
					"_mdbase/contracts",
					"_mdbase/schemas",
					"_mdbase/schemas/tasknotes.settings",
					"_settings"
				)
			)
		).toEqual(["_mdbase", "_settings"]);
	});

	it("uses spec defaults for an existing minimal config, leaving user schemas visible", () => {
		expect(
			mdbaseHiddenFolders(
				{},
				folders(
					"_types",
					"_contracts",
					"_settings",
					"schemas",
					"schemas/personal",
					"_schemas"
				)
			)
		).toEqual(["_types", "_contracts", "_settings"]);
	});

	it.each(["mdbase.app-settings", "tasknotes.settings"])(
		"recognizes the %s schema folder",
		(id) => {
			expect(
				mdbaseHiddenFolders(
					{},
					folders("schemas", `schemas/${id}`, "_schemas", "_schemas/tasknotes")
				)
			).toEqual(["schemas", "_schemas"]);
		}
	);

	it("resolves schemas relative to custom contracts without hiding their parent", () => {
		expect(
			mdbaseHiddenFolders(
				{ types_folder: "Metadata/types", contracts_folder: "Metadata/contracts" },
				folders(
					"Metadata",
					"Metadata/types",
					"Metadata/contracts",
					"Metadata/schemas",
					"Metadata/schemas/tasknotes.settings",
					"Metadata/_schemas",
					"Metadata/_schemas/tasknotes",
					"schemas"
				)
			)
		).toEqual([
			"Metadata/types",
			"Metadata/contracts",
			"Metadata/schemas",
			"Metadata/_schemas",
		]);
	});

	it("hides reserved folders even with old types and no TaskNotes settings record", () => {
		expect(mdbaseHiddenFolders({}, folders("_mdbase", "_settings"))).toEqual(["_mdbase", "_settings"]);
	});

	it("recognizes schemas older plugins left at the root with nested contracts", () => {
		expect(
			mdbaseHiddenFolders(
				{ contracts_folder: "Metadata/contracts" },
				folders("schemas", "schemas/mdbase.app-settings", "_schemas", "_schemas/tasknotes")
			)
		).toEqual(["schemas", "_schemas"]);
	});

	it("rejects unsafe configured paths", () => {
		expect(
			mdbaseHiddenFolders(
				{ types_folder: "../private", contracts_folder: "/" },
				folders("../private", "/", "_types", "_contracts")
			)
		).toEqual(["_types", "_contracts"]);
	});

	it("escapes selectors and scopes the CSS to the core explorer", () => {
		const css = mdbaseFolderCss(['Metadata/"quoted"']);
		expect(css).toContain(
			'.workspace-leaf-content[data-type="file-explorer"] .nav-folder:has(> .nav-folder-title[data-path="Metadata/\\"quoted\\""])'
		);
		expect(css).toContain("display: none !important");
		expect(mdbaseFolderCss([])).toBe("");
	});
});
