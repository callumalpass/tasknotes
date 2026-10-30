import { observeCalendarLayering } from "../../../src/bases/calendarStyleCompatibility";

const flush = () => Promise.resolve();

describe("calendar host inline stacking", () => {
	it("raises hover and drag states, restores layout stacking and disconnects cleanly", async () => {
		const root = document.createElement("div");
		const item = root.createDiv({ cls: "tnc-item" });
		item.style.zIndex = "3";
		const disconnect = observeCalendarLayering(root);
		item.classList.add("is-hover");
		await flush();
		expect(item.style.zIndex).toBe("20");
		item.classList.add("is-dragging");
		await flush();
		expect(item.style.zIndex).toBe("40");
		item.classList.remove("is-dragging");
		await flush();
		expect(item.style.zIndex).toBe("20");
		item.classList.remove("is-hover");
		await flush();
		expect(item.style.zIndex).toBe("3");
		disconnect();
		item.classList.add("is-hover");
		await flush();
		expect(item.style.zIndex).toBe("3");
	});

	it("removes the temporary override when the engine supplied no inline stack", async () => {
		const root = document.createElement("div");
		const item = root.createDiv({ cls: "tnc-item" });
		const disconnect = observeCalendarLayering(root);
		item.classList.add("is-hover");
		await flush();
		expect(item.style.zIndex).toBe("20");
		item.classList.remove("is-hover");
		await flush();
		expect(item.style.zIndex).toBe("");
		disconnect();
	});
});
