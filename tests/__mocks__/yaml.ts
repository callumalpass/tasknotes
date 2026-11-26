/**
 * Mock for the yaml module
 */

const actualYaml = jest.requireActual("yaml") as typeof import("yaml");

export const parse = jest.fn((input: string) => {
	return actualYaml.parse(input);
});

export const stringify = jest.fn((obj: any) => {
	return actualYaml.stringify(obj);
});

export const parseDocument = actualYaml.parseDocument;
export const isAlias = actualYaml.isAlias;
export const isSeq = actualYaml.isSeq;
export const visit = actualYaml.visit;

export default {
	...actualYaml,
	parse,
	stringify,
	parseDocument,
};
