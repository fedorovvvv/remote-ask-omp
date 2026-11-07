import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inHerdr, readState, statePath, writeState } from "../src/state";

describe("state", () => {
	test("missing or malformed file means enabled", () => {
		const dir = mkdtempSync(join(tmpdir(), "remote-ask-"));
		expect(readState(statePath(dir))).toEqual({ enabled: true });
		writeFileSync(statePath(dir), "{not json");
		expect(readState(statePath(dir))).toEqual({ enabled: true });
	});

	test("written state round-trips, creating the directory", () => {
		const file = statePath(join(mkdtempSync(join(tmpdir(), "remote-ask-")), "nested"));
		writeState(file, { enabled: false });
		expect(readState(file)).toEqual({ enabled: false });
	});
});

describe("inHerdr", () => {
	test("an hc terminal or a herdr pane counts, anything else does not", () => {
		expect(inHerdr({ HC_TERMINAL_ID: "t1" })).toBe(true);
		expect(inHerdr({ HERDR_ENV: "1" })).toBe(true);
		expect(inHerdr({ HERDR_ENV: "0" })).toBe(false);
		expect(inHerdr({})).toBe(false);
	});
});
