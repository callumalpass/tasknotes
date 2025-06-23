/**
 * Mock for the yaml module
 */

export const parse = jest.fn((input: string) => {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
});

export const stringify = jest.fn((obj: any) => {
  try {
    // Convert to YAML-like format for testing
    const yamlLines = Object.entries(obj).map(([key, value]) => {
      if (Array.isArray(value)) {
        const arrayItems = value.map(item => `  - ${item}`).join('\n');
        return `${key}:\n${arrayItems}`;
      } else if (typeof value === 'string') {
        return `${key}: ${value}`;
      } else {
        return `${key}: ${value}`;
      }
    });
    return yamlLines.join('\n');
  } catch {
    return '';
  }
});

export default {
  parse,
  stringify
};