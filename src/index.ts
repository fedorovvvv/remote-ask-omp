/**
 * remote-ask-omp — answer omp's `ask` questions without arrow keys.
 *
 * The built-in `ask` picker is driven by arrow keys, which phone and tablet
 * clients of Herdr don't have. Inside herdr this extension shadows `ask` with a
 * typed-answer form: the questions and numbered options are printed in the
 * transcript, and each answer is one line in a plain input — "2", "1 3",
 * "2 and a comment", or free text. `/remote-ask on|off|status` switches it;
 * when off, or outside herdr, omp's own picker runs.
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { Text } from "@oh-my-pi/pi-tui";
import { type Answer, type AskQuestion, formatQuestion, inputPlaceholder, parseAnswer, resultText } from "./answer";
import { inHerdr, readState, statePath, writeState } from "./state";

export const COMMAND = "remote-ask";
// Ctrl+L would be nicer, but omp reserves it (live voice) and ignores extension bindings on it.
export const SHORTCUT = "alt+shift+a";

export default function remoteAsk(pi: ExtensionAPI): void {
	const file = statePath(pi.pi.getAgentDir());
	const herdr = inHerdr();
	const active = () => herdr && readState(file).enabled;

	const report = (ctx: ExtensionContext) => {
		const { enabled } = readState(file);
		const where = herdr ? "omp запущен в herdr" : "omp запущен не в herdr, здесь всегда обычное меню со стрелками";
		ctx.ui.notify(
			`remote-ask: ${enabled ? "включён — на вопросы отвечаешь номером или текстом" : "выключен — обычное меню со стрелками"} (${where}).`,
			"info",
		);
	};

	pi.registerCommand(COMMAND, {
		description: "Answer ask questions by typing (for Herdr on a phone): on | off | toggle | status",
		handler: async (args, ctx) => {
			const arg = String(args ?? "").trim().toLowerCase();
			if (arg === "on" || arg === "off") writeState(file, { enabled: arg === "on" });
			else if (arg === "toggle") writeState(file, { enabled: !readState(file).enabled });
			else if (arg && arg !== "status") {
				ctx.ui.notify(`/${COMMAND}: неизвестный аргумент "${arg}". Используй on, off, toggle или status.`, "warning");
				return;
			}
			report(ctx);
		},
	});

	pi.registerShortcut(SHORTCUT, {
		description: "Toggle remote-ask (typed answers to ask questions)",
		handler(ctx) {
			writeState(file, { enabled: !readState(file).enabled });
			report(ctx);
		},
	});

	// Outside herdr the built-in tool stays untouched, description and all.
	if (!herdr) return;

	const z = pi.zod;
	const option = z
		.object({
			label: z.string().describe("Display label"),
			description: z.string().optional().describe("Explanation shown under the label"),
			preview: z.string().optional().describe("Rich preview; shown only by the built-in picker"),
		})
		.strict();
	const question = z
		.object({
			id: z.string().describe("Question ID, e.g. 'auth', 'cache'"),
			question: z.string().describe("Question text"),
			options: z.array(option).describe("Options for the user to choose from"),
			header: z.string().optional().describe("Short label shown before the question"),
			multi: z.boolean().optional().describe("Allow multiple selections"),
			recommended: z.number().optional().describe("Index of the recommended option (0-indexed)"),
		})
		.strict();

	pi.registerTool({
		name: "ask",
		label: "Ask",
		description:
			"Ask the user one or more clarifying questions with options. The user picks options by number, may add a note, or types a custom answer. Use only for materially different tradeoffs the user must decide; give 2-5 short options per question.",
		parameters: z.object({ questions: z.array(question).min(1).describe("Questions to ask") }).strict(),
		strict: true,
		approval: "read",
		async execute(_id, params, signal, _onUpdate, ctx) {
			const native = ctx.invokeTool;
			if (!active() || !ctx.hasUI || typeof ctx.ui?.input !== "function") {
				if (native) return native(params as Record<string, unknown>);
				throw new Error("Ask tool requires interactive mode");
			}
			const qs = (params as { questions: AskQuestion[] }).questions;
			const ids = new Set<string>();
			for (const q of qs) {
				if (ids.has(q.id)) return { content: [{ type: "text", text: `Error: duplicate question id "${q.id}"` }] };
				ids.add(q.id);
			}

			const answers: { q: AskQuestion; a: Answer }[] = [];
			for (let i = 0; i < qs.length; i++) {
				const q = qs[i]!;
				let hint = "";
				for (;;) {
					if (signal?.aborted) throw new Error("Ask input was cancelled");
					const title = `${hint}${qs.length > 1 ? `Вопрос ${i + 1}/${qs.length}: ` : ""}${q.question}`;
					const raw = await ctx.ui.input(title, inputPlaceholder(q), { signal });
					if (raw === undefined) {
						ctx.abort?.();
						throw new Error("Ask tool was cancelled by the user");
					}
					const parsed = parseAnswer(q, raw);
					if ("retry" in parsed) {
						hint = `${parsed.retry} `;
						continue;
					}
					answers.push({ q, a: parsed });
					break;
				}
			}

			return {
				content: [{ type: "text", text: resultText(answers) }],
				details: {
					results: answers.map(({ q, a }) => ({
						id: q.id,
						question: q.question,
						options: q.options.map(o => o.label),
						multi: !!q.multi,
						selectedOptions: a.selected,
						customInput: a.custom,
						note: a.note,
					})),
				},
			};
		},
		renderCall(args, _options, theme) {
			const title = theme.fg("accent", "Вопрос");
			const qs: AskQuestion[] = Array.isArray(args?.questions) ? args.questions : [];
			const valid = qs.filter(q => q && typeof q.question === "string" && Array.isArray(q.options));
			// When off, the built-in picker shows the options itself.
			if (!active() || valid.length === 0) return new Text(title, 1, 0);
			return new Text(`${title}\n${valid.map((q, i) => formatQuestion(q, i, valid.length)).join("\n\n")}`, 1, 0);
		},
		renderResult(result, _options, theme) {
			const block = result?.content?.find?.(c => c.type === "text");
			const text = block && "text" in block && typeof block.text === "string" ? block.text : "";
			return new Text(theme.fg("success", text), 1, 0);
		},
	});
}
