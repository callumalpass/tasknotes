import type { MessageConcept } from "./messages";

/** Finite suffix sets for legacy namespace adapters. No user/persisted string can
 * synthesize an ID; TypeScript proves each selection names an extracted descriptor.
 */
export type MessageSuffix<Prefix extends string, Key extends MessageConcept = MessageConcept> =
	Key extends `${Prefix}${infer Suffix}` ? Suffix : never;
