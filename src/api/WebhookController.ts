import { IncomingMessage, ServerResponse } from 'http';
import { BaseController } from './BaseController';
import { WebhookConfig, WebhookDelivery, WebhookEvent, WebhookPayload } from '../types';
import { createHash, createHmac } from 'crypto';
import TaskNotesPlugin from '../main';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Get, Post, Delete } from '../utils/OpenAPIDecorators';

export class WebhookController extends BaseController {
	private webhooks: Map<string, WebhookConfig> = new Map();
	private webhookDeliveryQueue: WebhookDelivery[] = [];

	constructor(private plugin: TaskNotesPlugin) {
		super();
		this.loadWebhooks();
	}

	@Post('/api/webhooks')
	async registerWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);
			
			if (!body.url || typeof body.url !== 'string') {
				this.sendResponse(res, 400, this.errorResponse('URL is required and must be a string'));
				return;
			}
			
			if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
				this.sendResponse(res, 400, this.errorResponse('Events array is required and must not be empty'));
				return;
			}
			
			// Generate webhook ID and secret if not provided
			const id = body.id || this.generateWebhookId();
			const secret = body.secret || this.generateWebhookSecret();
			
			const webhook: WebhookConfig = {
				id,
				url: body.url,
				events: body.events,
				secret,
				active: body.active !== false,
				createdAt: new Date().toISOString(),
				failureCount: 0,
				successCount: 0,
				transformFile: body.transformFile || undefined,
				corsHeaders: body.corsHeaders !== false // Default to true unless explicitly set to false
			};
			
			this.webhooks.set(id, webhook);
			await this.saveWebhooks();
			
			this.sendResponse(res, 201, this.successResponse({
				webhook,
				message: 'Webhook registered successfully. Save the secret for signature validation.'
			}));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Get('/api/webhooks')
	async listWebhooks(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const webhooks = Array.from(this.webhooks.values()).map(webhook => ({
				...webhook,
				secret: undefined // Don't expose secrets in list
			}));
			
			this.sendResponse(res, 200, this.successResponse({
				webhooks,
				total: webhooks.length
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Delete('/api/webhooks/:id')
	async deleteWebhook(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
		try {
			const webhookId = params?.id;
			if (!webhookId) {
				this.sendResponse(res, 400, this.errorResponse('Webhook ID is required'));
				return;
			}
			
			if (!this.webhooks.has(webhookId)) {
				this.sendResponse(res, 404, this.errorResponse('Webhook not found'));
				return;
			}
			
			this.webhooks.delete(webhookId);
			await this.saveWebhooks();
			
			this.sendResponse(res, 200, this.successResponse({
				message: 'Webhook deleted successfully'
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get('/api/webhooks/deliveries')
	async getWebhookDeliveries(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			// Return recent deliveries from queue
			const deliveries = this.webhookDeliveryQueue.slice(-100); // Last 100 deliveries
			
			this.sendResponse(res, 200, this.successResponse({
				deliveries,
				total: deliveries.length
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	async triggerWebhook(event: WebhookEvent, data: any): Promise<void> {
		// Fire and forget - don't block the main operation
		setImmediate(() => {
			this.processWebhookTrigger(event, data).catch(error => {
				console.error('Webhook processing error:', error);
			});
		});
	}

	private async processWebhookTrigger(event: WebhookEvent, data: any): Promise<void> {
		const relevantWebhooks = Array.from(this.webhooks.values())
			.filter(webhook => webhook.active && webhook.events.includes(event));
		
		if (relevantWebhooks.length === 0) {
			return;
		}
		
		const adapter = this.plugin.app.vault.adapter as any;
		let vaultPath = null;
		try {
			if ('basePath' in adapter && typeof adapter.basePath === 'string') {
				vaultPath = adapter.basePath;
			} else if ('path' in adapter && typeof adapter.path === 'string') {
				vaultPath = adapter.path;
			}
		} catch (error) {
			// Silently fail if vault path isn't accessible
		}
		
		const basePayload: WebhookPayload = {
			event,
			timestamp: new Date().toISOString(),
			vault: {
				name: this.plugin.app.vault.getName(),
				path: vaultPath
			},
			data
		};
		
		for (const webhook of relevantWebhooks) {
			// Apply transformation if specified
			let payload = basePayload;
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
				status: 'pending',
				attempts: 0
			};
			
			this.webhookDeliveryQueue.push(delivery);
			
			// Process delivery
			this.deliverWebhook(webhook, delivery);
		}
		
		// Clean up old deliveries (keep last 100)
		if (this.webhookDeliveryQueue.length > 100) {
			this.webhookDeliveryQueue = this.webhookDeliveryQueue.slice(-100);
		}
	}

	private async deliverWebhook(webhook: WebhookConfig, delivery: WebhookDelivery, retryCount = 0): Promise<void> {
		const maxRetries = 3;
		
		try {
			delivery.attempts++;
			delivery.lastAttempt = new Date().toISOString();
			
			const signature = this.generateSignature(delivery.payload, webhook.secret);
			
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			
			// Only add custom headers if corsHeaders is enabled (default true)
			if (webhook.corsHeaders !== false) {
				headers['X-TaskNotes-Event'] = delivery.event;
				headers['X-TaskNotes-Signature'] = signature;
				headers['X-TaskNotes-Delivery-ID'] = delivery.id;
			}
			
			const response = await fetch(webhook.url, {
				method: 'POST',
				headers,
				body: JSON.stringify(delivery.payload),
			});
			
			delivery.responseStatus = response.status;
			
			if (response.ok) {
				delivery.status = 'success';
				webhook.successCount++;
				webhook.lastTriggered = new Date().toISOString();
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (error: any) {
			delivery.error = error.message;
			webhook.failureCount++;
			
			if (retryCount < maxRetries) {
				// Exponential backoff: 1s, 2s, 4s
				const delay = Math.pow(2, retryCount) * 1000;
				setTimeout(() => {
					this.deliverWebhook(webhook, delivery, retryCount + 1);
				}, delay);
			} else {
				delivery.status = 'failed';
				
				// Disable webhook after too many failures
				if (webhook.failureCount > 10) {
					webhook.active = false;
					console.warn(`Webhook ${webhook.id} disabled after ${webhook.failureCount} failures`);
				}
			}
		}
		
		// Save webhook state
		await this.saveWebhooks();
	}

	private generateSignature(payload: any, secret: string): string {
		const hmac = createHmac('sha256', secret);
		hmac.update(JSON.stringify(payload));
		return hmac.digest('hex');
	}

	private generateWebhookId(): string {
		return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	private generateWebhookSecret(): string {
		return createHash('sha256')
			.update(Date.now().toString() + Math.random().toString())
			.digest('hex');
	}

	private generateDeliveryId(): string {
		return `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

	private async applyTransformation(transformFile: string, payload: WebhookPayload): Promise<any> {
		try {
			console.log(`🔧 Applying transformation: ${transformFile}`);

			if (transformFile.endsWith('.js')) {
				return await this.applyJSTransformation(transformFile, payload);
			} else if (transformFile.endsWith('.json')) {
				return await this.applyJSONTransformation(transformFile, payload);
			}

			// Unknown file type, return original payload
			console.warn(`⚠️ Unknown transform file type for ${transformFile}, using original payload`);
			return payload;
		} catch (error) {
			console.error(`❌ Transformation failed for ${transformFile}:`, error);
			throw error;
		}
	}

	private async applyJSTransformation(transformFile: string, payload: WebhookPayload): Promise<any> {
		try {
			console.log(`📂 Reading transform file: ${transformFile}`);

			// Read transformation file from vault
			let transformCode: string;
			try {
				transformCode = await this.plugin.app.vault.adapter.read(transformFile);
				console.log(`✅ Transform file loaded successfully (${transformCode.length} characters)`);
			} catch (readError: any) {
				throw new Error(`Failed to read transform file '${transformFile}': ${readError.message}. Please check the file path and ensure it exists in your vault.`);
			}

			// Validate file has content
			if (!transformCode.trim()) {
				throw new Error(`Transform file '${transformFile}' is empty. Please add a transform function.`);
			}

			// Check for transform function in the code
			if (!transformCode.includes('function transform')) {
				console.warn(`⚠️ Transform file '${transformFile}' may not contain a 'transform' function`);
			}

			console.log(`🔧 Executing transform function for event: ${payload.event}`);

			// Create a safe execution context
			const transform = new Function('payload', `
				${transformCode}
				if (typeof transform === 'function') {
					console.log("🔥 transform file loaded");
					return transform(payload);
				} else {
					throw new Error('Transform file must export a transform function. Expected: function transform(payload) { ... }');
				}
			`);

			const result = transform(payload);
			console.log(`✅ Transform completed successfully for ${transformFile}`);
			return result;
		} catch (error: any) {
			console.error(`❌ JS transformation error for '${transformFile}':`, error.message);
			throw error;
		}
	}

	private async applyJSONTransformation(transformFile: string, payload: WebhookPayload): Promise<any> {
		try {
			console.log(`📂 Reading JSON template file: ${transformFile}`);

			// Read template file from vault
			let templateContent: string;
			try {
				templateContent = await this.plugin.app.vault.adapter.read(transformFile);
				console.log(`✅ JSON template file loaded successfully (${templateContent.length} characters)`);
			} catch (readError: any) {
				throw new Error(`Failed to read template file '${transformFile}': ${readError.message}. Please check the file path and ensure it exists in your vault.`);
			}

			// Validate file has content
			if (!templateContent.trim()) {
				throw new Error(`Template file '${transformFile}' is empty. Please add JSON template content.`);
			}

			// Parse JSON template
			let templates: any;
			try {
				templates = JSON.parse(templateContent);
			} catch (parseError: any) {
				throw new Error(`Invalid JSON in template file '${transformFile}': ${parseError.message}`);
			}

			console.log(`🔧 Applying JSON template for event: ${payload.event}`);

			// Get template for this event or use default
			const template = templates[payload.event] || templates.default;
			if (!template) {
				const availableEvents = Object.keys(templates).filter(key => key !== 'default');
				throw new Error(`No template found for event '${payload.event}' and no default template. Available templates: ${availableEvents.join(', ')}`);
			}

			// Apply template variable substitution
			const result = this.interpolateTemplate(template, payload);
			console.log(`✅ JSON template applied successfully for ${transformFile}`);
			return result;
		} catch (error: any) {
			console.error(`❌ JSON transformation error for '${transformFile}':`, error.message);
			throw error;
		}
	}

	private interpolateTemplate(template: any, payload: any): any {
		if (typeof template === 'string') {
			return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
				return this.getNestedValue(payload, path) || match;
			});
		} else if (Array.isArray(template)) {
			return template.map(item => this.interpolateTemplate(item, payload));
		} else if (template && typeof template === 'object') {
			const result: any = {};
			for (const [key, value] of Object.entries(template)) {
				result[key] = this.interpolateTemplate(value, payload);
			}
			return result;
		} else {
			return template;
		}
	}

	private getNestedValue(obj: any, path: string): any {
		return path.split('.').reduce((current, key) => {
			return current && current[key] !== undefined ? current[key] : undefined;
		}, obj);
	}
}