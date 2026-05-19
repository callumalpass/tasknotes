export type BasesVisiblePropertyMapper = {
	mapVisibleProperties(basesPropertyIds: string[]): string[];
	basesToTaskCardProperty(basesPropertyId: string): string | null | undefined;
};

export type BuildBasesVisiblePropertiesOptions = {
	basesPropertyIds: readonly string[];
	propertyMapper: Pick<BasesVisiblePropertyMapper, "mapVisibleProperties">;
	fallbackInternalProperties: readonly string[];
	toUserProperties: (properties: readonly string[]) => string[];
};

export type BuildBasesVisiblePropertyLabelsOptions = {
	basesPropertyIds: readonly string[];
	propertyMapper: Pick<BasesVisiblePropertyMapper, "basesToTaskCardProperty">;
	getDisplayName: (basesPropertyId: string) => unknown;
};

export function buildBasesVisibleProperties({
	basesPropertyIds,
	propertyMapper,
	fallbackInternalProperties,
	toUserProperties,
}: BuildBasesVisiblePropertiesOptions): string[] {
	const visibleProperties = propertyMapper.mapVisibleProperties([...basesPropertyIds]);
	if (visibleProperties.length > 0) {
		return visibleProperties;
	}

	return toUserProperties(fallbackInternalProperties);
}

export function buildBasesVisiblePropertyLabels({
	basesPropertyIds,
	propertyMapper,
	getDisplayName,
}: BuildBasesVisiblePropertyLabelsOptions): Record<string, string> {
	const labels: Record<string, string> = {};

	for (const basesPropertyId of basesPropertyIds) {
		const taskCardPropertyId = propertyMapper.basesToTaskCardProperty(basesPropertyId);
		const displayName = getDisplayName(basesPropertyId);
		if (
			taskCardPropertyId &&
			typeof displayName === "string" &&
			displayName.trim() !== ""
		) {
			labels[taskCardPropertyId] = displayName;
		}
	}

	return labels;
}
