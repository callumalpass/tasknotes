export type CalendarRecreateNavigationState = {
	initialDate: string;
	initialDateProperty: string | null;
	initialDateStrategy: "first" | "earliest" | "latest";
};

export function shouldPreserveVisibleDateOnCalendarRecreate(
	previousState: CalendarRecreateNavigationState,
	nextState: CalendarRecreateNavigationState
): boolean {
	return (
		previousState.initialDate === nextState.initialDate &&
		previousState.initialDateProperty === nextState.initialDateProperty &&
		previousState.initialDateStrategy === nextState.initialDateStrategy
	);
}
