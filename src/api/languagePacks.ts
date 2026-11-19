import { requestUrl } from "obsidian";

/** Native Obsidian transport supports desktop/mobile without browser CORS bypasses. */
export async function downloadLanguagePack(url: string): Promise<Uint8Array> {
	const response = await requestUrl({ url, method: "GET", throw: false });
	if (response.status !== 200) {
		throw new Error(`Language-pack HTTP status: ${response.status}`);
	}
	return new Uint8Array(response.arrayBuffer);
}
