declare module 'chrono-node' {
  export interface ParsedComponents {
    date(): Date;
    get(component: string): number;
    isCertain(component: string): boolean;
  }

  export interface ParsedResult {
    text: string;
    index: number;
    start: ParsedComponents;
    end?: ParsedComponents;
  }

  export function parse(text: string, refDate?: Date, options?: any): ParsedResult[];
  export function parseDate(text: string, refDate?: Date, options?: any): Date | null;

  export const casual: {
    parse: typeof parse;
    parseDate: typeof parseDate;
  };

  export const strict: {
    parse: typeof parse;
    parseDate: typeof parseDate;
  };

  const _default: {
    parse: typeof parse;
    parseDate: typeof parseDate;
    casual: typeof casual;
    strict: typeof strict;
  };
  export default _default;
}

