import { App, Modal, Setting } from 'obsidian';
import { getTranslate } from '../i18n';

export interface TextInputModalOptions {
    title: string;
    placeholder?: string;
    initialValue?: string;
    confirmText?: string;
    cancelText?: string;
}

/**
 * Generic text input modal
 */
export class TextInputModal extends Modal {
    private options: TextInputModalOptions;
    private resolve: (value: string | null) => void;
    private inputEl: HTMLInputElement;

    constructor(app: App, options: TextInputModalOptions) {
        super(app);
        const translate = getTranslate();
        this.options = {
            confirmText: translate('common.confirm'),
            cancelText: translate('common.cancel'),
            ...options
        };
    }

    public show(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        new Setting(contentEl)
            .setName(this.options.title)
            .setHeading();

        new Setting(contentEl)
            .addText(text => {
                this.inputEl = text.inputEl;
                text.setPlaceholder(this.options.placeholder || '')
                    .setValue(this.options.initialValue || '')
                    .onChange(() => {
                        // Optional: real-time validation could go here
                    });
                
                // Focus the input
                setTimeout(() => {
                    this.inputEl.focus();
                    this.inputEl.select();
                }, 100);
            });

        const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const cancelButton = buttonContainer.createEl('button', { text: this.options.cancelText });
        cancelButton.addEventListener('click', () => {
            this.resolve(null);
            this.close();
        });

        const confirmButton = buttonContainer.createEl('button', { 
            text: this.options.confirmText,
            cls: 'mod-cta'
        });
        
        confirmButton.addEventListener('click', () => {
            const value = this.inputEl.value.trim();
            this.resolve(value || null);
            this.close();
        });

        // Handle Enter key
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmButton.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelButton.click();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        // Ensure promise is resolved even if modal is closed without selection
        if (this.resolve) {
            this.resolve(null);
        }
    }
}

/**
 * Utility function to show text input modal
 */
export async function showTextInputModal(app: App, options: TextInputModalOptions): Promise<string | null> {
    const modal = new TextInputModal(app, options);
    return modal.show();
}