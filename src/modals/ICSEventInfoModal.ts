import { App, Modal, Setting } from 'obsidian';

export interface ICSEvent {
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    description?: string;
    location?: string;
    url?: string;
}

/**
 * Modal for displaying ICS event information
 */
export class ICSEventInfoModal extends Modal {
    private icsEvent: ICSEvent;
    private subscriptionName?: string;

    constructor(app: App, icsEvent: ICSEvent, subscriptionName?: string) {
        super(app);
        this.icsEvent = icsEvent;
        this.subscriptionName = subscriptionName;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        new Setting(contentEl)
            .setName('Calendar event details')
            .setHeading();
        
        const content = contentEl.createDiv();
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '12px';
        
        // Event title
        const titleSection = content.createDiv();
        titleSection.createEl('strong', { text: 'Title: ' });
        titleSection.createSpan({ text: this.icsEvent.title || 'Untitled Event' });
        
        // Subscription source
        if (this.subscriptionName) {
            const sourceSection = content.createDiv();
            sourceSection.createEl('strong', { text: 'Source: ' });
            sourceSection.createSpan({ text: this.subscriptionName });
        }
        
        // Date/time
        const dateSection = content.createDiv();
        dateSection.createEl('strong', { text: 'Date: ' });
        const startDate = new Date(this.icsEvent.start);
        let dateText = startDate.toLocaleDateString();
        if (!this.icsEvent.allDay) {
            dateText += ` at ${startDate.toLocaleTimeString()}`;
            
            if (this.icsEvent.end) {
                const endDate = new Date(this.icsEvent.end);
                dateText += ` - ${endDate.toLocaleTimeString()}`;
            }
        }
        dateSection.createSpan({ text: dateText });
        
        // Description
        if (this.icsEvent.description) {
            const descSection = content.createDiv();
            descSection.createEl('strong', { text: 'Description: ' });
            const descEl = descSection.createDiv();
            descEl.style.marginTop = '4px';
            descEl.style.fontStyle = 'italic';
            descEl.textContent = this.icsEvent.description;
        }
        
        // Location
        if (this.icsEvent.location) {
            const locationSection = content.createDiv();
            locationSection.createEl('strong', { text: 'Location: ' });
            locationSection.createSpan({ text: this.icsEvent.location });
        }
        
        // URL
        if (this.icsEvent.url) {
            const urlSection = content.createDiv();
            urlSection.createEl('strong', { text: 'URL: ' });
            const urlLink = urlSection.createEl('a', { 
                text: this.icsEvent.url,
                href: this.icsEvent.url
            });
            urlLink.style.color = 'var(--interactive-accent)';
            urlLink.target = '_blank';
        }

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const closeButton = buttonContainer.createEl('button', { text: 'Close' });
        closeButton.addEventListener('click', () => {
            this.close();
        });

        // Focus the close button
        setTimeout(() => closeButton.focus(), 50);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
