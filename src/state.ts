/**
 * The on/off switch, shared by every omp session of the user: a JSON file in
 * omp's agent directory. Read on every `ask`, so `/remote-ask off` in one
 * session applies to the others without a restart.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const STATE_FILE = "remote-ask-omp.json";

export interface State {
	enabled: boolean;
}

const DEFAULT_STATE: State = { enabled: true };

export function statePath(agentDir: string): string {
	return join(agentDir, STATE_FILE);
}

export function readState(file: string): State {
	try {
		const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<State>;
		return { enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_STATE.enabled };
	} catch {
		return { ...DEFAULT_STATE };
	}
}

export function writeState(file: string, state: State): void {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
	renameSync(tmp, file);
}

/** omp running inside herdr: an hc terminal (Herdr app, herdr-core) or a herdr TUI pane. */
export function inHerdr(env: Record<string, string | undefined> = process.env): boolean {
	return !!env.HC_TERMINAL_ID || env.HERDR_ENV === "1";
}
