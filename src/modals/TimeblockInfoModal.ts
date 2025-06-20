import { App, Modal } from 'obsidian';

export interface TimeBlock {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    attachments?: string[];
    id?: string;
}

/**
 * Modal for displaying timeblock information
 */
export class TimeblockInfoModal extends Modal {
    private timeblock: TimeBlock;
    private eventDate: Date;

    constructor(app: App, timeblock: TimeBlock, eventDate: Date) {
        super(app);
        this.timeblock = timeblock;
        this.eventDate = eventDate;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Timeblock Details' });
        
        const content = contentEl.createDiv();
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '12px';
        
        // Timeblock title
        const titleSection = content.createDiv();
        titleSection.createEl('strong', { text: 'Title: ' });
        titleSection.createSpan({ text: this.timeblock.title });
        
        // Date and time
        const dateSection = content.createDiv();
        dateSection.createEl('strong', { text: 'Time: ' });
        const dateText = `${this.eventDate.toLocaleDateString()} from ${this.timeblock.startTime} to ${this.timeblock.endTime}`;
        dateSection.createSpan({ text: dateText });
        
        // Description
        if (this.timeblock.description) {
            const descSection = content.createDiv();
            descSection.createEl('strong', { text: 'Description: ' });
            const descEl = descSection.createDiv();
            descEl.style.marginTop = '4px';
            descEl.style.fontStyle = 'italic';
            descEl.textContent = this.timeblock.description;
        }
        
        // Attachments
        if (this.timeblock.attachments && this.timeblock.attachments.length > 0) {
            const attachmentsSection = content.createDiv();
            attachmentsSection.createEl('strong', { text: 'Attachments: ' });
            
            const attachmentsList = attachmentsSection.createDiv();
            attachmentsList.style.marginTop = '4px';
            
            this.timeblock.attachments.forEach(attachment => {
                const attachmentItem = attachmentsList.createDiv();
                attachmentItem.style.marginLeft = '16px';
                attachmentItem.style.fontSize = '0.9em';
                attachmentItem.textContent = `• ${attachment}`;
            });
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
        window.setTimeout(() => closeButton.focus(), 50);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}