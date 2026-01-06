import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { BaseController } from "./BaseController";
import TaskNotesPlugin from "../main";
import { OAuthService } from "../services/OAuthService";
import { ICSSubscriptionService } from "../services/ICSSubscriptionService";
import { CalendarProviderRegistry } from "../services/CalendarProvider";
import { OAuthProvider, ICSEvent } from "../types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Get } from "../utils/OpenAPIDecorators";

export class CalendarsController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private oauthService: OAuthService,
		private icsSubscriptionService: ICSSubscriptionService,
		private calendarProviderRegistry: CalendarProviderRegistry
	) {
		super();
	}

	@Get("/api/calendars")
	async getCalendars(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const providers = await this.getProvidersOverview();
			const subscriptions = this.icsSubscriptionService.getSubscriptions();

			this.sendResponse(
				res,
				200,
				this.successResponse({
					providers,
					subscriptions: {
						total: subscriptions.length,
						enabled: subscriptions.filter((s) => s.enabled).length,
					},
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/google")
	async getGoogleCalendars(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const data = await this.getProviderDetails("google");
			this.sendResponse(res, 200, this.successResponse(data));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/microsoft")
	async getMicrosoftCalendars(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const data = await this.getProviderDetails("microsoft");
			this.sendResponse(res, 200, this.successResponse(data));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/subscriptions")
	async getSubscriptions(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const subscriptions = this.icsSubscriptionService.getSubscriptions();

			const subscriptionsWithStatus = subscriptions.map((sub) => ({
				...sub,
				lastFetched: this.icsSubscriptionService.getLastFetched(sub.id) || null,
				lastError: this.icsSubscriptionService.getLastError(sub.id) || null,
			}));

			this.sendResponse(
				res,
				200,
				this.successResponse({
					subscriptions: subscriptionsWithStatus,
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/events")
	async getEvents(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || "", true);
			const params = parsedUrl.query;

			// Parse optional date range filters
			const startDate = params.start ? new Date(params.start as string) : null;
			const endDate = params.end ? new Date(params.end as string) : null;

			// Collect events from all sources
			const allEvents: (ICSEvent & { provider: string })[] = [];
			const sources: Record<string, number> = {};

			// Get events from OAuth providers (Google, Microsoft)
			const providerEvents = this.calendarProviderRegistry.getAllEvents();
			for (const event of providerEvents) {
				const provider = this.getProviderFromSubscriptionId(event.subscriptionId);
				if (this.isEventInRange(event, startDate, endDate)) {
					allEvents.push({ ...event, provider });
					sources[provider] = (sources[provider] || 0) + 1;
				}
			}

			// Get events from ICS subscriptions
			const icsEvents = this.icsSubscriptionService.getAllEvents();
			for (const event of icsEvents) {
				if (this.isEventInRange(event, startDate, endDate)) {
					allEvents.push({ ...event, provider: "ics" });
					sources["ics"] = (sources["ics"] || 0) + 1;
				}
			}

			// Sort events by start time
			allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

			this.sendResponse(
				res,
				200,
				this.successResponse({
					events: allEvents,
					total: allEvents.length,
					sources,
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private async getProvidersOverview(): Promise<any[]> {
		const providers: any[] = [];

		// Google Calendar
		const googleConnected = await this.oauthService.isConnected("google");
		const googleConnection = googleConnected
			? await this.oauthService.getConnection("google")
			: null;
		const googleCalendars = this.plugin.googleCalendarService?.getAvailableCalendars() || [];

		providers.push({
			id: "google",
			name: "Google Calendar",
			connected: googleConnected,
			...(googleConnected && {
				email: googleConnection?.userEmail,
				calendarCount: googleCalendars.length,
			}),
		});

		// Microsoft Calendar
		const microsoftConnected = await this.oauthService.isConnected("microsoft");
		const microsoftConnection = microsoftConnected
			? await this.oauthService.getConnection("microsoft")
			: null;
		const microsoftCalendars =
			this.plugin.microsoftCalendarService?.getAvailableCalendars() || [];

		providers.push({
			id: "microsoft",
			name: "Microsoft Calendar",
			connected: microsoftConnected,
			...(microsoftConnected && {
				email: microsoftConnection?.userEmail,
				calendarCount: microsoftCalendars.length,
			}),
		});

		return providers;
	}

	private async getProviderDetails(provider: OAuthProvider): Promise<any> {
		const connected = await this.oauthService.isConnected(provider);
		const connection = connected ? await this.oauthService.getConnection(provider) : null;

		if (!connected) {
			return { connected: false };
		}

		const calendarService =
			provider === "google"
				? this.plugin.googleCalendarService
				: this.plugin.microsoftCalendarService;

		const calendars = calendarService?.getAvailableCalendars() || [];

		return {
			connected: true,
			email: connection?.userEmail,
			connectedAt: connection?.connectedAt,
			calendars,
		};
	}

	private getProviderFromSubscriptionId(subscriptionId: string): string {
		if (subscriptionId.startsWith("google-")) {
			return "google";
		}
		if (subscriptionId.startsWith("microsoft-")) {
			return "microsoft";
		}
		return "unknown";
	}

	private isEventInRange(
		event: ICSEvent,
		startDate: Date | null,
		endDate: Date | null
	): boolean {
		if (!startDate && !endDate) {
			return true;
		}

		const eventStart = new Date(event.start);
		const eventEnd = event.end ? new Date(event.end) : eventStart;

		if (startDate && eventEnd < startDate) {
			return false;
		}
		if (endDate && eventStart > endDate) {
			return false;
		}

		return true;
	}
}
