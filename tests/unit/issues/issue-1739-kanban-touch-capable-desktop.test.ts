import { shouldEnableKanbanTouchDrag } from "../../../src/bases/KanbanView";

describe("issue #1739 Kanban touch-capable desktop drag support", () => {
	it("keeps touch drag handlers enabled on mobile", () => {
		expect(shouldEnableKanbanTouchDrag(true, { maxTouchPoints: 0 }, null)).toBe(true);
	});

	it("enables touch drag handlers on desktop devices with touch points", () => {
		expect(shouldEnableKanbanTouchDrag(false, { maxTouchPoints: 10 }, null)).toBe(true);
	});

	it("enables touch drag handlers when the active pointer is coarse", () => {
		const matchMedia = jest.fn((query: string) => ({
			matches: query === "(any-pointer: coarse)",
			media: query,
			onchange: null,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			addListener: jest.fn(),
			removeListener: jest.fn(),
			dispatchEvent: jest.fn(),
		}));

		expect(
			shouldEnableKanbanTouchDrag(
				false,
				{ maxTouchPoints: 0 },
				{ matchMedia } as unknown as Pick<Window, "matchMedia">
			)
		).toBe(true);
	});

	it("does not enable touch drag handlers on pointer-only desktop devices", () => {
		const matchMedia = jest.fn((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			addListener: jest.fn(),
			removeListener: jest.fn(),
			dispatchEvent: jest.fn(),
		}));

		expect(
			shouldEnableKanbanTouchDrag(
				false,
				{ maxTouchPoints: 0 },
				{ matchMedia } as unknown as Pick<Window, "matchMedia">
			)
		).toBe(false);
	});
});
