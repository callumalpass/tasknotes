import { Plugin } from "obsidian";
import { InMemoryInteropBridge } from "@callumalpass/mdbase-interop";

// Test-only bridge with the published mdbase-sync API shape. Integrations start off.
export default class MdbaseSyncFixture extends Plugin {
	private enabled = false;
	private readonly bridge = new InMemoryInteropBridge({
		authorize: () => this.enabled,
		transport: {
			delivery: ["ephemeral"],
			ordering: ["none"],
			cancellation: true,
			deadlines: true,
			provider_discovery: true,
			request_deduplication: true,
			cross_process_identity: false,
		},
	});

	readonly api = {
		apiVersion: 1,
		interop: {
			profileVersion: "0.1",
			transport: this.bridge.describe().transport,
			connect: (plugin: Plugin) => this.bridge.connect({
				application: plugin.manifest.id,
				implementation: `${plugin.manifest.id}.obsidian`,
				version: plugin.manifest.version,
			}),
			describe: () => this.bridge.describe(),
		},
		getInteropStatus: () => ({ enabled: this.enabled, profileVersion: "0.1" }),
	};

	async onload(): Promise<void> {
		this.enabled = (await this.loadData())?.interopEnabled === true;
	}

	onunload(): void {
		void this.bridge.dispose();
	}
}
