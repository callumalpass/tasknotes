/**
 * Generate an RFC 4122 UUID v4 without adding a runtime dependency.
 *
 * Modern Obsidian runtimes expose Web Crypto. The Math.random fallback keeps
 * older/test runtimes functional while preserving the UUID shape.
 */
export function generateUuidV4(): string {
	const cryptoProvider = typeof window !== "undefined" ? window.crypto : undefined;

	if (typeof cryptoProvider?.randomUUID === "function") {
		return cryptoProvider.randomUUID();
	}

	const bytes = new Uint8Array(16);
	if (typeof cryptoProvider?.getRandomValues === "function") {
		cryptoProvider.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
		.slice(6, 8)
		.join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
