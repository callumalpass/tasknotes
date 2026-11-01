/** The latest pending plugin-data write per plugin instance */
const writeChains = new WeakMap<object, Promise<unknown>>();

/**
 * Run a plugin-data read-modify-write while no other write of the same
 * plugin's data is in progress. data.json is saved whole, so two writers that
 * load before either saves would otherwise drop one another's changes.
 * `write` must not wait on another locked write, or the two deadlock.
 */
export function withPluginDataWriteLock<T>(plugin: object, write: () => Promise<T>): Promise<T> {
	const previous = writeChains.get(plugin);
	// Start straight away when nothing is pending, as an unlocked write would.
	const run = previous ? previous.then(write) : write();
	const settled = run.then(
		() => undefined,
		() => undefined
	);
	writeChains.set(plugin, settled);
	void settled.then(() => {
		if (writeChains.get(plugin) === settled) {
			writeChains.delete(plugin);
		}
	});
	return run;
}
