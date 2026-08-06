import { bindTextInputModalWidthToContent } from "../../../src/modals/TextInputModal";

describe("TextInputModal", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("bindTextInputModalWidthToContent sizes the input from its value", () => {
		const input = document.createElement("input");
		input.placeholder = "tag";
		document.body.appendChild(input);

		bindTextInputModalWidthToContent(input, { minCh: 10, maxCh: 20 });
		expect(input.style.width).toBe("12ch");

		input.value = "home";
		input.dispatchEvent(new Event("input"));
		expect(input.style.width).toBe("12ch");

		input.value = "a very long comma separated list of contexts";
		input.dispatchEvent(new Event("input"));
		expect(input.style.width).toBe("20ch");
	});
});
