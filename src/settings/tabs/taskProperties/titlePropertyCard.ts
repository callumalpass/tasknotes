import { setIcon } from "obsidian";
import TaskNotesPlugin from "../../../main";
import {
	createCard,
	createCardInput,
	createCardSelect,
	createCardToggle,
	CardRow,
} from "../../components/CardComponent";
import { createPropertyDescription, TranslateFn } from "./helpers";

/**
 * Renders the Title property card with filename settings
 */
export function renderTitlePropertyCard(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	// Create a wrapper for the card so we can re-render it
	const cardWrapper = container.createDiv();
	// Track collapse state across re-renders
	let isCollapsed = true;

	function renderCard(): void {
		cardWrapper.empty();

		const propertyKeyInput = createCardInput(
			"text",
			"title",
			plugin.settings.fieldMapping.title
		);

		propertyKeyInput.addEventListener("change", () => {
			plugin.settings.fieldMapping.title = propertyKeyInput.value;
			save();
		});

		// Store title in filename toggle
		const storeTitleToggle = createCardToggle(
			plugin.settings.storeTitleInFilename,
			(value) => {
				plugin.settings.storeTitleInFilename = value;
				save();
				// Re-render the entire card to show/hide property key
				renderCard();
			}
		);

		// Create nested content for filename settings
		const nestedContainer = document.createElement("div");
		nestedContainer.addClass("tasknotes-settings__nested-content");
		renderFilenameSettingsContent(nestedContainer, plugin, save, translate);

		// Create description element
		const descriptionEl = createPropertyDescription(
			translate("settings.taskProperties.properties.title.description")
		);

		const rows: CardRow[] = [
			{ label: "", input: descriptionEl, fullWidth: true },
		];

		// Only show property key when NOT storing title in filename
		if (!plugin.settings.storeTitleInFilename) {
			rows.push({
				label: translate("settings.taskProperties.propertyCard.propertyKey"),
				input: propertyKeyInput,
			});
		}

		rows.push(
			{ label: translate("settings.taskProperties.titleCard.storeTitleInFilename"), input: storeTitleToggle },
			{ label: "", input: nestedContainer, fullWidth: true }
		);

		createCard(cardWrapper, {
			id: "property-title",
			collapsible: true,
			defaultCollapsed: isCollapsed,
			onCollapseChange: (collapsed) => {
				isCollapsed = collapsed;
			},
			header: {
				primaryText: translate("settings.taskProperties.properties.title.name"),
				secondaryText: plugin.settings.storeTitleInFilename
					? translate("settings.taskProperties.titleCard.storedInFilename")
					: plugin.settings.fieldMapping.title,
			},
			content: {
				sections: [{ rows }],
			},
		});
	}

	renderCard();
}

/**
 * Renders the filename settings content inside the title card
 */
function renderFilenameSettingsContent(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void,
	translate: TranslateFn
): void {
	container.empty();

	// ═══════════════════════════════════════════════════════════════════════════
	// COMPREHENSIVE PREVIEW SECTION
	// Shows property key + filename examples (normal & collision)
	// ═══════════════════════════════════════════════════════════════════════════
	const previewSection = container.createDiv();
	previewSection.style.marginBottom = "1.5em";
	previewSection.style.padding = "12px 16px";
	previewSection.style.background = "var(--background-secondary)";
	previewSection.style.borderRadius = "8px";
	previewSection.style.border = "1px solid var(--background-modifier-border)";

	// Header
	const previewHeader = previewSection.createDiv();
	previewHeader.style.display = "flex";
	previewHeader.style.alignItems = "center";
	previewHeader.style.gap = "8px";
	previewHeader.style.marginBottom = "12px";

	const iconEl = previewHeader.createSpan();
	setIcon(iconEl, "eye");
	iconEl.style.color = "var(--text-muted)";

	previewHeader.createSpan({
		text: "Preview",
		cls: "setting-item-name",
	});

	// Generate example values based on current settings
	const exampleTitle = "Weekly Review";
	const today = new Date();
	const timePart = "a1b2c"; // Example time component
	const timestamp = today.getTime().toString(36).slice(-8);

	// Example dates for template preview
	const exampleDueDate = "2028-07-15";
	const exampleScheduledDate = "2026-03-10";
	const exampleCreatedDate = today.toISOString().slice(0, 10);
	const exampleRandom = "k3f";
	const exampleRandomLong = "x7m2p9";
	const exampleMilliseconds = today.getMilliseconds().toString().padStart(3, "0");

	// Get user-configured property names
	const fieldMapping = plugin.settings.fieldMapping;
	const titlePropName = fieldMapping.title || "title";
	const duePropName = fieldMapping.due || "due";
	const scheduledPropName = fieldMapping.scheduled || "scheduled";

	// Determine zettel date based on fallback chain
	function getZettelDateInfo(): { date: string; source: "due" | "scheduled" | "creation"; yymmdd: string } {
		const chain = plugin.settings.zettelDateChain || ["creation"];

		for (const source of chain) {
			if (source === "due") {
				// Due date is set in our example
				const d = new Date(exampleDueDate);
				const yymmdd = d.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
				return { date: exampleDueDate, source: "due", yymmdd };
			} else if (source === "scheduled") {
				const d = new Date(exampleScheduledDate);
				const yymmdd = d.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
				return { date: exampleScheduledDate, source: "scheduled", yymmdd };
			} else if (source === "creation") {
				const d = new Date(exampleCreatedDate);
				const yymmdd = d.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
				return { date: exampleCreatedDate, source: "creation", yymmdd };
			}
		}

		// Fallback to creation
		const d = new Date(exampleCreatedDate);
		const yymmdd = d.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
		return { date: exampleCreatedDate, source: "creation", yymmdd };
	}

	const zettelInfo = getZettelDateInfo();

	// Determine filename based on format
	// IMPORTANT: When storeTitleInFilename is ON, format is always "title" regardless of setting
	function getExampleFilename(): string {
		// If storing title in filename, the filename IS the title
		if (plugin.settings.storeTitleInFilename) {
			return `${exampleTitle}.md`;
		}

		const format = plugin.settings.taskFilenameFormat;
		const template = plugin.settings.customFilenameTemplate || "{{title}}";

		switch (format) {
			case "title":
				return `${exampleTitle}.md`;
			case "zettel":
				return `${zettelInfo.yymmdd}${timePart}.md`;
			case "zettel-title":
				return `${zettelInfo.yymmdd}${timePart}-${exampleTitle}.md`;
			case "timestamp":
				return `${timestamp}.md`;
			case "custom":
				// Comprehensive template variable replacement
				let result = template
					// Title variations
					.replace(/\{\{title\}\}/gi, exampleTitle)
					.replace(/\{title\}/gi, exampleTitle)
					// Zettel variations (use chain-determined date)
					.replace(/\{\{zettel\}\}/gi, `${zettelInfo.yymmdd}${timePart}`)
					.replace(/\{zettel\}/gi, `${zettelInfo.yymmdd}${timePart}`)
					// Timestamp variations
					.replace(/\{\{timestamp\}\}/gi, timestamp)
					.replace(/\{timestamp\}/gi, timestamp)
					// Date fields
					.replace(/\{\{dueDate\}\}/gi, exampleDueDate)
					.replace(/\{dueDate\}/gi, exampleDueDate)
					.replace(/\{\{due\}\}/gi, exampleDueDate)
					.replace(/\{due\}/gi, exampleDueDate)
					.replace(/\{\{scheduledDate\}\}/gi, exampleScheduledDate)
					.replace(/\{scheduledDate\}/gi, exampleScheduledDate)
					.replace(/\{\{scheduled\}\}/gi, exampleScheduledDate)
					.replace(/\{scheduled\}/gi, exampleScheduledDate)
					.replace(/\{\{createdDate\}\}/gi, exampleCreatedDate)
					.replace(/\{createdDate\}/gi, exampleCreatedDate)
					.replace(/\{\{created\}\}/gi, exampleCreatedDate)
					.replace(/\{created\}/gi, exampleCreatedDate)
					// Random/unique suffixes
					.replace(/\{\{random\}\}/gi, exampleRandom)
					.replace(/\{random\}/gi, exampleRandom)
					.replace(/\{\{randomLong\}\}/gi, exampleRandomLong)
					.replace(/\{randomLong\}/gi, exampleRandomLong)
					// Milliseconds
					.replace(/\{\{milliseconds\}\}/gi, exampleMilliseconds)
					.replace(/\{milliseconds\}/gi, exampleMilliseconds)
					.replace(/\{\{millisecondsPadded\}\}/gi, exampleMilliseconds)
					.replace(/\{millisecondsPadded\}/gi, exampleMilliseconds);

				// Add .md if not already present
				if (!result.endsWith(".md")) {
					result += ".md";
				}
				return result;
			default:
				return `${exampleTitle}.md`;
		}
	}

	// Determine collision suffix
	function getCollisionSuffix(): string {
		const suffix = plugin.settings.collisionRetrySuffix || "timestamp";
		switch (suffix) {
			case "timestamp":
				return `-${timestamp.slice(-6)}`;
			case "random":
				return "-k3f";
			case "zettel":
				return `-${zettelInfo.yymmdd}${timePart}`;
			default:
				return `-${timestamp.slice(-6)}`;
		}
	}

	// Build collision filename
	function getCollisionFilename(): string {
		const base = getExampleFilename();
		const suffix = getCollisionSuffix();
		// Insert suffix before .md
		return base.replace(/\.md$/, `${suffix}.md`);
	}

	// Check if zettel format is used (affects whether we show chain indicator)
	const usesZettel = !plugin.settings.storeTitleInFilename && (
		plugin.settings.taskFilenameFormat === "zettel" ||
		plugin.settings.taskFilenameFormat === "zettel-title" ||
		(plugin.settings.taskFilenameFormat === "custom" &&
			(plugin.settings.customFilenameTemplate || "").toLowerCase().includes("zettel")) ||
		plugin.settings.collisionRetrySuffix === "zettel"
	);

	// Preview content grid
	const previewGrid = previewSection.createDiv();
	previewGrid.style.display = "grid";
	previewGrid.style.gridTemplateColumns = "auto 1fr";
	previewGrid.style.gap = "6px 16px";
	previewGrid.style.alignItems = "start";
	previewGrid.style.fontFamily = "var(--font-monospace)";
	previewGrid.style.fontSize = "0.85em";

	// Row 1: Frontmatter preview (shows user-configured property names)
	const fmLabel = previewGrid.createDiv({ text: "Frontmatter:" });
	fmLabel.style.color = "var(--text-muted)";
	fmLabel.style.fontFamily = "var(--font-interface)";

	const fmValue = previewGrid.createDiv();
	fmValue.style.display = "flex";
	fmValue.style.flexDirection = "column";
	fmValue.style.gap = "2px";

	// Title property
	const titleLine = fmValue.createDiv();
	titleLine.innerHTML = `<code>${titlePropName}: "${exampleTitle}"</code>`;

	// Due property (highlight if used for zettel)
	const dueLine = fmValue.createDiv();
	const dueIsUsed = usesZettel && zettelInfo.source === "due";
	if (dueIsUsed) {
		dueLine.innerHTML = `<code>${duePropName}: "${exampleDueDate}"</code> <span style="color: var(--text-accent); font-size: 0.85em;">← zettel date</span>`;
	} else {
		dueLine.innerHTML = `<code>${duePropName}: "${exampleDueDate}"</code>`;
	}

	// Scheduled property (highlight if used for zettel)
	const scheduledLine = fmValue.createDiv();
	const scheduledIsUsed = usesZettel && zettelInfo.source === "scheduled";
	if (scheduledIsUsed) {
		scheduledLine.innerHTML = `<code>${scheduledPropName}: "${exampleScheduledDate}"</code> <span style="color: var(--text-accent); font-size: 0.85em;">← zettel date</span>`;
	} else {
		scheduledLine.innerHTML = `<code>${scheduledPropName}: "${exampleScheduledDate}"</code>`;
	}

	// Creation note if that's the zettel source
	if (usesZettel && zettelInfo.source === "creation") {
		const creationLine = fmValue.createDiv();
		creationLine.innerHTML = `<span style="color: var(--text-faint); font-style: italic;">creation: ${exampleCreatedDate}</span> <span style="color: var(--text-accent); font-size: 0.85em;">← zettel date</span>`;
	}

	// Row 2: Filename
	const normalLabel = previewGrid.createDiv({ text: "Filename:" });
	normalLabel.style.color = "var(--text-muted)";
	normalLabel.style.fontFamily = "var(--font-interface)";

	const normalValue = previewGrid.createDiv();
	const normalFilename = getExampleFilename();
	normalValue.innerHTML = `<code style="color: var(--text-success);">${normalFilename}</code>`;

	// Row 3: Collision filename
	const collisionLabel = previewGrid.createDiv({ text: "On collision:" });
	collisionLabel.style.color = "var(--text-muted)";
	collisionLabel.style.fontFamily = "var(--font-interface)";

	const collisionValue = previewGrid.createDiv();
	const collisionFilename = getCollisionFilename();

	// Highlight the suffix part
	const basePart = normalFilename.replace(/\.md$/, "");
	const suffix = getCollisionSuffix();
	collisionValue.innerHTML = `<code>${basePart}<span style="color: var(--text-warning); font-weight: 500;">${suffix}</span>.md</code>`;

	// Behavior note
	const behaviorNote = previewSection.createDiv();
	behaviorNote.style.marginTop = "10px";
	behaviorNote.style.fontSize = "0.8em";
	behaviorNote.style.color = "var(--text-faint)";

	const behavior = plugin.settings.filenameCollisionBehavior || "silent";
	const behaviorText = {
		silent: "Collisions resolved automatically without notification",
		notify: "Collisions resolved automatically with notification",
		ask: "You'll be asked to choose when collision occurs",
	};
	behaviorNote.textContent = behaviorText[behavior];

	// Naming scheme tip (contextual based on current settings)
	if (plugin.settings.storeTitleInFilename) {
		const tipNote = previewSection.createDiv();
		tipNote.style.marginTop = "8px";
		tipNote.style.fontSize = "0.8em";
		tipNote.style.color = "var(--text-accent)";
		tipNote.style.display = "flex";
		tipNote.style.alignItems = "flex-start";
		tipNote.style.gap = "6px";

		const tipIcon = tipNote.createSpan();
		setIcon(tipIcon, "lightbulb");
		tipIcon.style.flexShrink = "0";
		tipIcon.style.marginTop = "1px";

		tipNote.createSpan({
			text: "For collision-proof filenames (zettel, timestamp), turn OFF \"Use title as filename\" above",
		});
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// END PREVIEW SECTION
	// ═══════════════════════════════════════════════════════════════════════════

	// Group 1: Collision behavior
	const collisionGroup = container.createDiv();
	collisionGroup.style.marginBottom = "1em";

	const collisionContainer = collisionGroup.createDiv("tasknotes-settings__card-config-row");
	collisionContainer.createSpan({
		text: "On filename collision",
		cls: "tasknotes-settings__card-config-label",
	});

	const collisionSelect = createCardSelect(
		[
			{ value: "silent", label: "Auto-resolve silently" },
			{ value: "notify", label: "Auto-resolve and notify" },
			{ value: "ask", label: "Always ask me" },
		],
		plugin.settings.filenameCollisionBehavior || "silent"
	);
	collisionSelect.addEventListener("change", () => {
		plugin.settings.filenameCollisionBehavior = collisionSelect.value as "silent" | "notify" | "ask";
		save();
	});
	collisionContainer.appendChild(collisionSelect);

	collisionGroup.createDiv({
		text: "How to handle filename collisions (e.g., when creating 'test' but 'Test.md' exists)",
		cls: "setting-item-description",
	});

	// Group 2: Retry suffix format
	const suffixGroup = container.createDiv();
	suffixGroup.style.marginBottom = "1em";

	const suffixContainer = suffixGroup.createDiv("tasknotes-settings__card-config-row");
	suffixContainer.createSpan({
		text: "Retry suffix format",
		cls: "tasknotes-settings__card-config-label",
	});

	const suffixSelect = createCardSelect(
		[
			{ value: "timestamp", label: "Timestamp (m5abc123)" },
			{ value: "random", label: "Random (k3f)" },
			{ value: "zettel", label: "Zettel ID (260202abc)" },
		],
		plugin.settings.collisionRetrySuffix || "timestamp"
	);
	suffixContainer.appendChild(suffixSelect);

	// Dynamic description that changes based on suffix selection
	const suffixDescEl = suffixGroup.createDiv({
		cls: "setting-item-description",
	});

	function updateSuffixDescription(): void {
		const isZettel = suffixSelect.value === "zettel";
		if (isZettel) {
			suffixDescEl.innerHTML = `What to append when retrying after collision. <strong style="color: var(--text-accent);">Uses date fallback chain below ↓</strong>`;
		} else {
			suffixDescEl.textContent = "What to append when retrying after collision";
		}
	}

	suffixSelect.addEventListener("change", () => {
		plugin.settings.collisionRetrySuffix = suffixSelect.value as "timestamp" | "random" | "zettel";
		save();
		// Re-render to update both suffix description AND chain description (which shows connection)
		renderFilenameSettingsContent(container, plugin, save, translate);
	});

	updateSuffixDescription();

	// Group 3: Zettel date source chain
	const dateSourceGroup = container.createDiv();
	dateSourceGroup.style.marginBottom = "1em";

	const dateSourceLabel = dateSourceGroup.createDiv("tasknotes-settings__card-config-row");
	dateSourceLabel.createSpan({
		text: "Zettel ID date fallback chain",
		cls: "tasknotes-settings__card-config-label",
	});

	// Initialize chain from settings (migrate from legacy if needed)
	let chain: ("due" | "scheduled" | "creation")[] = plugin.settings.zettelDateChain || [];
	if (chain.length === 0) {
		// Migrate from legacy setting
		chain = plugin.settings.zettelDateSource === "due"
			? ["due", "scheduled", "creation"]
			: ["creation"];
	}

	// Create the visual chain container
	const chainContainer = dateSourceGroup.createDiv();
	chainContainer.style.display = "flex";
	chainContainer.style.alignItems = "center";
	chainContainer.style.gap = "4px";
	chainContainer.style.flexWrap = "wrap";
	chainContainer.style.marginTop = "8px";
	chainContainer.style.marginBottom = "8px";

	const chainOptions: { key: "due" | "scheduled" | "creation"; label: string }[] = [
		{ key: "due", label: "Due" },
		{ key: "scheduled", label: "Scheduled" },
		{ key: "creation", label: "Creation" },
	];

	// Preview element showing example output
	const previewEl = dateSourceGroup.createDiv();
	previewEl.style.marginTop = "8px";
	previewEl.style.padding = "8px 12px";
	previewEl.style.background = "var(--background-secondary)";
	previewEl.style.borderRadius = "4px";
	previewEl.style.fontFamily = "var(--font-monospace)";
	previewEl.style.fontSize = "0.9em";

	// Description element
	const descEl = dateSourceGroup.createDiv({
		cls: "setting-item-description",
	});
	descEl.style.marginTop = "8px";

	function generateExampleZettel(dateStr: string): string {
		// Parse date and generate example zettel ID
		const [year, month, day] = dateStr.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		const datePart = date.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
		// Use a fixed time for consistent preview
		const timePart = "a1b2c"; // Example time component
		return `${datePart}${timePart}`;
	}

	function updatePreview(): void {
		previewEl.empty();

		// Example dates for demonstration
		const exampleDue = "2028-07-15";
		const exampleScheduled = "2026-03-10";
		const today = new Date();
		const exampleCreation = today.toISOString().slice(0, 10);

		// Build preview based on chain
		const previewHeader = previewEl.createDiv();
		previewHeader.style.marginBottom = "6px";
		previewHeader.style.color = "var(--text-muted)";
		previewHeader.style.fontSize = "0.85em";
		previewHeader.textContent = "Preview (example dates):";

		const previewContent = previewEl.createDiv();
		previewContent.style.display = "flex";
		previewContent.style.flexDirection = "column";
		previewContent.style.gap = "4px";

		// Show what happens with different scenarios
		const scenarios = [
			{
				label: "Task with due date",
				due: exampleDue,
				scheduled: exampleScheduled
			},
			{
				label: "Task with scheduled only",
				due: null,
				scheduled: exampleScheduled
			},
			{
				label: "Task with no dates",
				due: null,
				scheduled: null
			},
		];

		// Helper to format date nicely
		const formatDateNice = (dateStr: string): string => {
			const [year, month, day] = dateStr.split("-").map(Number);
			const date = new Date(year, month - 1, day);
			return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
		};

		scenarios.forEach(scenario => {
			// Determine which date would be used based on chain
			let usedDate: string | null = null;
			let usedSource = "";

			for (const source of chain) {
				if (source === "due" && scenario.due) {
					usedDate = scenario.due;
					usedSource = "due";
					break;
				} else if (source === "scheduled" && scenario.scheduled) {
					usedDate = scenario.scheduled;
					usedSource = "scheduled";
					break;
				} else if (source === "creation") {
					usedDate = exampleCreation;
					usedSource = "creation";
					break;
				}
			}

			if (!usedDate) {
				usedDate = exampleCreation;
				usedSource = "creation";
			}

			const zettelId = generateExampleZettel(usedDate);
			const dateNice = formatDateNice(usedDate);

			const row = previewContent.createDiv();
			row.style.display = "flex";
			row.style.justifyContent = "space-between";
			row.style.alignItems = "center";
			row.style.flexWrap = "wrap";
			row.style.gap = "4px";

			const labelSpan = row.createSpan({ text: scenario.label });
			labelSpan.style.color = "var(--text-muted)";
			labelSpan.style.fontSize = "0.85em";
			labelSpan.style.minWidth = "140px";

			const resultSpan = row.createSpan();
			resultSpan.innerHTML = `<code>${zettelId}</code> <span style="color: var(--text-faint); font-size: 0.8em;">← ${dateNice} (${usedSource})</span>`;
		});
	}

	function updateDescription(): void {
		const activeSteps = chainOptions.filter(o => chain.includes(o.key)).map(o => o.label.toLowerCase());
		const isZettelSuffix = plugin.settings.collisionRetrySuffix === "zettel";
		const usedByNote = isZettelSuffix ? " Also used by retry suffix above ↑" : "";

		if (activeSteps.length === 1) {
			descEl.innerHTML = `Uses ${activeSteps[0]} date for zettel YYMMDD.${usedByNote ? `<strong style="color: var(--text-accent);">${usedByNote}</strong>` : ""}`;
		} else {
			const steps = activeSteps.join(" → ");
			descEl.innerHTML = `Tries ${steps} in order.${usedByNote ? `<strong style="color: var(--text-accent);">${usedByNote}</strong>` : ""}`;
		}
		updatePreview();
	}

	function renderChain(): void {
		chainContainer.empty();

		chainOptions.forEach((option, index) => {
			const isActive = chain.includes(option.key);
			const isLast = option.key === "creation";

			// Create button
			const btn = chainContainer.createEl("button", {
				text: option.label,
				cls: `tn-chain-btn ${isActive ? "tn-chain-btn--active" : "tn-chain-btn--inactive"}`,
			});
			btn.style.padding = "4px 12px";
			btn.style.borderRadius = "4px";
			btn.style.border = "1px solid var(--background-modifier-border)";
			btn.style.cursor = isLast ? "not-allowed" : "pointer";
			btn.style.transition = "all 0.15s ease";

			if (isActive) {
				btn.style.background = "var(--interactive-accent)";
				btn.style.color = "var(--text-on-accent)";
			} else {
				btn.style.background = "var(--background-secondary)";
				btn.style.color = "var(--text-muted)";
				btn.style.opacity = "0.6";
			}

			if (!isLast) {
				btn.addEventListener("click", () => {
					if (isActive) {
						// Remove from chain (but keep at least creation)
						chain = chain.filter(k => k !== option.key);
						if (chain.length === 0) chain = ["creation"];
					} else {
						// Add to chain in correct order
						const newChain: ("due" | "scheduled" | "creation")[] = [];
						chainOptions.forEach(opt => {
							if (opt.key === option.key || chain.includes(opt.key)) {
								newChain.push(opt.key);
							}
						});
						chain = newChain;
					}
					plugin.settings.zettelDateChain = chain;
					// Also update legacy setting for backwards compatibility
					plugin.settings.zettelDateSource = chain[0] === "creation" ? "creation" : "due";
					save();
					// Re-render entire content to update top preview + chain preview
					renderFilenameSettingsContent(container, plugin, save, translate);
				});

				btn.addEventListener("mouseenter", () => {
					if (!isActive) btn.style.opacity = "0.8";
				});
				btn.addEventListener("mouseleave", () => {
					if (!isActive) btn.style.opacity = "0.6";
				});
			} else {
				btn.title = "Creation date is always the final fallback";
			}

			// Add arrow between buttons (except after last)
			if (index < chainOptions.length - 1) {
				const arrow = chainContainer.createSpan({ text: "→" });
				arrow.style.color = "var(--text-muted)";
				arrow.style.fontSize = "1.2em";
				arrow.style.margin = "0 2px";

				// Dim arrow if the next item is not active
				const nextOption = chainOptions[index + 1];
				const currentActive = chain.includes(option.key);
				const nextActive = chain.includes(nextOption.key);
				if (!currentActive || !nextActive) {
					arrow.style.opacity = "0.3";
				}
			}
		});
	}

	// Initial render
	renderChain();
	updateDescription();

	// Only show filename format settings when storeTitleInFilename is off
	if (plugin.settings.storeTitleInFilename) {
		container.createDiv({
			text: translate("settings.taskProperties.titleCard.filenameUpdatesWithTitle"),
			cls: "setting-item-description",
		});
		return;
	}

	// Filename format dropdown
	const formatContainer = container.createDiv("tasknotes-settings__card-config-row");
	formatContainer.createSpan({
		text: translate("settings.taskProperties.titleCard.filenameFormat"),
		cls: "tasknotes-settings__card-config-label",
	});

	const formatSelect = createCardSelect(
		[
			{ value: "title", label: translate("settings.appearance.taskFilenames.filenameFormat.options.title") },
			{ value: "zettel", label: translate("settings.appearance.taskFilenames.filenameFormat.options.zettel") },
			{ value: "zettel-title", label: "Zettel + title (260202abc-My Task)" },
			{ value: "timestamp", label: translate("settings.appearance.taskFilenames.filenameFormat.options.timestamp") },
			{ value: "custom", label: translate("settings.appearance.taskFilenames.filenameFormat.options.custom") },
		],
		plugin.settings.taskFilenameFormat
	);
	formatSelect.addEventListener("change", () => {
		plugin.settings.taskFilenameFormat = formatSelect.value as "title" | "zettel" | "zettel-title" | "timestamp" | "custom";
		save();
		renderFilenameSettingsContent(container, plugin, save, translate);
	});
	formatContainer.appendChild(formatSelect);

	// Custom template input (shown only when format is custom)
	if (plugin.settings.taskFilenameFormat === "custom") {
		const templateContainer = container.createDiv("tasknotes-settings__card-config-row");
		templateContainer.createSpan({
			text: translate("settings.taskProperties.titleCard.customTemplate"),
			cls: "tasknotes-settings__card-config-label",
		});

		const templateInput = createCardInput(
			"text",
			translate("settings.appearance.taskFilenames.customTemplate.placeholder"),
			plugin.settings.customFilenameTemplate
		);
		templateInput.style.width = "100%";

		// Warning container for legacy syntax
		const warningContainer = container.createDiv();

		const updateWarning = () => {
			warningContainer.empty();
			// Check for single-brace syntax that isn't part of double-brace
			// Match {word} but not {{word}}
			// Avoid lookbehind for iOS compatibility (iOS < 16.4 doesn't support lookbehind)
			const template = templateInput.value;
			// First check if there are any single braces at all
			const singleBracePattern = /\{[a-zA-Z]+\}/g;
			const doubleBracePattern = /\{\{[a-zA-Z]+\}\}/g;
			// Remove all double-brace patterns, then check for remaining single-brace
			const withoutDoubleBraces = template.replace(doubleBracePattern, "");
			const hasLegacySyntax = singleBracePattern.test(withoutDoubleBraces);

			if (hasLegacySyntax) {
				const warningEl = warningContainer.createDiv({
					cls: "setting-item-description mod-warning",
				});
				warningEl.style.color = "var(--text-warning)";
				warningEl.style.marginTop = "8px";
				warningEl.style.display = "flex";
				warningEl.style.alignItems = "flex-start";
				warningEl.style.gap = "6px";

				const iconEl = warningEl.createSpan();
				setIcon(iconEl, "alert-triangle");
				iconEl.style.flexShrink = "0";

				const textEl = warningEl.createSpan();
				textEl.textContent = translate("settings.taskProperties.titleCard.legacySyntaxWarning");
			}
		};

		templateInput.addEventListener("change", () => {
			plugin.settings.customFilenameTemplate = templateInput.value;
			save();
			updateWarning();
		});
		templateInput.addEventListener("input", updateWarning);
		// Re-render on blur to update the preview at the top
		templateInput.addEventListener("blur", () => {
			// Only re-render if value actually changed (avoid unnecessary re-renders)
			if (templateInput.value !== plugin.settings.customFilenameTemplate) {
				plugin.settings.customFilenameTemplate = templateInput.value;
				save();
			}
			// Always re-render to update preview
			renderFilenameSettingsContent(container, plugin, save, translate);
		});
		templateContainer.appendChild(templateInput);

		// Expandable section for supported template variables
		const variablesSection = container.createDiv();
		variablesSection.style.marginTop = "12px";

		const detailsEl = variablesSection.createEl("details");
		detailsEl.style.fontSize = "0.85em";
		detailsEl.style.color = "var(--text-muted)";

		const summaryEl = detailsEl.createEl("summary");
		summaryEl.style.cursor = "pointer";
		summaryEl.style.userSelect = "none";
		summaryEl.style.display = "flex";
		summaryEl.style.alignItems = "center";
		summaryEl.style.gap = "6px";

		const summaryIcon = summaryEl.createSpan();
		setIcon(summaryIcon, "code-2");
		summaryIcon.style.flexShrink = "0";

		summaryEl.createSpan({ text: "Supported template variables" });

		// Link to docs
		const docsLink = summaryEl.createEl("a", {
			text: "(docs)",
			href: "https://github.com/cybersader/tasknotes/blob/main/docs/filename-templates.md",
		});
		docsLink.style.marginLeft = "auto";
		docsLink.style.fontSize = "0.9em";
		docsLink.addEventListener("click", (e) => {
			e.preventDefault();
			window.open(docsLink.href, "_blank");
		});

		// Variables table
		const tableWrapper = detailsEl.createDiv();
		tableWrapper.style.marginTop = "8px";
		tableWrapper.style.padding = "8px 12px";
		tableWrapper.style.background = "var(--background-secondary)";
		tableWrapper.style.borderRadius = "4px";
		tableWrapper.style.fontFamily = "var(--font-monospace)";
		tableWrapper.style.fontSize = "0.9em";

		const variables = [
			{ name: "{{title}}", desc: "Task title", example: "Weekly Review" },
			{ name: "{{zettel}}", desc: "Zettel ID (YYMMDD + time)", example: "260202a1b2c" },
			{ name: "{{timestamp}}", desc: "Unix timestamp (base36)", example: "m5abc123" },
			{ name: "{{dueDate}}", desc: "Due date (YYYY-MM-DD)", example: "2028-07-15" },
			{ name: "{{scheduledDate}}", desc: "Scheduled date", example: "2026-03-10" },
			{ name: "{{createdDate}}", desc: "Creation date", example: "2026-02-02" },
			{ name: "{{random}}", desc: "Random suffix (3 chars)", example: "k3f" },
			{ name: "{{randomLong}}", desc: "Random suffix (6 chars)", example: "x7m2p9" },
			{ name: "{{milliseconds}}", desc: "Milliseconds (000-999)", example: "042" },
		];

		const table = tableWrapper.createEl("table");
		table.style.width = "100%";
		table.style.borderCollapse = "collapse";

		variables.forEach(v => {
			const row = table.createEl("tr");

			const nameCell = row.createEl("td", { text: v.name });
			nameCell.style.padding = "4px 8px 4px 0";
			nameCell.style.color = "var(--text-accent)";
			nameCell.style.whiteSpace = "nowrap";

			const descCell = row.createEl("td", { text: v.desc });
			descCell.style.padding = "4px 8px";
			descCell.style.color = "var(--text-muted)";

			const exampleCell = row.createEl("td", { text: v.example });
			exampleCell.style.padding = "4px 0 4px 8px";
			exampleCell.style.color = "var(--text-faint)";
			exampleCell.style.fontStyle = "italic";
			exampleCell.style.textAlign = "right";
		});

		// Aliases note
		const aliasNote = tableWrapper.createDiv();
		aliasNote.style.marginTop = "8px";
		aliasNote.style.fontSize = "0.85em";
		aliasNote.style.color = "var(--text-faint)";
		aliasNote.textContent = "Aliases: {{due}}, {{scheduled}}, {{created}} also work. Single-brace {title} syntax supported for backwards compatibility.";

		// Initial warning check
		updateWarning();
	}
}
