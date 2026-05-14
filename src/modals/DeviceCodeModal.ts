import { Modal, App, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { TranslationKey } from "../i18n";

interface DeviceCodeInfo {
	userCode: string;
	verificationUrl: string;
	verificationUrlComplete?: string;
	expiresIn: number;
}

/**
 * Modal that displays the OAuth Device Flow code and instructions
 */
export class DeviceCodeModal extends Modal {
	private plugin: TaskNotesPlugin;
	private deviceCode: DeviceCodeInfo;
	private onCancel: () => void;
	private countdownInterval?: number;
	private expiresAt: number;
	private translate: (key: TranslationKey, variables?: Record<string, unknown>) => string;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		deviceCode: DeviceCodeInfo,
		onCancel: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.deviceCode = deviceCode;
		this.onCancel = onCancel;
		this.expiresAt = Date.now() + deviceCode.expiresIn * 1000;
		this.translate = plugin.i18n.translate.bind(plugin.i18n);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-device-code-modal");

		// Header
		const header = contentEl.createDiv({ cls: "tasknotes-device-code-header" });
		const headerIcon = header.createSpan({ cls: "tasknotes-device-code-icon" });
		setIcon(headerIcon, "shield-check");
		header.createEl("h2", {
			text: this.translate("modals.deviceCode.title"),
			cls: "tasknotes-device-code-title",
		});

		// Instructions
		const instructions = contentEl.createDiv({ cls: "tasknotes-device-code-instructions" });
		instructions.createEl("p", {
			text: this.translate("modals.deviceCode.instructions.intro"),
		});

		// Steps
		const stepsList = instructions.createEl("ol", { cls: "tasknotes-device-code-steps" });

		const step1 = stepsList.createEl("li");
		step1.createSpan({ text: this.translate("modals.deviceCode.steps.open") + " " });
		const linkSpan = step1.createEl("a", {
			text: this.deviceCode.verificationUrl,
			href: this.deviceCode.verificationUrl,
			cls: "tasknotes-device-code-link",
		});
		linkSpan.setAttribute("target", "_blank");
		step1.createSpan({ text: " " + this.translate("modals.deviceCode.steps.inBrowser") });

		const step2 = stepsList.createEl("li");
		step2.createSpan({ text: this.translate("modals.deviceCode.steps.enterCode") });

		const step3 = stepsList.createEl("li");
		step3.createSpan({ text: this.translate("modals.deviceCode.steps.signIn") });

		const step4 = stepsList.createEl("li");
		step4.createSpan({ text: this.translate("modals.deviceCode.steps.returnToObsidian") });

		// Code display
		const codeContainer = contentEl.createDiv({ cls: "tasknotes-device-code-container" });
		codeContainer.createEl("div", {
			text: this.translate("modals.deviceCode.codeLabel"),
			cls: "tasknotes-device-code-label",
		});

		const codeBox = codeContainer.createEl("div", { cls: "tasknotes-device-code-box" });
		codeBox.createEl("code", {
			text: this.formatUserCode(this.deviceCode.userCode),
			cls: "tasknotes-device-code-text",
		});

		const copyIcon = codeBox.createEl("button", {
			cls: "tasknotes-device-code-copy",
			attr: { "aria-label": this.translate("modals.deviceCode.copyCodeAriaLabel") },
		});
		setIcon(copyIcon, "copy");
		copyIcon.addEventListener("click", () => {
			void navigator.clipboard.writeText(this.deviceCode.userCode);
			copyIcon.empty();
			setIcon(copyIcon, "check");
			window.setTimeout(() => {
				copyIcon.empty();
				setIcon(copyIcon, "copy");
			}, 2000);
		});

		// Countdown timer
		const timerContainer = contentEl.createDiv({ cls: "tasknotes-device-code-timer" });
		const timerIcon = timerContainer.createSpan({ cls: "tasknotes-device-code-timer-icon" });
		setIcon(timerIcon, "clock");
		const timerText = timerContainer.createEl("span", {
			text: this.getTimeRemaining(),
			cls: "tasknotes-device-code-timer-text",
		});

		const updateCountdown = () => {
			const remaining = this.getTimeRemaining();
			timerText.setText(remaining);

			// Close modal if expired
			if (this.expiresAt <= Date.now()) {
				this.close();
				return;
			}

			this.countdownInterval = window.setTimeout(updateCountdown, 1000);
		};

		this.countdownInterval = window.setTimeout(updateCountdown, 1000);

		// Status indicator
		const statusContainer = contentEl.createDiv({ cls: "tasknotes-device-code-status" });
		const statusIcon = statusContainer.createSpan({ cls: "tasknotes-device-code-status-icon" });
		setIcon(statusIcon, "loader");
		statusIcon.addClass("tasknotes-device-code-spinner");
		statusContainer.createEl("span", {
			text: this.translate("modals.deviceCode.waitingForAuthorization"),
			cls: "tasknotes-device-code-status-text",
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "tasknotes-device-code-buttons" });

		// Open browser button
		const openButton = buttonContainer.createEl("button", {
			text: this.translate("modals.deviceCode.openBrowserButton"),
			cls: "mod-cta",
		});
		const openIcon = openButton.createSpan({ cls: "tasknotes-device-code-button-icon" });
		setIcon(openIcon, "external-link");
		openButton.addEventListener("click", () => {
			// Use complete URL if available (includes code pre-filled)
			const url = this.deviceCode.verificationUrlComplete || this.deviceCode.verificationUrl;
			window.open(url, "_blank");
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl("button", {
			text: this.translate("modals.deviceCode.cancelButton"),
			cls: "tasknotes-device-code-cancel",
		});
		const cancelIcon = cancelButton.createSpan({ cls: "tasknotes-device-code-button-icon" });
		setIcon(cancelIcon, "x");
		cancelButton.addEventListener("click", () => {
			this.onCancel();
			this.close();
		});

		// Add some helpful CSS for spinner animation
		if (!activeDocument.getElementById("tasknotes-device-code-styles")) {
			const style = activeDocument.createElement("style");
			style.id = "tasknotes-device-code-styles";
			style.textContent = `
				.tasknotes-device-code-modal {
					padding: 20px;
				}

				.tasknotes-device-code-header {
					display: flex;
					align-items: center;
					gap: 12px;
					margin-bottom: 20px;
					padding-bottom: 16px;
					border-bottom: 1px solid var(--background-modifier-border);
				}

				.tasknotes-device-code-icon {
					width: 24px;
					height: 24px;
					color: var(--interactive-accent);
				}

				.tasknotes-device-code-title {
					margin: 0;
					font-size: 1.25em;
					font-weight: 600;
				}

				.tasknotes-device-code-instructions {
					margin-bottom: 20px;
				}

				.tasknotes-device-code-steps {
					margin: 12px 0;
					padding-left: 20px;
				}

				.tasknotes-device-code-steps li {
					margin: 8px 0;
					line-height: 1.6;
				}

				.tasknotes-device-code-link {
					color: var(--interactive-accent);
					text-decoration: none;
					font-weight: 500;
				}

				.tasknotes-device-code-link:hover {
					text-decoration: underline;
				}

				.tasknotes-device-code-container {
					margin: 20px 0;
					padding: 16px;
					background: var(--background-secondary);
					border-radius: 8px;
					border: 1px solid var(--background-modifier-border);
				}

				.tasknotes-device-code-label {
					font-size: 0.9em;
					color: var(--text-muted);
					margin-bottom: 8px;
					font-weight: 500;
				}

				.tasknotes-device-code-box {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 12px;
					background: var(--background-primary);
					border-radius: 6px;
					border: 1px solid var(--background-modifier-border);
				}

				.tasknotes-device-code-text {
					flex: 1;
					font-family: var(--font-monospace);
					font-size: 1.5em;
					font-weight: 600;
					letter-spacing: 0.1em;
					color: var(--text-normal);
					text-align: center;
				}

				.tasknotes-device-code-copy {
					padding: 8px;
					background: var(--interactive-accent);
					border: none;
					border-radius: 4px;
					cursor: pointer;
					color: var(--text-on-accent);
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.tasknotes-device-code-copy:hover {
					background: var(--interactive-accent-hover);
				}

				.tasknotes-device-code-timer {
					display: flex;
					align-items: center;
					gap: 8px;
					margin: 16px 0;
					padding: 12px;
					background: var(--background-secondary);
					border-radius: 6px;
					border: 1px solid var(--background-modifier-border);
				}

				.tasknotes-device-code-timer-icon {
					width: 16px;
					height: 16px;
					color: var(--text-muted);
				}

				.tasknotes-device-code-timer-text {
					font-size: 0.9em;
					color: var(--text-muted);
				}

				.tasknotes-device-code-status {
					display: flex;
					align-items: center;
					gap: 12px;
					margin: 16px 0;
					padding: 12px;
					background: var(--background-primary-alt);
					border-radius: 6px;
					border: 1px solid var(--interactive-accent);
				}

				.tasknotes-device-code-status-icon {
					width: 20px;
					height: 20px;
					color: var(--interactive-accent);
				}

				.tasknotes-device-code-spinner {
					animation: spin 1s linear infinite;
				}

				@keyframes spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}

				.tasknotes-device-code-status-text {
					color: var(--text-muted);
					font-weight: 500;
				}

				.tasknotes-device-code-buttons {
					display: flex;
					gap: 12px;
					margin-top: 20px;
					justify-content: flex-end;
				}

				.tasknotes-device-code-buttons button {
					display: flex;
					align-items: center;
					gap: 6px;
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
					font-weight: 500;
				}

				.tasknotes-device-code-cancel {
					background: var(--background-modifier-border);
					border: 1px solid var(--background-modifier-border);
					color: var(--text-normal);
				}

				.tasknotes-device-code-cancel:hover {
					background: var(--background-modifier-border-hover);
				}

				.tasknotes-device-code-button-icon {
					width: 16px;
					height: 16px;
				}
			`;
			activeDocument.head.appendChild(style);
		}
	}

	onClose(): void {
		if (this.countdownInterval) {
			window.clearTimeout(this.countdownInterval);
		}
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Formats user code with dashes for readability
	 * e.g., "ABCDEFGH" -> "ABCD-EFGH"
	 */
	private formatUserCode(code: string): string {
		// If code already has dashes, return as-is
		if (code.includes("-")) {
			return code;
		}

		// Insert dash in middle for codes without formatting
		const mid = Math.floor(code.length / 2);
		return code.slice(0, mid) + "-" + code.slice(mid);
	}

	/**
	 * Gets human-readable time remaining
	 */
	private getTimeRemaining(): string {
		const remaining = Math.max(0, this.expiresAt - Date.now());
		const minutes = Math.floor(remaining / 60000);
		const seconds = Math.floor((remaining % 60000) / 1000);

		if (minutes > 0) {
			return this.translate("modals.deviceCode.expiresMinutesSeconds", { minutes, seconds });
		} else {
			return this.translate("modals.deviceCode.expiresSeconds", { seconds });
		}
	}
}
