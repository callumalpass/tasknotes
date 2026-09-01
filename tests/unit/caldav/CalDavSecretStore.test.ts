import {
	calDavSecretId,
	CalDavSecretStore,
} from "../../../src/services/CalDavSecretStore";

/** Stand-in for Obsidian's synchronous SecretStorage. */
function makeStorage(initial: Record<string, string> = {}) {
	const values = new Map<string, string>(Object.entries(initial));
	return {
		values,
		getSecret: jest.fn((id: string) => values.get(id) ?? null),
		setSecret: jest.fn((id: string, value: string) => {
			values.set(id, value);
		}),
	};
}

describe("calDavSecretId", () => {
	it("namespaces per account", () => {
		expect(calDavSecretId("work")).toBe("tasknotes-caldav-work-credentials");
	});

	it("sanitises characters that could escape the key namespace", () => {
		expect(calDavSecretId("../../other")).toBe("tasknotes-caldav-other-credentials");
		expect(calDavSecretId("a b/c")).toBe("tasknotes-caldav-a-b-c-credentials");
	});

	// Obsidian throws on anything outside this alphabet, which is what made
	// storing a password fail for every generated account id.
	it("emits only lowercase letters, digits and dashes", () => {
		const ids = ["caldav_mtidlkvy", "Work Account", "ACCOUNT", "a..b__c", "-lead-"];
		for (const id of ids) {
			expect(calDavSecretId(id)).toMatch(/^[a-z0-9-]+$/u);
		}
	});

	it("never exceeds Obsidian's 64 character limit", () => {
		expect(calDavSecretId("x".repeat(500)).length).toBeLessThanOrEqual(64);
	});

	it("keeps long ids that share a prefix in separate slots", () => {
		const prefix = "account-".repeat(12);
		expect(calDavSecretId(`${prefix}one`)).not.toBe(calDavSecretId(`${prefix}two`));
	});

	it("falls back to a usable id when nothing survives sanitisation", () => {
		expect(calDavSecretId("///")).toBe("tasknotes-caldav-account-credentials");
	});
});

describe("CalDavSecretStore", () => {
	it("reports missing credentials for an unknown account", () => {
		const store = new CalDavSecretStore(makeStorage());
		expect(store.getCredentialsState("work")).toEqual({ status: "missing" });
		expect(store.getCredentials("work")).toBeNull();
		expect(store.hasCredentials("work")).toBe(false);
	});

	it("round-trips credentials", () => {
		const store = new CalDavSecretStore(makeStorage());
		store.setCredentials("work", { username: "fabian", password: "app-pass" });

		expect(store.getCredentials("work")).toEqual({
			username: "fabian",
			password: "app-pass",
		});
		expect(store.hasCredentials("work")).toBe(true);
	});

	it("keeps accounts isolated", () => {
		const store = new CalDavSecretStore(makeStorage());
		store.setCredentials("work", { username: "w", password: "1" });
		store.setCredentials("home", { username: "h", password: "2" });

		expect(store.getCredentials("work")?.username).toBe("w");
		expect(store.getCredentials("home")?.username).toBe("h");
	});

	it("trims the username but preserves the password verbatim", () => {
		// App-specific passwords are generated; whitespace in them can be real.
		const store = new CalDavSecretStore(makeStorage());
		store.setCredentials("work", { username: "  fabian  ", password: " secret " });

		expect(store.getCredentials("work")).toEqual({
			username: "fabian",
			password: " secret ",
		});
	});

	it("refuses to store an empty username", () => {
		const store = new CalDavSecretStore(makeStorage());
		expect(() => store.setCredentials("work", { username: "   ", password: "x" })).toThrow(
			/username/iu
		);
	});

	it("distinguishes cleared from missing", () => {
		const store = new CalDavSecretStore(makeStorage());
		store.setCredentials("work", { username: "fabian", password: "p" });
		store.clearCredentials("work");

		expect(store.getCredentialsState("work")).toEqual({ status: "cleared" });
		expect(store.getCredentials("work")).toBeNull();
	});

	it("reports invalid rather than throwing on a corrupt envelope", () => {
		const storage = makeStorage({
			"tasknotes-caldav-work-credentials": "{not json",
		});
		expect(new CalDavSecretStore(storage).getCredentialsState("work")).toEqual({
			status: "invalid",
		});
	});

	it("reports invalid for an unknown envelope version", () => {
		const storage = makeStorage({
			"tasknotes-caldav-work-credentials": JSON.stringify({ version: 2, state: "configured" }),
		});
		expect(new CalDavSecretStore(storage).getCredentialsState("work")).toEqual({
			status: "invalid",
		});
	});

	it("reports invalid when the payload is missing a password", () => {
		const storage = makeStorage({
			"tasknotes-caldav-work-credentials": JSON.stringify({
				version: 1,
				state: "configured",
				credentials: { username: "fabian" },
			}),
		});
		expect(new CalDavSecretStore(storage).getCredentialsState("work")).toEqual({
			status: "invalid",
		});
	});

	it("throws when SecretStorage silently fails to persist", () => {
		const storage = makeStorage();
		storage.setSecret.mockImplementation(() => {
			/* drops the write */
		});
		expect(() =>
			new CalDavSecretStore(storage).setCredentials("work", {
				username: "fabian",
				password: "p",
			})
		).toThrow(/did not persist/iu);
	});

	it("never writes credentials anywhere but the namespaced secret id", () => {
		const storage = makeStorage();
		new CalDavSecretStore(storage).setCredentials("work", {
			username: "fabian",
			password: "p",
		});
		expect([...storage.values.keys()]).toEqual(["tasknotes-caldav-work-credentials"]);
	});
});
