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
		codeContainer.createDiv({
			text: this.translate("modals.deviceCode.codeLabel"),
			cls: "tasknotes-device-code-label",
		});

		const codeBox = codeContainer.createDiv({ cls: "tasknotes-device-code-box" });
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
		const timerText = timerContainer.createSpan({
			text: this.getTimeRemaining(),
			cls: "tasknotes-device-code-timer-text",
		});

		// Update countdown every second
		this.countdownInterval = window.setInterval(() => {
			const remaining = this.getTimeRemaining();
			timerText.setText(remaining);

			// Close modal if expired
			if (this.expiresAt <= Date.now()) {
				this.close();
			}
		}, 1000);

		// Status indicator
		const statusContainer = contentEl.createDiv({ cls: "tasknotes-device-code-status" });
		const statusIcon = statusContainer.createSpan({ cls: "tasknotes-device-code-status-icon" });
		setIcon(statusIcon, "loader");
		statusIcon.addClass("tasknotes-device-code-spinner");
		statusContainer.createSpan({
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

	}

	onClose(): void {
		if (this.countdownInterval) {
			window.clearInterval(this.countdownInterval);
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
