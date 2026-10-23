import type { MessageDescriptor } from "@lingui/core";
import { uiText } from "./runtime";

type TextTag = "strong" | "code" | "em" | "span";

/** Numeric Lingui tags are structure, never translator-provided HTML or attributes. */
export function uiRichText(
	parent: HTMLElement,
	descriptor: MessageDescriptor,
	values: Record<string, unknown>,
	tags: Record<string, TextTag>
): void {
	const text = uiText(descriptor, values);
	const stack: HTMLElement[] = [parent];
	let offset = 0;
	for (const match of text.matchAll(/<(\/?)(\d+)>/g)) {
		stack[stack.length - 1].append(parent.ownerDocument.createTextNode(text.slice(offset, match.index)));
		if (match[1]) {
			if (stack.length > 1) stack.pop();
		} else {
			const element = parent.ownerDocument.createElement(tags[match[2]] ?? "span");
			stack[stack.length - 1].append(element);
			stack.push(element);
		}
		offset = match.index + match[0].length;
	}
	stack[stack.length - 1].append(parent.ownerDocument.createTextNode(text.slice(offset)));
}
