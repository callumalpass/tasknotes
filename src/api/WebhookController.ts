import type { HTTPRequestLike, HTTPResponseLike } from "./httpTypes";
import { requestUrl } from "obsidian";
import { BaseController } from "./BaseController";
import { WebhookConfig, WebhookDelivery, WebhookEvent, WebhookPayload } from "../types";
import TaskNotesPlugin from "../main";

import { Get, Post, Delete } from "../utils/OpenAPIDecorators";

const WEBHOOK_EVENTS = new Set<WebhookEvent>([
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
	"recurring.instance.skipped",
	"reminder.triggered",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWebhookEvent(value: unknown): value is WebhookEvent {
	return typeof value === "string" && WEBHOOK_EVENTS.has(value as WebhookEvent);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

export class WebhookController extends BaseController {
	private webhooks: Map<string, WebhookConfig> = new Map();
	private webhookDeliveryQueue: WebhookDelivery[] = [];

	constructor(private plugin: TaskNotesPlugin) {
		super();
		this.loadWebhooks();
	}

	@Post("/api/webhooks")
	async registerWebhook(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);
			const requestBody = isRecord(body) ? body : {};

			if (typeof requestBody.url !== "string") {
				this.sendResponse(
					res,
					400,
					this.errorResponse("URL is required and must be a string")
				);
				return;
			}

			if (
				!Array.isArray(requestBody.events) ||
				requestBody.events.length === 0 ||
				!requestBody.events.every(isWebhookEvent)
			) {
				this.sendResponse(
					res,
					400,
					this.errorResponse(
						"Events array is required and must contain valid webhook events"
					)
				);
				return;
			}

			// Generate webhook ID and secret if not provided
			const id = optionalString(requestBody.id) ?? this.generateWebhookId();
			const secret = optionalString(requestBody.secret) ?? this.generateWebhookSecret();

			const webhook: WebhookConfig = {
				id,
				url: requestBody.url,
				events: requestBody.events,
				secret,
				active: requestBody.active !== false,
				createdAt: new Date().toISOString(),
				failureCount: 0,
				successCount: 0,
				transformFile: optionalString(requestBody.transformFile),
				corsHeaders: requestBody.corsHeaders !== false, // Default to true unless explicitly set to false
			};

			this.webhooks.set(id, webhook);
			await this.saveWebhooks();

			this.sendResponse(
				res,
				201,
				this.successResponse({
					webhook,
					message:
						"Webhook registered successfully. Save the secret for signature validation.",
				})
			);
		} catch (error) {
			this.sendResponse(res, 400, this.errorResponse(getErrorMessage(error)));
		}
	}

	@Get("/api/webhooks")
	async listWebhooks(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const webhooks = Array.from(this.webhooks.values()).map((webhook) => ({
				...webhook,
				secret: undefined, // Don't expose secrets in list
			}));

			this.sendResponse(
				res,
				200,
				this.successResponse({
					webhooks,
					total: webhooks.length,
				})
			);
		} catch (error) {
			this.sendResponse(res, 500, this.errorResponse(getErrorMessage(error)));
		}
	}

	@Delete("/api/webhooks/:id")
	async deleteWebhook(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const webhookId = params?.id;
			if (!webhookId) {
				this.sendResponse(res, 400, this.errorResponse("Webhook ID is required"));
				return;
			}

			if (!this.webhooks.has(webhookId)) {
				this.sendResponse(res, 404, this.errorResponse("Webhook not found"));
				return;
			}

			this.webhooks.delete(webhookId);
			await this.saveWebhooks();

			this.sendResponse(
				res,
				200,
				this.successResponse({
					message: "Webhook deleted successfully",
				})
			);
		} catch (error) {
			this.sendResponse(res, 500, this.errorResponse(getErrorMessage(error)));
		}
	}

	@Get("/api/webhooks/deliveries")
	async getWebhookDeliveries(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			// Return recent deliveries from queue
			const deliveries = this.webhookDeliveryQueue.slice(-100); // Last 100 deliveries

			this.sendResponse(
				res,
				200,
				this.successResponse({
					deliveries,
					total: deliveries.length,
				})
			);
		} catch (error) {
			this.sendResponse(res, 500, this.errorResponse(getErrorMessage(error)));
		}
	}

	async triggerWebhook(event: WebhookEvent, data: unknown): Promise<void> {
		// Fire and forget - don't block the main operation
		setImmediate(() => {
			this.processWebhookTrigger(event, data).catch((error) => {
				console.error("Webhook processing error:", error);
			});
		});
	}

	private async processWebhookTrigger(event: WebhookEvent, data: unknown): Promise<void> {
		const relevantWebhooks = Array.from(this.webhooks.values()).filter(
			(webhook) => webhook.active && webhook.events.includes(event)
		);

		if (relevantWebhooks.length === 0) {
			return;
		}

		const adapter = this.plugin.app.vault.adapter as {
			basePath?: unknown;
			path?: unknown;
		};
		let vaultPath: string | undefined;
		try {
			if ("basePath" in adapter && typeof adapter.basePath === "string") {
				vaultPath = adapter.basePath;
			} else if ("path" in adapter && typeof adapter.path === "string") {
				vaultPath = adapter.path;
			}
		} catch {
			// Silently fail if vault path isn't accessible
		}

		const basePayload: WebhookPayload = {
			event,
			timestamp: new Date().toISOString(),
			vault: {
				name: this.plugin.app.vault.getName(),
				path: vaultPath,
			},
			data,
		};

		for (const webhook of relevantWebhooks) {
			// Apply transformation if specified
			let payload: unknown = basePayload;
			if (webhook.transformFile) {
				try {
					payload = await this.applyTransformation(webhook.transformFile, basePayload);
				} catch (error) {
					console.error(`Transform error for ${webhook.transformFile}:`, error);
					// Continue with original payload on error
				}
			}

			const delivery: WebhookDelivery = {
				id: this.generateDeliveryId(),
				webhookId: webhook.id,
				event,
				payload,
				status: "pending",
				attempts: 0,
			};

			this.webhookDeliveryQueue.push(delivery);

			// Process delivery
			void this.deliverWebhook(webhook, delivery);
		}

		// Clean up old deliveries (keep last 100)
		if (this.webhookDeliveryQueue.length > 100) {
			this.webhookDeliveryQueue = this.webhookDeliveryQueue.slice(-100);
		}
	}

	private async deliverWebhook(
		webhook: WebhookConfig,
		delivery: WebhookDelivery,
		retryCount = 0
	): Promise<void> {
		const maxRetries = 3;

		try {
			delivery.attempts++;
			delivery.lastAttempt = new Date().toISOString();

			const signature = await this.generateSignature(delivery.payload, webhook.secret);

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			// Only add custom headers if corsHeaders is enabled (default true)
			if (webhook.corsHeaders !== false) {
				headers["X-TaskNotes-Event"] = delivery.event;
				headers["X-TaskNotes-Signature"] = signature;
				headers["X-TaskNotes-Delivery-ID"] = delivery.id;
			}

			const response = await requestUrl({
				url: webhook.url,
				method: "POST",
				headers,
				body: JSON.stringify(delivery.payload),
				throw: false,
			});

			delivery.responseStatus = response.status;

			if (response.status >= 200 && response.status < 300) {
				delivery.status = "success";
				webhook.successCount++;
				webhook.lastTriggered = new Date().toISOString();
			} else {
				throw new Error(`HTTP ${response.status}: ${response.text}`);
			}
		} catch (error) {
			delivery.error = getErrorMessage(error);
			webhook.failureCount++;

			if (retryCount < maxRetries) {
				// Exponential backoff: 1s, 2s, 4s
				const delay = Math.pow(2, retryCount) * 1000;
				window.setTimeout(() => {
					void this.deliverWebhook(webhook, delivery, retryCount + 1);
				}, delay);
			} else {
				delivery.status = "failed";

				// Disable webhook after too many failures
				if (webhook.failureCount > 10) {
					webhook.active = false;
					console.warn(
						`Webhook ${webhook.id} disabled after ${webhook.failureCount} failures`
					);
				}
			}
		}

		// Save webhook state
		await this.saveWebhooks();
	}

	private async generateSignature(payload: unknown, secret: string): Promise<string> {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"]
		);
		const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
		return this.bytesToHex(new Uint8Array(signature));
	}

	private generateWebhookId(): string {
		return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	private generateWebhookSecret(): string {
		return this.bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
	}

	private generateDeliveryId(): string {
		return `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	private bytesToHex(bytes: Uint8Array): string {
		return Array.from(bytes)
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	}

	private async saveWebhooks(): Promise<void> {
		// Convert Map to array for storage
		const webhooksArray = Array.from(this.webhooks.values());
		this.plugin.settings.webhooks = webhooksArray;
		await this.plugin.saveSettings();
	}

	private loadWebhooks(): void {
		if (this.plugin.settings.webhooks) {
			this.webhooks.clear();
			for (const webhook of this.plugin.settings.webhooks) {
				this.webhooks.set(webhook.id, webhook);
			}
		}
	}

	/**
	 * Reload in-memory webhook state from persisted plugin settings.
	 */
	syncFromSettings(): void {
		this.loadWebhooks();
	}

	private async applyTransformation(
		transformFile: string,
		payload: WebhookPayload
	): Promise<unknown> {
		try {
			if (transformFile.endsWith(".js")) {
				throw new Error(
					"JavaScript webhook transforms are no longer supported. Use a JSON transform template instead."
				);
			} else if (transformFile.endsWith(".json")) {
				return await this.applyJSONTransformation(transformFile, payload);
			}

			// Unknown file type, return original payload
			console.warn(
				`⚠️ Unknown transform file type for ${transformFile}, using original payload`
			);
			return payload;
		} catch (error) {
			console.error(`❌ Transformation failed for ${transformFile}:`, error);
			throw error;
		}
	}

	private async applyJSONTransformation(
		transformFile: string,
		payload: WebhookPayload
	): Promise<unknown> {
		try {
			// Read template file from vault
			let templateContent: string;
			try {
				templateContent = await this.plugin.app.vault.adapter.read(transformFile);
			} catch (readError) {
				throw new Error(
					`Failed to read template file '${transformFile}': ${getErrorMessage(readError)}. Please check the file path and ensure it exists in your vault.`
				);
			}

			// Validate file has content
			if (!templateContent.trim()) {
				throw new Error(
					`Template file '${transformFile}' is empty. Please add JSON template content.`
				);
			}

			// Parse JSON template
			let templates: unknown;
			try {
				templates = JSON.parse(templateContent);
			} catch (parseError) {
				throw new Error(
					`Invalid JSON in template file '${transformFile}': ${getErrorMessage(parseError)}`
				);
			}
			if (!isRecord(templates)) {
				throw new Error(
					`Invalid JSON in template file '${transformFile}': expected an object with event templates`
				);
			}

			// Get template for this event or use default
			const template = templates[payload.event] ?? templates.default;
			if (!template) {
				const availableEvents = Object.keys(templates).filter((key) => key !== "default");
				throw new Error(
					`No template found for event '${payload.event}' and no default template. Available templates: ${availableEvents.join(", ")}`
				);
			}

			// Apply template variable substitution
			const result = this.interpolateTemplate(template, payload);
			return result;
		} catch (error) {
			console.error(
				`❌ JSON transformation error for '${transformFile}':`,
				getErrorMessage(error)
			);
			throw error;
		}
	}

	private interpolateTemplate(template: unknown, payload: WebhookPayload): unknown {
		if (typeof template === "string") {
			return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
				const value = this.getNestedValue(payload, path);
				return value === undefined || value === null
					? match
					: this.formatTemplateValue(value);
			});
		} else if (Array.isArray(template)) {
			return template.map((item) => this.interpolateTemplate(item, payload));
		} else if (isRecord(template)) {
			const result: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(template)) {
				result[key] = this.interpolateTemplate(value, payload);
			}
			return result;
		} else {
			return template;
		}
	}

	private getNestedValue(obj: unknown, path: string): unknown {
		return path.split(".").reduce((current, key) => {
			if (!isRecord(current)) {
				return undefined;
			}

			return current[key] !== undefined ? current[key] : undefined;
		}, obj);
	}

	private formatTemplateValue(value: unknown): string {
		if (typeof value === "string") {
			return value;
		}
		if (
			typeof value === "number" ||
			typeof value === "boolean" ||
			typeof value === "bigint"
		) {
			return String(value);
		}

		const serialized = JSON.stringify(value);
		return serialized ?? "";
	}
}
