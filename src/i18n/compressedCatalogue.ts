import { unzlibSync, strFromU8 } from "fflate";
import { compiledMessages } from "./catalogue";
import type { Messages } from "@lingui/core";

/** Build-only transport compaction. Synchronous on desktop AND mobile; no Node
 * APIs, evaluation, network or asynchronous language state. Pack bytes remain JSON.
 */
export function unpackBundledCatalogue(base64: string): { messages: Messages } {
	const binary = atob(base64);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return { messages: compiledMessages(JSON.parse(strFromU8(unzlibSync(bytes)))) };
}
