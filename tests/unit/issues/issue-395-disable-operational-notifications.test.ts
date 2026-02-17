/**
 * Tracking tests for issue #395: Add ability to disable operational notices.
 *
 * These remain TODO until a shared operational-notice helper and setting
 * (`enableOperationalNotices`) are implemented in production code.
 */

describe("Issue #395: Disable operational notifications", () => {
	it.todo("adds enableOperationalNotices to settings with default true");
	it.todo("suppresses info/success operational notices when enableOperationalNotices is false");
	it.todo("still shows error notices when enableOperationalNotices is false");
	it.todo("routes direct Notice usages through the shared operational-notice helper");
});
