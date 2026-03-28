export interface BasesValueLike {
	data?: unknown;
	date?: Date;
	file?: {
		path: string;
		name?: string;
		basename?: string;
		extension?: string;
		stat?: {
			size?: number;
			ctime?: number;
			mtime?: number;
		};
	};
	length?: () => number;
	at?: (index: number) => BasesValueLike | unknown;
	hasKey?: () => boolean;
	toISOString?: () => string;
	constructor?: {
		name?: string;
	};
}

export interface BasesEntryLike {
	file: NonNullable<BasesValueLike["file"]>;
	frontmatter?: Record<string, unknown>;
	properties?: Record<string, unknown>;
	getValue(propertyId: string): BasesValueLike | unknown;
}

export interface BasesGroupLike {
	hasKey(): boolean;
	key?: BasesValueLike | unknown;
	rows?: BasesEntryLike[];
	entries: BasesEntryLike[];
}

export interface BasesConfigLike {
	getSort(): unknown;
	getOrder(): string[];
	getDisplayName(propertyId: string): string;
	get(key: string): any;
	set(key: string, value: unknown): void;
	getAsPropertyId(key: string): string | null;
}

export interface BasesQueryResultLike {
	data: BasesEntryLike[];
	groupedData: BasesGroupLike[];
}

export interface BasesViewLike {
	config: BasesConfigLike;
	data: BasesQueryResultLike;
}
