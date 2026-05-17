import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { renderTextWithLinks, type LinkServices } from "../../../src/ui/renderers/linkRenderer";
import { PluginFactory } from "../../helpers/mock-factories";
import { makeContainer } from "../../helpers/dom-helpers";

describe("issue #1365 email link conversion", () => {
	it("preserves message protocol links from converted task titles in task details", async () => {
		let createdTaskData: any = null;
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				taskTag: "task",
				tasksFolder: "tasks",
				taskIdentificationMethod: "tag",
				enableNaturalLanguageInput: false,
				useDefaultsOnInstantConvert: false,
				storeTitleInFilename: true,
				taskFilenameFormat: "title",
			},
		});
		plugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);
		plugin.taskService = {
			createTask: jest.fn().mockImplementation(async (taskData) => {
				createdTaskData = taskData;
				return {
					file: { path: "tasks/review-reddit-plan.md", basename: "review-reddit-plan" },
					taskInfo: { title: taskData.title },
				};
			}),
		} as any;

		const service = new InstantTaskConvertService(
			plugin,
			plugin.statusManager,
			plugin.priorityManager
		);
		const emailLink =
			"[Re: Introduction](message:%3CCAAJhwLz9bgAmusvMShG1KbVb=gT0-to7huUMhheCK7L6_D1new@mail.gmail.com%3E)";

		await (service as any).createTaskFile(
			{
				title: `Review Reddit plan: ${emailLink}`,
				isCompleted: false,
			},
			""
		);

		expect(createdTaskData.title).toBe("Review Reddit plan: Re: Introduction");
		expect(createdTaskData.details).toContain("Source links:");
		expect(createdTaskData.details).toContain(emailLink);
	});

	it("renders single-colon URI markdown links as external links", () => {
		const container = makeContainer();
		const linkServices: LinkServices = {
			metadataCache: {
				getFirstLinkpathDest: jest.fn().mockReturnValue(null),
			} as unknown as LinkServices["metadataCache"],
			workspace: {
				trigger: jest.fn(),
				getLeaf: jest.fn().mockReturnValue({ openFile: jest.fn() }),
				openLinkText: jest.fn(),
			} as unknown as LinkServices["workspace"],
			sourcePath: "TaskNotes/Tasks/source.md",
		};

		renderTextWithLinks(
			container,
			"[Re: Introduction](message:%3Cabc@example.com%3E) [Reply](mailto:abc@example.com)",
			linkServices
		);

		const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.external-link"));
		expect(links).toHaveLength(2);
		expect(links[0].textContent).toBe("Re: Introduction");
		expect(links[0].getAttribute("href")).toBe("message:%3Cabc@example.com%3E");
		expect(links[1].textContent).toBe("Reply");
		expect(links[1].getAttribute("href")).toBe("mailto:abc@example.com");
		expect(container.querySelector(".internal-link")).toBeNull();
	});
});
