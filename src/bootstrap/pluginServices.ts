import type { TaskInfo } from "../types";
import type { TranslationKey } from "../i18n";

export interface PluginI18nAccessor {
	i18n: {
		translate(key: TranslationKey, variables?: Record<string, string | number>): string;
		getCurrentLocale?: () => string;
	};
}

export interface TaskDataAccessor {
	getTaskInfo(path: string): Promise<TaskInfo | null>;
}
