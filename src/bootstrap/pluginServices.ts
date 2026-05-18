import type { EventRef } from "obsidian";
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

export interface TaskPathAccessor {
	getAllTaskPaths(): Set<string>;
}

export interface TaskEventSource {
	on(name: string, callback: (...data: unknown[]) => unknown): EventRef;
	offref(ref: EventRef): void;
}

export interface ViewPerformanceServiceContext {
	emitter: TaskEventSource;
	cacheManager: TaskPathAccessor;
}
