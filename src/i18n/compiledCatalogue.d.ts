// Generated JSON need not exist for an independent source typecheck.
// Its contents remain unknown until compiledMessages() validates them; production
// builds and the default Jest setup also require strict shared-kit compilation.
declare module "*/messages.json" {
	const catalogue: { messages: unknown };
	export default catalogue;
}
