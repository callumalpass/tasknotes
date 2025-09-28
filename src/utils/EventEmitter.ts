/**
 * A simple event emitter class for communication between views
 */
export class EventEmitter {
    private events: { [key: string]: Array<(...args: any[]) => void> } = {};

    /**
     * Subscribe to an event
     * @param event The event name to listen for
     * @param listener The callback function to execute when the event is triggered
     * @returns An unsubscribe function
     */
    on(event: string, listener: (...args: any[]) => void): () => void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);

        // Return unsubscribe function
        return () => {
            this.events[event] = this.events[event].filter(l => l !== listener);
        };
    }

    /**
     * Emit an event with data
     * @param event The event name to emit
     * @param args The data to pass to the event listeners
     */
    emit(event: string, ...args: any[]): void {
        if (this.events[event]) {
            this.events[event].forEach(listener => {
                listener(...args);
            });
        }
    }

    /**
     * Remove all listeners for a specific event
     * @param event The event name to clear listeners for
     */
    removeAllListeners(event?: string): void {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }
}