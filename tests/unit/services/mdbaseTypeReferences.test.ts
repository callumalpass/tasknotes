import YAML from "yaml";
import { remapMdbaseTypeReferences } from "../../../src/services/mdbaseTypeReferences";

const renames = new Map([["task", "tasknotes-task"]]);
const wrap = (frontmatter: string, body = "Keep this body: [[task]]\n") => `---\n${frontmatter}\n---\n${body}`;
const parse = (text: string) => YAML.parse(text.split("---")[1]);

describe("type reference migration", () => {
	it("rewrites only the configured explicit membership property", () => {
		const source = wrap("mdbase_type: task\ntype: book\ntags: [task]\ntitle: task");
		const output = remapMdbaseTypeReferences(source, renames, ["mdbase_type"], false);
		expect(parse(output)).toEqual({ mdbase_type: "tasknotes-task", type: "book", tags: ["task"], title: "task" });
		expect(output.endsWith("Keep this body: [[task]]\n")).toBe(true);
	});
	it.each(["[task, note]", "task"])("handles scalar and multiple membership: %s", (value) => {
		const output = remapMdbaseTypeReferences(wrap(`kind: ${value}`), renames, ["kind"], false);
		expect(JSON.stringify(parse(output).kind)).toContain("tasknotes-task");
	});
	it("updates definition link targets without changing task matching", () => {
		const source = wrap("kind: mdbase.type\nname: owner\nmatch:\n  where:\n    tags:\n      contains: task\ncollection:\n  links:\n    recurrence_parent:\n      target_type: task\n    blockedBy[].uid:\n      target_type: task\n    projects[]:\n      target_type: any");
		const output = remapMdbaseTypeReferences(source, renames, [], true);
		const data = parse(output);
		expect(data.collection.links.recurrence_parent.target_type).toBe("tasknotes-task");
		expect(data.collection.links["blockedBy[].uid"].target_type).toBe("tasknotes-task");
		expect(data.collection.links["projects[]"].target_type).toBe("any");
		expect(data.match.where.tags.contains).toBe("task");
		expect(data.name).toBe("owner");
	});
	it.each(["book", "article-journal", "task"])("does not claim a CSL/domain type property: %s", (type) => {
		const source = wrap(`type: ${type}\ntags: [task]`);
		expect(remapMdbaseTypeReferences(source, renames, ["mdbase_type"], false)).toBe(source);
	});
	it("preserves frontmatter comments and body", () => {
		const output = remapMdbaseTypeReferences(wrap("# Important\nmdbase_type: task # membership"), renames, ["mdbase_type"], false);
		expect(output).toContain("# Important");
		expect(output).toContain("# membership");
		expect(output.endsWith("Keep this body: [[task]]\n")).toBe(true);
	});
	it("is byte-idempotent after migration", () => {
		const once = remapMdbaseTypeReferences(wrap("mdbase_type: task"), renames, ["mdbase_type"], false);
		expect(remapMdbaseTypeReferences(once, renames, ["mdbase_type"], false)).toBe(once);
	});
	it("does not rewrite ordinary notes without frontmatter", () => {
		expect(remapMdbaseTypeReferences("task\n", renames, ["mdbase_type"], false)).toBe("task\n");
	});
	it("refuses malformed frontmatter rather than guessing at references", () => {
		expect(() => remapMdbaseTypeReferences(wrap("mdbase_type: [task"), renames, ["mdbase_type"], false)).toThrow();
	});
});
