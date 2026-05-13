declare module 'ical.js' {
    export interface ParsedComponent {
        [key: string]: unknown;
    }

    export class Component {
        constructor(jcal: unknown);
        getAllSubcomponents(name: string): Component[];
        getFirstPropertyValue(name: string): unknown;
        getAllProperties(name: string): Property[];
    }

    export interface Property {
        getParameter(name: string): unknown;
        getFirstValue(): unknown;
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
        zone: unknown;
        fromJSDate(date: Date): void;
        toJSDate(): Date;
        toUnixTime(): number;
        toString(): string;
        compare(other: Time): number;
    }

    export interface EventIterator {
        next(): Time | null;
    }

    export const TimezoneService: {
        register(component: Component): void;
    };

    export function parse(input: string): ParsedComponent;
}
