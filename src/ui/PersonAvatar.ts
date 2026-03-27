/**
 * PersonAvatar - Circular avatar with initials for person/group display
 *
 * Features:
 * - Extracts initials from name (up to 2 characters)
 * - Generates consistent color from name hash
 * - Supports different sizes (small, medium, large)
 * - Optional group indicator (folder icon overlay)
 */

/**
 * Avatar size options
 */
export type AvatarSize = "xs" | "sm" | "md" | "lg";

/**
 * Configuration for creating an avatar
 */
export interface AvatarConfig {
	/** Display name to extract initials from */
	name: string;
	/** Size of the avatar */
	size?: AvatarSize;
	/** Whether this is a group (shows folder indicator) */
	isGroup?: boolean;
	/** Optional custom color (overrides auto-generated) */
	color?: string;
	/** Optional tooltip text */
	tooltip?: string;
}

/**
 * Color palette for avatars - carefully chosen for readability
 * These work well with white text on both light and dark themes
 */
const AVATAR_COLORS = [
	"#6366f1", // indigo
	"#8b5cf6", // violet
	"#a855f7", // purple
	"#d946ef", // fuchsia
	"#ec4899", // pink
	"#f43f5e", // rose
	"#ef4444", // red
	"#f97316", // orange
	"#f59e0b", // amber
	"#84cc16", // lime
	"#22c55e", // green
	"#14b8a6", // teal
	"#06b6d4", // cyan
	"#0ea5e9", // sky
	"#3b82f6", // blue
];

/**
 * Size configurations in pixels
 */
const SIZE_CONFIG: Record<AvatarSize, { size: number; fontSize: number }> = {
	xs: { size: 20, fontSize: 10 },
	sm: { size: 24, fontSize: 11 },
	md: { size: 32, fontSize: 13 },
	lg: { size: 40, fontSize: 16 },
};

/**
 * Extract initials from a name.
 * - "John Doe" → "JD"
 * - "Alice" → "A"
 * - "Bob Smith Jr" → "BS"
 * - "" → "?"
 */
export function extractInitials(name: string): string {
	if (!name || name.trim() === "") {
		return "?";
	}

	const words = name.trim().split(/\s+/).filter(w => w.length > 0);

	if (words.length === 0) {
		return "?";
	}

	if (words.length === 1) {
		// Single word - take first 1-2 characters
		return words[0].substring(0, 2).toUpperCase();
	}

	// Multiple words - take first letter of first two words
	return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Generate a consistent color from a string.
 * Same name always produces same color.
 */
export function getColorFromName(name: string): string {
	if (!name) return AVATAR_COLORS[0];

	// Simple hash function
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		const char = name.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}

	// Map to color palette
	const index = Math.abs(hash) % AVATAR_COLORS.length;
	return AVATAR_COLORS[index];
}

/**
 * Create an avatar element.
 * Returns an HTMLElement that can be appended to any container.
 */
export function createAvatar(config: AvatarConfig): HTMLElement {
	const {
		name,
		size = "md",
		isGroup = false,
		color,
		tooltip,
	} = config;

	const sizeConfig = SIZE_CONFIG[size];
	const initials = extractInitials(name);
	const bgColor = color || getColorFromName(name);

	// Create container
	const avatar = document.createElement("div");
	avatar.className = `tn-avatar tn-avatar--${size}`;
	if (isGroup) {
		avatar.classList.add("tn-avatar--group");
	}

	// Apply styles
	avatar.style.width = `${sizeConfig.size}px`;
	avatar.style.height = `${sizeConfig.size}px`;
	avatar.style.backgroundColor = bgColor;
	avatar.style.fontSize = `${sizeConfig.fontSize}px`;

	// Set initials
	avatar.textContent = initials;

	// Tooltip
	if (tooltip) {
		avatar.title = tooltip;
	} else {
		avatar.title = name;
	}

	// Group indicator (small folder icon in corner)
	if (isGroup) {
		const indicator = document.createElement("div");
		indicator.className = "tn-avatar__group-indicator";
		indicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>`;
		avatar.appendChild(indicator);
	}

	return avatar;
}

/**
 * Create a row with avatar and name for list displays.
 * Useful for dropdowns, suggestion lists, etc.
 */
export function createAvatarRow(config: AvatarConfig & { subtitle?: string }): HTMLElement {
	const { name, subtitle, ...avatarConfig } = config;

	const row = document.createElement("div");
	row.className = "tn-avatar-row";

	// Avatar
	const avatar = createAvatar({ name, ...avatarConfig, size: avatarConfig.size || "sm" });
	row.appendChild(avatar);

	// Text container
	const textContainer = document.createElement("div");
	textContainer.className = "tn-avatar-row__text";

	const nameEl = document.createElement("div");
	nameEl.className = "tn-avatar-row__name";
	nameEl.textContent = name;
	textContainer.appendChild(nameEl);

	if (subtitle) {
		const subtitleEl = document.createElement("div");
		subtitleEl.className = "tn-avatar-row__subtitle";
		subtitleEl.textContent = subtitle;
		textContainer.appendChild(subtitleEl);
	}

	row.appendChild(textContainer);

	return row;
}

/**
 * Create a stack of avatars (for showing multiple assignees).
 * Avatars overlap slightly.
 */
export function createAvatarStack(
	names: string[],
	options: { size?: AvatarSize; maxShow?: number; isGroup?: boolean[] } = {}
): HTMLElement {
	const { size = "sm", maxShow = 3, isGroup = [] } = options;

	const stack = document.createElement("div");
	stack.className = "tn-avatar-stack";

	const toShow = names.slice(0, maxShow);
	const overflow = names.length - maxShow;

	toShow.forEach((name, i) => {
		const avatar = createAvatar({
			name,
			size,
			isGroup: isGroup[i] || false,
		});
		avatar.style.zIndex = String(toShow.length - i);
		stack.appendChild(avatar);
	});

	// Overflow indicator
	if (overflow > 0) {
		const overflowEl = document.createElement("div");
		overflowEl.className = `tn-avatar tn-avatar--${size} tn-avatar--overflow`;
		overflowEl.textContent = `+${overflow}`;
		overflowEl.title = `${overflow} more`;
		stack.appendChild(overflowEl);
	}

	return stack;
}
