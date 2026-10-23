import type { MessageDescriptor } from "@lingui/core";
import { uiText } from "./runtime";

type TextTag = "strong" | "code" | "em" | "span";

/** Numeric Lingui tags are structure, never translator-provided HTML/attributes.
 * String parameters are inserted as text AFTER tag parsing, so user values such
 * as '<0>title</0>' cannot introduce formatting or HTML.
 */
export function uiRichText(parent: HTMLElement, descriptor: MessageDescriptor, values: Record<string, unknown>, tags: Record<string, TextTag>): void {
	const parameters = { ...descriptor.values, ...values };
	const strings: string[] = [];
	for (const [key, value] of Object.entries(parameters)) {
		if (typeof value !== "string") continue;
		strings.push(value);
		parameters[key] = `\uE000${strings.length - 1}\uE001`;
	}
	const text = uiText({ ...descriptor, values: undefined }, parameters);
	const appendText = (element: HTMLElement, value: string): void => {
		let offset = 0;
		for (const match of value.matchAll(/\uE000(\d+)\uE001/g)) {
			element.append(parent.ownerDocument.createTextNode(value.slice(offset, match.index)));
			element.append(parent.ownerDocument.createTextNode(strings[Number(match[1])] ?? match[0]));
			offset = match.index + match[0].length;
		}
		element.append(parent.ownerDocument.createTextNode(value.slice(offset)));
	};
	const stack: Array<{ element: HTMLElement; id: string }> = [{ element: parent, id: "" }];
	let offset = 0;
	for (const match of text.matchAll(/<(\/?)(\d+)>/g)) {
		const current = stack[stack.length - 1];
		appendText(current.element, text.slice(offset, match.index));
		if (match[1]) {
			if (stack.length > 1 && current.id === match[2]) stack.pop();
		} else {
			const element = parent.ownerDocument.createElement(tags[match[2]] ?? "span");
			current.element.append(element);
			stack.push({ element, id: match[2] });
		}
		offset = match.index + match[0].length;
	}
	appendText(stack[stack.length - 1].element, text.slice(offset));
}
