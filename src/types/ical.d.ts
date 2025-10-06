declare module 'ical.js' {
    export interface ParsedComponent {
        [key: string]: any;
    }

    export class Component {
        constructor(jcal: any);
        getAllSubcomponents(name: string): Component[];
    }

    export class Event {
        constructor(component: Component);
        uid: string;
        summary: string;
        description?: string;
        location?: string;
        url?: string;
        startDate: Time;
        endDate?: Time;
        isRecurring(): boolean;
        iterator(startDate?: Time): EventIterator;
    }

    export class Time {
        constructor();
        isDate: boolean;
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
        zone: any;
        fromJSDate(date: Date): void;
        toJSDate(): Date;
        toUnixTime(): number;
        toString(): string;
        compare(other: Time): number;
    }

    export interface EventIterator {
        next(): Time | null;
    }

    export function parse(input: string): ParsedComponent;
}