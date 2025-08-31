import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getRoutes, RouteInfo } from '../utils/OpenAPIDecorators';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';
export type RouteHandler = (req: IncomingMessage, res: ServerResponse, params?: Record<string, string>) => Promise<void>;

interface Route {
	method: HTTPMethod;
	pattern: string;
	handler: RouteHandler;
	regex: RegExp;
	paramNames: string[];
}

export class APIRouter {
	private routes: Route[] = [];

	private compilePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
		const paramNames: string[] = [];
		const regexPattern = pattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, paramName) => {
			paramNames.push(paramName);
			return '([^/]+)';
		});
		
		const regex = new RegExp(`^${regexPattern}$`);
		return { regex, paramNames };
	}

	register(method: HTTPMethod, pattern: string, handler: RouteHandler): void {
		const { regex, paramNames } = this.compilePattern(pattern);
		this.routes.push({
			method,
			pattern,
			handler,
			regex,
			paramNames
		});
	}

	get(pattern: string, handler: RouteHandler): void {
		this.register('GET', pattern, handler);
	}

	post(pattern: string, handler: RouteHandler): void {
		this.register('POST', pattern, handler);
	}

	put(pattern: string, handler: RouteHandler): void {
		this.register('PUT', pattern, handler);
	}

	delete(pattern: string, handler: RouteHandler): void {
		this.register('DELETE', pattern, handler);
	}

	options(pattern: string, handler: RouteHandler): void {
		this.register('OPTIONS', pattern, handler);
	}

	async route(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
		const parsedUrl = parse(req.url || '', true);
		const pathname = parsedUrl.pathname || '';
		const method = req.method as HTTPMethod;

		for (const route of this.routes) {
			if (route.method === method) {
				const match = pathname.match(route.regex);
				if (match) {
					const params: Record<string, string> = {};
					
					// Extract route parameters
					for (let i = 0; i < route.paramNames.length; i++) {
						const paramName = route.paramNames[i];
						const paramValue = match[i + 1];
						if (paramValue) {
							params[paramName] = decodeURIComponent(paramValue);
						}
					}

					// Call the handler
					await route.handler(req, res, params);
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Register a controller using decorator-based routes
	 */
	registerController(controllerInstance: any): void {
		const routes = getRoutes(controllerInstance.constructor);
		
		for (const routeInfo of routes) {
			const handler = controllerInstance[routeInfo.handler];
			if (typeof handler === 'function') {
				this.register(
					routeInfo.method.toUpperCase() as HTTPMethod,
					routeInfo.path,
					handler.bind(controllerInstance)
				);
			}
		}
	}

	getRoutes(): Readonly<Route[]> {
		return this.routes;
	}
}