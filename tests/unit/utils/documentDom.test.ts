import { createElementInDocument } from "../../../src/utils/documentDom";

describe("createElementInDocument", () => {
	it("creates elements in the requested document", () => {
		const popoutDocument = document.implementation.createHTMLDocument("TaskNotes popout");

		const element = createElementInDocument(popoutDocument, "section");

		expect(element.ownerDocument).toBe(popoutDocument);
		expect(element.tagName).toBe("SECTION");
	});
});
