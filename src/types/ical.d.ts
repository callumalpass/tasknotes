declare module 'ical.js' {
    export interface ParsedComponent {
        [key: string]: unknown;
    }

    export class Component {
        constructor(jcal: unknown);
        getAllSubcomponents(name: string): Component[];
        getFirstProperty(name: string): Property | null;
        getFirstPropertyValue(name: string): unknown;
        getAllProperties(name: string): Property[];
        addSubcomponent(component: Component): Component;
        updatePropertyWithValue(name: string, value: unknown): Property;
        toJSON(): unknown;
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

    export interface TimezoneRef {
        tzid?: string;
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
        zone: TimezoneRef | null | undefined;
        fromJSDate(date: Date): void;
        toJSDate(): Date;
        toUnixTime(): number;
        toString(): string;
        compare(other: Time): number;
    }

    export interface EventIterator {
        next(): Time | null;
    }

    export class Timezone {
        constructor(data: { component: Component; tzid: string });
    }

    export const TimezoneService: {
        register(timezone: Component | Timezone): void;
    };

    export function parse(input: string): ParsedComponent;
}
