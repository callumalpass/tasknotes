import "reflect-metadata";

// OpenAPI specification interfaces
export interface OpenAPIParameter {
	name: string;
	in: "query" | "path" | "header" | "cookie";
	required?: boolean;
	schema: {
		type: string;
		format?: string;
		enum?: string[];
		minimum?: number;
		maximum?: number;
		description?: string;
	};
	description?: string;
}

export interface OpenAPIResponse {
	description: string;
	content?: {
		[mediaType: string]: {
			schema: any;
			example?: any;
		};
	};
}

export interface OpenAPIOperation {
	summary?: string;
	description?: string;
	operationId?: string;
	tags?: string[];
	parameters?: OpenAPIParameter[];
	requestBody?: {
		required?: boolean;
		content: {
			[mediaType: string]: {
				schema: any;
				example?: any;
			};
		};
	};
	responses: {
		[statusCode: string]: OpenAPIResponse;
	};
	security?: Array<{ [securityScheme: string]: string[] }>;
}

export interface OpenAPIEndpoint {
	path: string;
	method: string;
	operation: OpenAPIOperation;
}

// Metadata keys for storing OpenAPI information
const OPENAPI_OPERATION_KEY = Symbol("openapi:operation");
const OPENAPI_ENDPOINTS_KEY = Symbol("openapi:endpoints");
const ROUTE_KEY = Symbol("route");

// Route information interface
export interface RouteInfo {
	method: string;
	path: string;
	handler: string; // method name
}

/**
 * Class decorator to mark a class as having OpenAPI endpoints
 */
export function OpenAPIController(target: any) {
	if (!Reflect.hasMetadata(OPENAPI_ENDPOINTS_KEY, target)) {
		Reflect.defineMetadata(OPENAPI_ENDPOINTS_KEY, [], target);
	}
	return target;
}

/**
 * Route decorator for defining HTTP routes
 */
export function Route(method: string, path: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		// Store route metadata
		Reflect.defineMetadata(
			ROUTE_KEY,
			{ method: method.toLowerCase(), path, handler: propertyKey },
			target,
			propertyKey
		);

		// Also store in class-level routes array for easy access
		const routes: RouteInfo[] = Reflect.getMetadata("routes", target.constructor) || [];
		routes.push({ method: method.toLowerCase(), path, handler: propertyKey });
		Reflect.defineMetadata("routes", routes, target.constructor);
	};
}

/**
 * HTTP method decorators
 */
export function Get(path: string) {
	return Route("GET", path);
}

export function Post(path: string) {
	return Route("POST", path);
}

export function Put(path: string) {
	return Route("PUT", path);
}

export function Delete(path: string) {
	return Route("DELETE", path);
}

/**
 * Method decorator for documenting API endpoints
 */
export function OpenAPI(operation: OpenAPIOperation) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		Reflect.defineMetadata(OPENAPI_OPERATION_KEY, operation, target, propertyKey);

		// Store endpoint information on the class
		const endpoints: OpenAPIEndpoint[] =
			Reflect.getMetadata(OPENAPI_ENDPOINTS_KEY, target.constructor) || [];

		// Get route info from route decorator, or fall back to extractPathAndMethod
		const routeInfo: RouteInfo = Reflect.getMetadata(ROUTE_KEY, target, propertyKey);
		const { path, method } = routeInfo || extractPathAndMethod(propertyKey);

		endpoints.push({
			path,
			method,
			operation,
		});

		Reflect.defineMetadata(OPENAPI_ENDPOINTS_KEY, endpoints, target.constructor);
	};
}

/**
 * Extract path and HTTP method from handler method name (DEPRECATED)
 * This is kept for backward compatibility with existing OpenAPI decorators
 * New code should use @Route decorators instead
 */
function extractPathAndMethod(methodName: string): { path: string; method: string } {
	console.warn(
		`extractPathAndMethod is deprecated. Use @Route decorators on method: ${methodName}`
	);
	return { path: "/api/unknown", method: "get" };
}

/**
 * Generate OpenAPI specification from decorated methods
 */
export function generateOpenAPISpec(controllerInstance: any): any {
	// Get endpoints from @OpenAPI decorators
	const openAPIEndpoints: OpenAPIEndpoint[] =
		Reflect.getMetadata(OPENAPI_ENDPOINTS_KEY, controllerInstance.constructor) || [];

	// Also get routes from @Get/@Post/etc decorators
	const routes: RouteInfo[] = getRoutes(controllerInstance.constructor) || [];

	const spec = {
		openapi: "3.0.0",
		info: {
			title: "TaskNotes API",
			version: "1.0.0",
			description:
				"RESTful API for managing tasks, time tracking, and automation in TaskNotes",
			contact: {
				name: "TaskNotes",
				url: "https://github.com/your-repo/tasknotes",
			},
		},
		servers: [
			{
				url: "http://localhost:8080",
				description: "Local development server",
			},
		],
		security: [
			{
				bearerAuth: [],
			},
		],
		paths: {} as any,
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
					description: "Optional bearer token for API authentication",
				},
			},
			schemas: getCommonSchemas(),
		},
	};

	// Add endpoints from @OpenAPI decorators
	for (const endpoint of openAPIEndpoints) {
		if (!spec.paths[endpoint.path]) {
			spec.paths[endpoint.path] = {};
		}
		spec.paths[endpoint.path][endpoint.method.toLowerCase()] = endpoint.operation;
	}

	// Add routes from @Get/@Post/etc decorators (with basic documentation)
	for (const route of routes) {
		if (!spec.paths[route.path]) {
			spec.paths[route.path] = {};
		}

		// Only add if not already defined by @OpenAPI decorator
		if (!spec.paths[route.path][route.method.toLowerCase()]) {
			spec.paths[route.path][route.method.toLowerCase()] = {
				summary: `${route.method.toUpperCase()} ${route.path}`,
				description: `${route.method.toUpperCase()} endpoint for ${route.path}`,
				responses: {
					"200": {
						description: "Success",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/APIResponse",
								},
							},
						},
					},
					"400": {
						description: "Bad Request",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
							},
						},
					},
					"500": {
						description: "Internal Server Error",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
							},
						},
					},
				},
			};
		}
	}

	return spec;
}

/**
 * Common schema definitions for TaskNotes API
 */
function getCommonSchemas(): any {
	return {
		APIResponse: {
			type: "object",
			properties: {
				success: {
					type: "boolean",
					description: "Whether the request was successful",
				},
				data: {
					description: "Response data (varies by endpoint)",
				},
				error: {
					type: "string",
					description: "Error message (present when success is false)",
				},
				message: {
					type: "string",
					description: "Optional success message",
				},
			},
			required: ["success"],
		},
		Task: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Unique task identifier (file path)",
				},
				title: {
					type: "string",
					description: "Task title",
					maxLength: 200,
				},
				status: {
					type: "string",
					description: "Current task status",
					enum: ["todo", "open", "completed", "in-progress", "cancelled"],
				},
				priority: {
					type: "string",
					description: "Task priority level",
					enum: ["low", "normal", "medium", "high", "urgent"],
				},
				due: {
					type: "string",
					format: "date-time",
					description: "Due date and time (ISO 8601 format)",
					nullable: true,
				},
				scheduled: {
					type: "string",
					format: "date-time",
					description: "Scheduled date and time (ISO 8601 format)",
					nullable: true,
				},
				path: {
					type: "string",
					description: "File path of the task",
				},
				archived: {
					type: "boolean",
					description: "Whether the task is archived",
				},
				tags: {
					type: "array",
					items: {
						type: "string",
					},
					description: "Task tags",
				},
				contexts: {
					type: "array",
					items: {
						type: "string",
					},
					description: "Task contexts (GTD-style)",
				},
				projects: {
					type: "array",
					items: {
						type: "string",
					},
					description: "Associated projects",
				},
				timeEstimate: {
					type: "integer",
					minimum: 0,
					description: "Estimated time in minutes",
					nullable: true,
				},
				details: {
					type: "string",
					description: "Additional task details/description",
					nullable: true,
				},
				dateCreated: {
					type: "string",
					format: "date-time",
					description: "Task creation timestamp",
				},
				dateModified: {
					type: "string",
					format: "date-time",
					description: "Last modification timestamp",
				},
			},
			required: ["id", "title", "status", "path"],
		},
		TaskCreationData: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Task title",
					maxLength: 200,
				},
				status: {
					type: "string",
					description: "Initial task status",
					enum: ["todo", "open", "in-progress"],
				},
				priority: {
					type: "string",
					description: "Task priority level",
					enum: ["low", "normal", "medium", "high", "urgent"],
				},
				due: {
					type: "string",
					format: "date-time",
					description: "Due date and time (ISO 8601 format)",
				},
				scheduled: {
					type: "string",
					format: "date-time",
					description: "Scheduled date and time (ISO 8601 format)",
				},
				tags: {
					type: "array",
					items: {
						type: "string",
					},
					description: "Task tags",
				},
				contexts: {
					type: "array",
					items: {
						type: "string",
					},
					description: "Task contexts",
				},
				projects: {
					type: "array",
					items: {
						type: "string",
					},
					description: "Associated projects",
				},
				details: {
					type: "string",
					description: "Task details/description",
				},
				timeEstimate: {
					type: "integer",
					minimum: 0,
					description: "Estimated time in minutes",
				},
			},
			required: ["title"],
		},
		TaskStats: {
			type: "object",
			properties: {
				total: {
					type: "integer",
					description: "Total number of tasks",
				},
				completed: {
					type: "integer",
					description: "Number of completed tasks",
				},
				active: {
					type: "integer",
					description: "Number of active (non-completed, non-archived) tasks",
				},
				overdue: {
					type: "integer",
					description: "Number of overdue tasks",
				},
				archived: {
					type: "integer",
					description: "Number of archived tasks",
				},
				withTimeTracking: {
					type: "integer",
					description: "Number of tasks with time tracking entries",
				},
			},
			required: ["total", "completed", "active", "overdue", "archived", "withTimeTracking"],
		},
		WebhookConfig: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Unique webhook identifier",
				},
				url: {
					type: "string",
					format: "uri",
					description: "Webhook endpoint URL",
				},
				events: {
					type: "array",
					items: {
						type: "string",
						enum: [
							"task.created",
							"task.updated",
							"task.deleted",
							"task.completed",
							"task.archived",
							"task.unarchived",
							"time.started",
							"time.stopped",
							"pomodoro.started",
							"pomodoro.completed",
							"pomodoro.interrupted",
							"recurring.instance.completed",
							"reminder.triggered",
						],
					},
					description: "Events to subscribe to",
					minItems: 1,
				},
				active: {
					type: "boolean",
					description: "Whether the webhook is active",
				},
				transformFile: {
					type: "string",
					description: "Optional transform file path for payload customization",
				},
				corsHeaders: {
					type: "boolean",
					description:
						"Whether to include custom headers (disable for strict CORS services)",
				},
			},
			required: ["url", "events"],
		},
		PomodoroSession: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Unique session identifier",
				},
				type: {
					type: "string",
					enum: ["work", "short-break", "long-break"],
					description: "Type of pomodoro session",
				},
				duration: {
					type: "integer",
					description: "Session duration in seconds",
				},
				startTime: {
					type: "string",
					format: "date-time",
					description: "Session start timestamp",
				},
				endTime: {
					type: "string",
					format: "date-time",
					description: "Session end timestamp",
					nullable: true,
				},
				task: {
					$ref: "#/components/schemas/Task",
					nullable: true,
					description: "Associated task (if any)",
				},
			},
			required: ["id", "type", "duration", "startTime"],
		},
		PomodoroState: {
			type: "object",
			properties: {
				isRunning: {
					type: "boolean",
					description: "Whether a pomodoro session is currently running",
				},
				timeRemaining: {
					type: "integer",
					description: "Time remaining in current session (seconds)",
				},
				currentSession: {
					$ref: "#/components/schemas/PomodoroSession",
					nullable: true,
					description: "Current active session (if any)",
				},
				nextSessionType: {
					type: "string",
					enum: ["work", "short-break", "long-break"],
					nullable: true,
					description: "Suggested next session type",
				},
				totalPomodoros: {
					type: "integer",
					description: "Total completed pomodoros (all time)",
				},
				currentStreak: {
					type: "integer",
					description: "Current consecutive pomodoro streak",
				},
				totalMinutesToday: {
					type: "integer",
					description: "Total focused minutes today",
				},
			},
			required: ["isRunning", "timeRemaining"],
		},
		PomodoroSessionHistory: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Session identifier",
				},
				type: {
					type: "string",
					enum: ["work", "short-break", "long-break"],
				},
				startTime: {
					type: "string",
					format: "date-time",
				},
				endTime: {
					type: "string",
					format: "date-time",
				},
				duration: {
					type: "integer",
					description: "Actual session duration in seconds",
				},
				completed: {
					type: "boolean",
					description: "Whether the session was completed (not interrupted)",
				},
				taskPath: {
					type: "string",
					nullable: true,
					description: "Associated task file path",
				},
				taskTitle: {
					type: "string",
					nullable: true,
					description: "Associated task title",
				},
			},
			required: ["id", "type", "startTime", "endTime", "duration", "completed"],
		},
		PomodoroStats: {
			type: "object",
			properties: {
				totalSessions: {
					type: "integer",
					description: "Total number of sessions",
				},
				completedSessions: {
					type: "integer",
					description: "Number of completed sessions",
				},
				interruptedSessions: {
					type: "integer",
					description: "Number of interrupted sessions",
				},
				totalFocusTime: {
					type: "integer",
					description: "Total focused time in minutes",
				},
				workSessions: {
					type: "integer",
					description: "Number of work sessions",
				},
				breakSessions: {
					type: "integer",
					description: "Number of break sessions",
				},
				longestStreak: {
					type: "integer",
					description: "Longest consecutive completed sessions",
				},
				averageSessionLength: {
					type: "number",
					description: "Average session length in minutes",
				},
			},
			required: [
				"totalSessions",
				"completedSessions",
				"interruptedSessions",
				"totalFocusTime",
			],
		},
		TimeEntry: {
			type: "object",
			properties: {
				startTime: {
					type: "string",
					format: "date-time",
					description: "ISO timestamp when time tracking started",
				},
				endTime: {
					type: "string",
					format: "date-time",
					nullable: true,
					description: "ISO timestamp when time tracking ended (null if still running)",
				},
				description: {
					type: "string",
					nullable: true,
					description: "Optional description of work being tracked",
				},
				duration: {
					type: "integer",
					minimum: 0,
					description: "Duration in minutes (calculated or manually set)",
				},
				isActive: {
					type: "boolean",
					description: "Whether this time entry is currently active",
				},
			},
			required: ["startTime", "duration", "isActive"],
		},
		ActiveTimeSession: {
			type: "object",
			properties: {
				task: {
					type: "object",
					properties: {
						id: {
							type: "string",
							description: "Task identifier (file path)",
						},
						title: {
							type: "string",
							description: "Task title",
						},
						status: {
							type: "string",
							description: "Task status",
						},
						priority: {
							type: "string",
							description: "Task priority",
						},
						tags: {
							type: "array",
							items: { type: "string" },
							description: "Task tags",
						},
						projects: {
							type: "array",
							items: { type: "string" },
							description: "Associated projects",
						},
					},
					required: ["id", "title", "status"],
				},
				session: {
					type: "object",
					properties: {
						startTime: {
							type: "string",
							format: "date-time",
							description: "When the session started",
						},
						description: {
							type: "string",
							nullable: true,
							description: "Session description",
						},
						elapsedMinutes: {
							type: "integer",
							minimum: 0,
							description: "Minutes elapsed since session started",
						},
					},
					required: ["startTime", "elapsedMinutes"],
				},
				elapsedMinutes: {
					type: "integer",
					minimum: 0,
					description: "Total elapsed minutes for this session",
				},
			},
			required: ["task", "session", "elapsedMinutes"],
		},
		TimeSummary: {
			type: "object",
			properties: {
				period: {
					type: "string",
					enum: ["today", "week", "month", "all", "custom"],
					description: "Time period for the summary",
				},
				dateRange: {
					type: "object",
					properties: {
						from: {
							type: "string",
							format: "date-time",
							description: "Start date of the summary period",
						},
						to: {
							type: "string",
							format: "date-time",
							description: "End date of the summary period",
						},
					},
					required: ["from", "to"],
				},
				summary: {
					type: "object",
					properties: {
						totalMinutes: {
							type: "integer",
							minimum: 0,
							description: "Total tracked time in minutes",
						},
						totalHours: {
							type: "number",
							minimum: 0,
							description: "Total tracked time in hours (rounded to 2 decimals)",
						},
						tasksWithTime: {
							type: "integer",
							minimum: 0,
							description: "Number of tasks with time tracking data",
						},
						activeTasks: {
							type: "integer",
							minimum: 0,
							description: "Number of tasks with active time tracking",
						},
						completedTasks: {
							type: "integer",
							minimum: 0,
							description: "Number of completed tasks with time tracking",
						},
					},
					required: [
						"totalMinutes",
						"totalHours",
						"tasksWithTime",
						"activeTasks",
						"completedTasks",
					],
				},
				topTasks: {
					type: "array",
					items: {
						type: "object",
						properties: {
							task: {
								type: "string",
								description: "Task identifier",
							},
							title: {
								type: "string",
								description: "Task title",
							},
							minutes: {
								type: "integer",
								minimum: 0,
								description: "Total minutes tracked for this task",
							},
						},
						required: ["task", "title", "minutes"],
					},
					description: "Top 10 tasks by time tracked",
				},
				topProjects: {
					type: "array",
					items: {
						type: "object",
						properties: {
							project: {
								type: "string",
								description: "Project name",
							},
							minutes: {
								type: "integer",
								minimum: 0,
								description: "Total minutes tracked for this project",
							},
						},
						required: ["project", "minutes"],
					},
					description: "Top 10 projects by time tracked",
				},
				topTags: {
					type: "array",
					items: {
						type: "object",
						properties: {
							tag: {
								type: "string",
								description: "Tag name",
							},
							minutes: {
								type: "integer",
								minimum: 0,
								description: "Total minutes tracked for this tag",
							},
						},
						required: ["tag", "minutes"],
					},
					description: "Top 10 tags by time tracked",
				},
			},
			required: ["period", "dateRange", "summary", "topTasks", "topProjects", "topTags"],
		},
		TaskTimeData: {
			type: "object",
			properties: {
				task: {
					type: "object",
					properties: {
						id: {
							type: "string",
							description: "Task identifier (file path)",
						},
						title: {
							type: "string",
							description: "Task title",
						},
						status: {
							type: "string",
							description: "Task status",
						},
						priority: {
							type: "string",
							description: "Task priority",
						},
					},
					required: ["id", "title", "status"],
				},
				summary: {
					type: "object",
					properties: {
						totalMinutes: {
							type: "integer",
							minimum: 0,
							description: "Total time tracked for this task in minutes",
						},
						totalHours: {
							type: "number",
							minimum: 0,
							description: "Total time tracked for this task in hours",
						},
						totalSessions: {
							type: "integer",
							minimum: 0,
							description: "Total number of time tracking sessions",
						},
						completedSessions: {
							type: "integer",
							minimum: 0,
							description: "Number of completed sessions",
						},
						activeSessions: {
							type: "integer",
							minimum: 0,
							maximum: 1,
							description: "Number of active sessions (0 or 1)",
						},
						averageSessionMinutes: {
							type: "number",
							minimum: 0,
							description: "Average session length in minutes",
						},
					},
					required: [
						"totalMinutes",
						"totalHours",
						"totalSessions",
						"completedSessions",
						"activeSessions",
						"averageSessionMinutes",
					],
				},
				activeSession: {
					type: "object",
					nullable: true,
					properties: {
						startTime: {
							type: "string",
							format: "date-time",
							description: "When the active session started",
						},
						description: {
							type: "string",
							nullable: true,
							description: "Description of the active session",
						},
						elapsedMinutes: {
							type: "integer",
							minimum: 0,
							description: "Minutes elapsed since session started",
						},
					},
					required: ["startTime", "elapsedMinutes"],
				},
				timeEntries: {
					type: "array",
					items: {
						$ref: "#/components/schemas/TimeEntry",
					},
					description: "All time entries for this task",
				},
			},
			required: ["task", "summary", "timeEntries"],
		},
		Error: {
			type: "object",
			properties: {
				success: {
					type: "boolean",
					enum: [false],
				},
				error: {
					type: "string",
					description: "Error message describing what went wrong",
				},
			},
			required: ["success", "error"],
		},
	};
}

/**
 * Get route metadata from a method
 */
export function getRouteInfo(target: any, propertyKey: string): RouteInfo | undefined {
	return Reflect.getMetadata(ROUTE_KEY, target, propertyKey);
}

/**
 * Get all routes from a controller class
 */
export function getRoutes(controllerClass: any): RouteInfo[] {
	return Reflect.getMetadata("routes", controllerClass) || [];
}

/**
 * Get OpenAPI operation metadata from a method
 */
export function getOpenAPIOperation(
	target: any,
	propertyKey: string
): OpenAPIOperation | undefined {
	return Reflect.getMetadata(OPENAPI_OPERATION_KEY, target, propertyKey);
}

/**
 * Check if a class has OpenAPI endpoints
 */
export function hasOpenAPIEndpoints(target: any): boolean {
	const endpoints: OpenAPIEndpoint[] = Reflect.getMetadata(OPENAPI_ENDPOINTS_KEY, target) || [];
	return endpoints.length > 0;
}
