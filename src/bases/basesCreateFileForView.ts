import type { App } from "obsidian";
import { generateLink } from "../utils/linkUtils";
import type { UserMappedField } from "../types/settings";
import {
	buildTaskCreationDataFromFrontmatter,
	type TaskCreationFieldMapper,
	type TaskCreationPrepopulatedValues,
} from "./basesTaskCreation";
import { extractBasesFilterDefaults } from "./basesFilterDefaults";

type BasesFrontmatterProcessor = (frontmatter: Record<string, unknown>) => void;

export type BuildBasesTaskCreationDataForViewOptions = {
	config: unknown;
	fieldMapper: TaskCreationFieldMapper;
	taskTag: string;
	userFields?: readonly Pick<UserMappedField, "key">[];
	currentFileLink: () => string | null;
	frontmatterProcessor?: BasesFrontmatterProcessor;
};

export function buildBasesTaskCreationDataForView({
	config,
	fieldMapper,
	taskTag,
	userFields = [],
	currentFileLink,
	frontmatterProcessor,
}: BuildBasesTaskCreationDataForViewOptions): TaskCreationPrepopulatedValues {
	const frontmatter = extractBasesFilterDefaults({
		config,
		fieldMapper,
		taskTag,
		userFields,
		currentFileLink,
	});

	frontmatterProcessor?.(frontmatter);

	return buildTaskCreationDataFromFrontmatter(frontmatter, fieldMapper, userFields);
}

export function getBasesCurrentFileLinkDefault(app: App, useMarkdownLinks?: boolean): string | null {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || activeFile.extension === "base") {
		return null;
	}

	return generateLink(app, activeFile, activeFile.path, "", "", useMarkdownLinks);
}
