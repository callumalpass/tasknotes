import 'reflect-metadata';

// OpenAPI specification interfaces
export interface OpenAPIParameter {
	name: string;
	in: 'query' | 'path' | 'header' | 'cookie';
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
const OPENAPI_OPERATION_KEY = Symbol('openapi:operation');
const OPENAPI_ENDPOINTS_KEY = Symbol('openapi:endpoints');

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
 * Method decorator for documenting API endpoints
 */
export function OpenAPI(operation: OpenAPIOperation) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		Reflect.defineMetadata(OPENAPI_OPERATION_KEY, operation, target, propertyKey);
		
		// Store endpoint information on the class
		const endpoints: OpenAPIEndpoint[] = Reflect.getMetadata(OPENAPI_ENDPOINTS_KEY, target.constructor) || [];
		
		// Extract path and method from method name (convention-based)
		const { path, method } = extractPathAndMethod(propertyKey);
		
		endpoints.push({
			path,
			method,
			operation
		});
		
		Reflect.defineMetadata(OPENAPI_ENDPOINTS_KEY, endpoints, target.constructor);
	};
}

/**
 * Extract path and HTTP method from handler method name
 * Convention: handle{Method}{Resource} -> {method} /{resource}
 */
function extractPathAndMethod(methodName: string): { path: string; method: string } {
	// Handle special cases first
	if (methodName === 'handleHealthCheck') {
		return { path: '/api/health', method: 'get' };
	}
	
	if (methodName === 'handleGetTasks') {
		return { path: '/api/tasks', method: 'get' };
	}
	
	if (methodName === 'handleCreateTask') {
		return { path: '/api/tasks', method: 'post' };
	}
	
	if (methodName === 'handleGetTask') {
		return { path: '/api/tasks/{id}', method: 'get' };
	}
	
	if (methodName === 'handleUpdateTask') {
		return { path: '/api/tasks/{id}', method: 'put' };
	}
	
	if (methodName === 'handleDeleteTask') {
		return { path: '/api/tasks/{id}', method: 'delete' };
	}
	
	if (methodName === 'handleStartTimeTracking') {
		return { path: '/api/tasks/{id}/time/start', method: 'post' };
	}
	
	if (methodName === 'handleStopTimeTracking') {
		return { path: '/api/tasks/{id}/time/stop', method: 'post' };
	}
	
	if (methodName === 'handleToggleStatus') {
		return { path: '/api/tasks/{id}/toggle-status', method: 'post' };
	}
	
	if (methodName === 'handleToggleArchive') {
		return { path: '/api/tasks/{id}/archive', method: 'post' };
	}
	
	if (methodName === 'handleCompleteRecurringInstance') {
		return { path: '/api/tasks/{id}/complete-instance', method: 'post' };
	}
	
	if (methodName === 'handleQueryTasks') {
		return { path: '/api/tasks/query', method: 'post' };
	}
	
	if (methodName === 'handleGetFilterOptions') {
		return { path: '/api/filter-options', method: 'get' };
	}
	
	if (methodName === 'handleGetStats') {
		return { path: '/api/stats', method: 'get' };
	}
	
	if (methodName === 'handleNLPParse') {
		return { path: '/api/nlp/parse', method: 'post' };
	}
	
	if (methodName === 'handleNLPCreate') {
		return { path: '/api/nlp/create', method: 'post' };
	}
	
	if (methodName === 'handleRegisterWebhook') {
		return { path: '/api/webhooks', method: 'post' };
	}
	
	if (methodName === 'handleListWebhooks') {
		return { path: '/api/webhooks', method: 'get' };
	}
	
	if (methodName === 'handleDeleteWebhook') {
		return { path: '/api/webhooks/{id}', method: 'delete' };
	}
	
	if (methodName === 'handleGetWebhookDeliveries') {
		return { path: '/api/webhooks/deliveries', method: 'get' };
	}
	
	// Fallback - try to parse from method name
	const match = methodName.match(/^handle([A-Z][a-z]+)(.+)$/);
	if (match) {
		const method = match[1].toLowerCase();
		const resource = match[2].toLowerCase();
		return { path: `/api/${resource}`, method };
	}
	
	return { path: '/api/unknown', method: 'get' };
}

/**
 * Generate OpenAPI specification from decorated methods
 */
export function generateOpenAPISpec(controllerInstance: any): any {
	const endpoints: OpenAPIEndpoint[] = Reflect.getMetadata(OPENAPI_ENDPOINTS_KEY, controllerInstance.constructor) || [];
	
	const spec = {
		openapi: '3.0.0',
		info: {
			title: 'TaskNotes API',
			version: '1.0.0',
			description: 'RESTful API for managing tasks, time tracking, and automation in TaskNotes',
			contact: {
				name: 'TaskNotes',
				url: 'https://github.com/your-repo/tasknotes'
			}
		},
		servers: [
			{
				url: 'http://localhost:8080',
				description: 'Local development server'
			}
		],
		security: [
			{
				bearerAuth: []
			}
		],
		paths: {} as any,
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
					description: 'Optional bearer token for API authentication'
				}
			},
			schemas: getCommonSchemas()
		}
	};
	
	// Group endpoints by path and method
	for (const endpoint of endpoints) {
		if (!spec.paths[endpoint.path]) {
			spec.paths[endpoint.path] = {};
		}
		spec.paths[endpoint.path][endpoint.method] = endpoint.operation;
	}
	
	return spec;
}

/**
 * Common schema definitions for TaskNotes API
 */
function getCommonSchemas(): any {
	return {
		APIResponse: {
			type: 'object',
			properties: {
				success: {
					type: 'boolean',
					description: 'Whether the request was successful'
				},
				data: {
					description: 'Response data (varies by endpoint)'
				},
				error: {
					type: 'string',
					description: 'Error message (present when success is false)'
				},
				message: {
					type: 'string',
					description: 'Optional success message'
				}
			},
			required: ['success']
		},
		Task: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'Unique task identifier (file path)'
				},
				title: {
					type: 'string',
					description: 'Task title',
					maxLength: 200
				},
				status: {
					type: 'string',
					description: 'Current task status',
					enum: ['todo', 'open', 'completed', 'in-progress', 'cancelled']
				},
				priority: {
					type: 'string',
					description: 'Task priority level',
					enum: ['low', 'normal', 'medium', 'high', 'urgent']
				},
				due: {
					type: 'string',
					format: 'date-time',
					description: 'Due date and time (ISO 8601 format)',
					nullable: true
				},
				scheduled: {
					type: 'string',
					format: 'date-time',
					description: 'Scheduled date and time (ISO 8601 format)',
					nullable: true
				},
				path: {
					type: 'string',
					description: 'File path of the task'
				},
				archived: {
					type: 'boolean',
					description: 'Whether the task is archived'
				},
				tags: {
					type: 'array',
					items: {
						type: 'string'
					},
					description: 'Task tags'
				},
				contexts: {
					type: 'array',
					items: {
						type: 'string'
					},
					description: 'Task contexts (GTD-style)'
				},
				projects: {
					type: 'array',
					items: {
						type: 'string'
					},
					description: 'Associated projects'
				},
				timeEstimate: {
					type: 'integer',
					minimum: 0,
					description: 'Estimated time in minutes',
					nullable: true
				},
				details: {
					type: 'string',
					description: 'Additional task details/description',
					nullable: true
				},
				dateCreated: {
					type: 'string',
					format: 'date-time',
					description: 'Task creation timestamp'
				},
				dateModified: {
					type: 'string',
					format: 'date-time',
					description: 'Last modification timestamp'
				}
			},
			required: ['id', 'title', 'status', 'path']
		},
		TaskCreationData: {
			type: 'object',
			properties: {
				title: {
					type: 'string',
					description: 'Task title',
					maxLength: 200
				},
				status: {
					type: 'string',
					description: 'Initial task status',
					enum: ['todo', 'open', 'in-progress']
				},
				priority: {
					type: 'string',
					description: 'Task priority level',
					enum: ['low', 'normal', 'medium', 'high', 'urgent']
				},
				due: {
					type: 'string',
					format: 'date-time',
					description: 'Due date and time (ISO 8601 format)'
				},
				scheduled: {
					type: 'string',
					format: 'date-time',
					description: 'Scheduled date and time (ISO 8601 format)'
				},
				tags: {
					type: 'array',
					items: {
						type: 'string'
					},
					description: 'Task tags'
				},
				contexts: {
					type: 'array',
					items: {
						type: 'string'
					},
					description: 'Task contexts'
				},
				projects: {
					type: 'array',
					items: {
						type: 'string'
					},
					description: 'Associated projects'
				},
				details: {
					type: 'string',
					description: 'Task details/description'
				},
				timeEstimate: {
					type: 'integer',
					minimum: 0,
					description: 'Estimated time in minutes'
				}
			},
			required: ['title']
		},
		TaskStats: {
			type: 'object',
			properties: {
				total: {
					type: 'integer',
					description: 'Total number of tasks'
				},
				completed: {
					type: 'integer',
					description: 'Number of completed tasks'
				},
				active: {
					type: 'integer',
					description: 'Number of active (non-completed, non-archived) tasks'
				},
				overdue: {
					type: 'integer',
					description: 'Number of overdue tasks'
				},
				archived: {
					type: 'integer',
					description: 'Number of archived tasks'
				},
				withTimeTracking: {
					type: 'integer',
					description: 'Number of tasks with time tracking entries'
				}
			},
			required: ['total', 'completed', 'active', 'overdue', 'archived', 'withTimeTracking']
		},
		WebhookConfig: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'Unique webhook identifier'
				},
				url: {
					type: 'string',
					format: 'uri',
					description: 'Webhook endpoint URL'
				},
				events: {
					type: 'array',
					items: {
						type: 'string',
						enum: [
							'task.created', 'task.updated', 'task.deleted', 'task.completed',
							'task.archived', 'task.unarchived', 'time.started', 'time.stopped',
							'pomodoro.started', 'pomodoro.completed', 'pomodoro.interrupted',
							'recurring.instance.completed', 'reminder.triggered'
						]
					},
					description: 'Events to subscribe to',
					minItems: 1
				},
				active: {
					type: 'boolean',
					description: 'Whether the webhook is active'
				},
				transformFile: {
					type: 'string',
					description: 'Optional transform file path for payload customization'
				},
				corsHeaders: {
					type: 'boolean',
					description: 'Whether to include custom headers (disable for strict CORS services)'
				}
			},
			required: ['url', 'events']
		},
		PomodoroSession: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'Unique session identifier'
				},
				type: {
					type: 'string',
					enum: ['work', 'short-break', 'long-break'],
					description: 'Type of pomodoro session'
				},
				duration: {
					type: 'integer',
					description: 'Session duration in seconds'
				},
				startTime: {
					type: 'string',
					format: 'date-time',
					description: 'Session start timestamp'
				},
				endTime: {
					type: 'string',
					format: 'date-time',
					description: 'Session end timestamp',
					nullable: true
				},
				task: {
					$ref: '#/components/schemas/Task',
					nullable: true,
					description: 'Associated task (if any)'
				}
			},
			required: ['id', 'type', 'duration', 'startTime']
		},
		PomodoroState: {
			type: 'object',
			properties: {
				isRunning: {
					type: 'boolean',
					description: 'Whether a pomodoro session is currently running'
				},
				timeRemaining: {
					type: 'integer',
					description: 'Time remaining in current session (seconds)'
				},
				currentSession: {
					$ref: '#/components/schemas/PomodoroSession',
					nullable: true,
					description: 'Current active session (if any)'
				},
				nextSessionType: {
					type: 'string',
					enum: ['work', 'short-break', 'long-break'],
					nullable: true,
					description: 'Suggested next session type'
				},
				totalPomodoros: {
					type: 'integer',
					description: 'Total completed pomodoros (all time)'
				},
				currentStreak: {
					type: 'integer',
					description: 'Current consecutive pomodoro streak'
				},
				totalMinutesToday: {
					type: 'integer',
					description: 'Total focused minutes today'
				}
			},
			required: ['isRunning', 'timeRemaining']
		},
		PomodoroSessionHistory: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'Session identifier'
				},
				type: {
					type: 'string',
					enum: ['work', 'short-break', 'long-break']
				},
				startTime: {
					type: 'string',
					format: 'date-time'
				},
				endTime: {
					type: 'string',
					format: 'date-time'
				},
				duration: {
					type: 'integer',
					description: 'Actual session duration in seconds'
				},
				completed: {
					type: 'boolean',
					description: 'Whether the session was completed (not interrupted)'
				},
				taskPath: {
					type: 'string',
					nullable: true,
					description: 'Associated task file path'
				},
				taskTitle: {
					type: 'string',
					nullable: true,
					description: 'Associated task title'
				}
			},
			required: ['id', 'type', 'startTime', 'endTime', 'duration', 'completed']
		},
		PomodoroStats: {
			type: 'object',
			properties: {
				totalSessions: {
					type: 'integer',
					description: 'Total number of sessions'
				},
				completedSessions: {
					type: 'integer',
					description: 'Number of completed sessions'
				},
				interruptedSessions: {
					type: 'integer',
					description: 'Number of interrupted sessions'
				},
				totalFocusTime: {
					type: 'integer',
					description: 'Total focused time in minutes'
				},
				workSessions: {
					type: 'integer',
					description: 'Number of work sessions'
				},
				breakSessions: {
					type: 'integer',
					description: 'Number of break sessions'
				},
				longestStreak: {
					type: 'integer',
					description: 'Longest consecutive completed sessions'
				},
				averageSessionLength: {
					type: 'number',
					description: 'Average session length in minutes'
				}
			},
			required: ['totalSessions', 'completedSessions', 'interruptedSessions', 'totalFocusTime']
		},
		Error: {
			type: 'object',
			properties: {
				success: {
					type: 'boolean',
					enum: [false]
				},
				error: {
					type: 'string',
					description: 'Error message describing what went wrong'
				}
			},
			required: ['success', 'error']
		}
	};
}

/**
 * Get OpenAPI operation metadata from a method
 */
export function getOpenAPIOperation(target: any, propertyKey: string): OpenAPIOperation | undefined {
	return Reflect.getMetadata(OPENAPI_OPERATION_KEY, target, propertyKey);
}

/**
 * Check if a class has OpenAPI endpoints
 */
export function hasOpenAPIEndpoints(target: any): boolean {
	const endpoints: OpenAPIEndpoint[] = Reflect.getMetadata(OPENAPI_ENDPOINTS_KEY, target) || [];
	return endpoints.length > 0;
}