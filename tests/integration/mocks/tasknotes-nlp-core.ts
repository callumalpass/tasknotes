export interface ParsedTaskData {
  title: string;
  details?: string;
  due?: string;
  scheduled?: string;
  tags?: string[];
  contexts?: string[];
  projects?: string[];
  status?: string;
  priority?: string;
  recurrence?: string;
}

export class NaturalLanguageParserCore {
  constructor(..._args: unknown[]) {}

  parseInput(input: string): ParsedTaskData {
    return { title: (input || "").trim() };
  }

  getPreviewData(parsedData: ParsedTaskData): ParsedTaskData {
    return parsedData;
  }

  getStatusSuggestions(): string[] {
    return [];
  }
}
