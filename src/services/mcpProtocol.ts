export const TASKNOTES_MCP_PROTOCOL_VERSION = "2025-06-18";

const TASKNOTES_SUPPORTED_MCP_PROTOCOL_VERSIONS = new Set([
	TASKNOTES_MCP_PROTOCOL_VERSION,
	"2025-03-26",
	"2024-11-05",
	"2024-10-07",
]);

export type JsonRpcBody = Record<string, unknown> | Record<string, unknown>[];

export function normalizeMcpInitializeProtocol<T extends JsonRpcBody>(body: T): T {
	const messages = Array.isArray(body) ? body : [body];

	for (const message of messages) {
		const params = message.params as Record<string, unknown> | undefined;
		if (
			message.method !== "initialize" ||
			!params ||
			typeof params.protocolVersion !== "string" ||
			TASKNOTES_SUPPORTED_MCP_PROTOCOL_VERSIONS.has(params.protocolVersion)
		) {
			continue;
		}

		params.protocolVersion = TASKNOTES_MCP_PROTOCOL_VERSION;
	}

	return body;
}
