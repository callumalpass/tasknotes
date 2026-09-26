import { renderDependencyList, type DependencyItem } from "../../../src/modals/taskModalDependencies";

const items: DependencyItem[] = ["first", "second"].map((name) => ({
	dependency: { uid: `[[${name}]]`, reltype: "FINISHTOSTART" },
	name,
	path: `${name}.md`,
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}

describe("dependency list rendering", () => {
	it("does not duplicate later rows when initial renders overlap", async () => {
		const listEl = document.createElement("div");
		const pending = [deferred<null>(), deferred<null>()];
		let lookup = 0;
		const plugin = {
			cacheManager: { getCachedTaskInfo: jest.fn(() => pending[lookup++ % 2].promise) },
		};
		const options = {
			plugin: plugin as any,
			listEl,
			items,
			linkServices: { metadataCache: {} as any, workspace: {} as any, sourcePath: "" },
			translate: (key: string) => key,
			onRemove: jest.fn(),
		};

		const firstRender = renderDependencyList(options);
		const secondRender = renderDependencyList(options);
		pending[0].resolve(null);
		pending[1].resolve(null);
		await Promise.all([firstRender, secondRender]);

		expect(listEl.querySelectorAll(".task-project-item")).toHaveLength(2);
		listEl.querySelectorAll<HTMLButtonElement>(".task-project-remove")[1].click();
		expect(options.onRemove).toHaveBeenCalledWith(1);
	});

	it("does not let an older pending render overwrite a newer empty list", async () => {
		const listEl = document.createElement("div");
		const lookup = deferred<null>();
		const options = {
			plugin: { cacheManager: { getCachedTaskInfo: () => lookup.promise } } as any,
			listEl,
			items,
			linkServices: { metadataCache: {} as any, workspace: {} as any, sourcePath: "" },
			translate: (key: string) => key,
			onRemove: jest.fn(),
		};
		const oldRender = renderDependencyList(options);
		await renderDependencyList({ ...options, items: [] });
		lookup.resolve(null);
		await oldRender;
		expect(listEl.children).toHaveLength(0);
	});
});
