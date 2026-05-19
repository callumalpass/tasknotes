export const EVENT_USER_NOTICE = "user-notice";

export interface UserNoticePayload {
	message: string;
	timeout?: number;
}

export interface UserNoticeEmitter {
	trigger(eventName: typeof EVENT_USER_NOTICE, payload: UserNoticePayload): void;
}

export function publishUserNotice(
	emitter: UserNoticeEmitter | undefined,
	message: string,
	timeout?: number
): void {
	emitter?.trigger(EVENT_USER_NOTICE, { message, timeout });
}
