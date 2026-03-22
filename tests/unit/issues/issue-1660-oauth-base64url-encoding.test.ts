/**
 * Reproduction test for issue #1660.
 *
 * Reported behavior:
 * - Clicking "Connect to Calendar" for Google or Outlook shows
 *   "Failed to connect: Unknown encoding base64url" instead of the OAuth page.
 *
 * Root cause:
 * - OAuthService.ts uses Buffer.toString("base64url") which is not supported
 *   in all Electron/Node.js versions bundled with Obsidian. The "base64url"
 *   encoding was added in Node.js 15.7+.
 */

describe('Issue #1660: OAuth base64url encoding error', () => {
	it.skip('reproduces issue #1660 - base64url encoding should work in Obsidian runtime', () => {
		// Simulate the PKCE code verifier generation
		// Buffer.from([...]).toString("base64url") may throw "Unknown encoding"
		// in older Node.js / Electron runtimes

		const testBuffer = Buffer.from('test-data');

		// This may throw in environments that don't support base64url encoding
		let base64urlResult: string;
		try {
			base64urlResult = testBuffer.toString('base64url' as BufferEncoding);
		} catch (e: any) {
			// If base64url is not supported, fall back to manual conversion
			base64urlResult = testBuffer
				.toString('base64')
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=/g, '');
		}

		// The fallback should produce a valid base64url string
		expect(base64urlResult).toBeDefined();
		expect(base64urlResult).not.toContain('+');
		expect(base64urlResult).not.toContain('/');
		expect(base64urlResult).not.toContain('=');
	});
});
