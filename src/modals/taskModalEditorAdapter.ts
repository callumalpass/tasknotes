import { App } from "obsidian";
import { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";

export interface TaskModalEditorOptions {
	value: string;
	placeholder: string;
	cls: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onEscape: () => void;
	onTab: () => boolean;
	extensions?: any[];
}

export function createTaskModalMarkdownEditor(
	app: App,
	container: HTMLElement,
	options: TaskModalEditorOptions
): EmbeddableMarkdownEditor | null {
	try {
		return new EmbeddableMarkdownEditor(app, container, options);
	} catch (error) {
		console.error("Failed to create markdown editor:", error);

		const fallbackTextarea = container.createEl("textarea", {
			cls: options.cls + "-fallback",
			placeholder: options.placeholder,
		});
		fallbackTextarea.value = options.value;
		fallbackTextarea.addEventListener("input", (e) => {
			options.onChange((e.target as HTMLTextAreaElement).value);
		});
		fallbackTextarea.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				options.onSubmit();
			} else if (e.key === "Escape") {
				e.preventDefault();
				options.onEscape();
			} else if (e.key === "Tab") {
				const shouldPreventDefault = options.onTab();
				if (shouldPreventDefault) {
					e.preventDefault();
				}
			}
		});

		return null;
	}
}
