import { getContentBottomAboveMobileNavigation } from "../../../src/utils/mobileNavigation";

describe("floating mobile navigation clearance", () => {
	afterEach(() => { document.body.className = ""; document.body.innerHTML = ""; });

	it("reserves a floating bar even when it does not touch the viewport bottom", () => {
		document.body.classList.add("is-mobile");
		const nav = document.body.createDiv({ cls: "mobile-navbar" });
		nav.getBoundingClientRect = () => ({ width: 380, height: 48, top: 700, bottom: 748 }) as DOMRect;
		expect(getContentBottomAboveMobileNavigation(document, 768)).toBe(700);
		document.body.classList.remove("is-mobile");
		expect(getContentBottomAboveMobileNavigation(document, 768)).toBe(768);
	});
});
