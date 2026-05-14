export interface HTTPRequestLike {
	method?: string;
	url?: string;
	headers: Record<string, string | string[] | undefined>;
	on(event: "data", listener: (chunk: string | { toString(): string }) => void): void;
	on(event: "end", listener: () => void): void;
	on(event: "error", listener: (error: Error) => void): void;
}

export interface HTTPResponseLike {
	statusCode: number;
	headersSent?: boolean;
	setHeader(name: string, value: string): void;
	writeHead(statusCode: number, headers?: Record<string, string>): void;
	end(data?: string): void;
}

export interface HTTPServerLike {
	listening?: boolean;
	listen(port: number, callback?: () => void): void;
	listen(port: number, hostname: string, callback?: () => void): void;
	close(callback?: () => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	once(event: "error", listener: (error: Error) => void): void;
	once(event: "listening", listener: () => void): void;
}

export function parseRequestUrl(
	req: Pick<HTTPRequestLike, "url">
): URL {
	return new URL(req.url ?? "", "http://localhost");
}
