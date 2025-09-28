import { setTooltip } from 'obsidian';
import { createListHeaders } from './settingHelpers';

export interface ListEditorItem {
    id: string;
    [key: string]: any;
}

export interface ListEditorConfig<T extends ListEditorItem> {
    container: HTMLElement;
    items: T[];
    headers: string[];
    className?: string;
    onItemsChange: (items: T[]) => void;
    renderItem: (itemContainer: HTMLElement, item: T, index: number, updateItem: (updates: Partial<T>) => void, deleteItem: () => void) => void;
    canDelete?: (item: T) => boolean;
    minItems?: number;
    maxItems?: number;
    dragEnabled?: boolean;
    addButtonText?: string;
    createNewItem: () => T;
}

export class ListEditorComponent<T extends ListEditorItem> {
    private config: ListEditorConfig<T>;
    private container: HTMLElement;
    private listContainer: HTMLElement;

    constructor(config: ListEditorConfig<T>) {
        this.config = config;
        this.container = config.container;
        this.render();
    }

    private render(): void {
        this.container.empty();

        // Create headers
        createListHeaders(this.container, this.config.headers, this.config.className);

        // Create list container
        this.listContainer = this.container.createDiv(`settings-view__list-container ${this.config.className || ''}`.trim());
        
        this.renderItems();
        this.renderAddButton();
    }

    private renderItems(): void {
        this.listContainer.empty();
        
        this.config.items.forEach((item, index) => {
            this.renderItemRow(item, index);
        });
    }

    private renderItemRow(item: T, index: number): void {
        const itemRow = this.listContainer.createDiv('settings-view__item-row');
        itemRow.setAttribute('data-item-id', item.id);

        // Add drag handle if drag is enabled
        if (this.config.dragEnabled !== false) {
            const dragHandle = itemRow.createDiv('settings-drag-handle');
            dragHandle.textContent = '☰';
            setTooltip(dragHandle, 'Drag to reorder', { placement: 'top' });
            itemRow.setAttribute('draggable', 'true');
            this.setupDragAndDrop(itemRow, item);
        }

        // Create update function for this item
        const updateItem = (updates: Partial<T>) => {
            const updatedItems = [...this.config.items];
            updatedItems[index] = { ...updatedItems[index], ...updates };
            this.config.onItemsChange(updatedItems);
            this.renderItems(); // Re-render to reflect changes
        };

        // Create delete function for this item
        const deleteItem = () => {
            if (this.config.canDelete && !this.config.canDelete(item)) return;
            if (this.config.minItems && this.config.items.length <= this.config.minItems) return;
            
            const updatedItems = this.config.items.filter(i => i.id !== item.id);
            this.config.onItemsChange(updatedItems);
            this.renderItems(); // Re-render to reflect changes
        };

        // Render the item content using the provided render function
        this.config.renderItem(itemRow, item, index, updateItem, deleteItem);
    }

    private renderAddButton(): void {
        if (this.config.maxItems && this.config.items.length >= this.config.maxItems) {
            return;
        }

        const addButtonContainer = this.container.createDiv('settings-view__add-button-container');
        const addButton = addButtonContainer.createEl('button', {
            text: this.config.addButtonText || 'Add Item',
            cls: 'tn-btn tn-btn--primary'
        });

        addButton.addEventListener('click', () => {
            const newItem = this.config.createNewItem();
            const updatedItems = [...this.config.items, newItem];
            this.config.onItemsChange(updatedItems);
            this.renderItems(); // Re-render to show new item
            this.renderAddButton(); // Re-render add button to check limits
        });
    }

    private setupDragAndDrop(itemRow: HTMLElement, item: T): void {
        itemRow.addEventListener('dragstart', (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', item.id);
                itemRow.classList.add('dragging');
            }
        });

        itemRow.addEventListener('dragend', () => {
            itemRow.classList.remove('dragging');
        });

        itemRow.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingRow = this.listContainer.querySelector('.dragging') as HTMLElement;
            if (draggingRow && draggingRow !== itemRow) {
                const rect = itemRow.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                if (e.clientY < midpoint) {
                    itemRow.classList.add('drag-over-top');
                    itemRow.classList.remove('drag-over-bottom');
                } else {
                    itemRow.classList.add('drag-over-bottom');
                    itemRow.classList.remove('drag-over-top');
                }
            }
        });

        itemRow.addEventListener('dragleave', () => {
            itemRow.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        itemRow.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer?.getData('text/plain');
            if (!draggedId || draggedId === item.id) return;

            // Clear drag visual indicators
            itemRow.classList.remove('drag-over-top', 'drag-over-bottom');

            // Find the dragged item
            const draggedIndex = this.config.items.findIndex(i => i.id === draggedId);
            const targetIndex = this.config.items.findIndex(i => i.id === item.id);
            
            if (draggedIndex === -1 || targetIndex === -1) return;

            // Determine insertion point based on drop position
            const rect = itemRow.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midpoint;
            
            // Reorder items
            const reorderedItems = [...this.config.items];
            const [draggedItem] = reorderedItems.splice(draggedIndex, 1);
            
            let insertIndex = targetIndex;
            if (draggedIndex < targetIndex && !insertBefore) {
                insertIndex = targetIndex; // Already adjusted due to removal
            } else if (draggedIndex < targetIndex && insertBefore) {
                insertIndex = targetIndex - 1;
            } else if (draggedIndex > targetIndex && insertBefore) {
                insertIndex = targetIndex;
            } else if (draggedIndex > targetIndex && !insertBefore) {
                insertIndex = targetIndex + 1;
            }

            reorderedItems.splice(insertIndex, 0, draggedItem);
            
            this.config.onItemsChange(reorderedItems);
            this.renderItems(); // Re-render to reflect new order
        });
    }

    public updateItems(items: T[]): void {
        this.config.items = items;
        this.renderItems();
    }
}