/**
 * Plain-text rendering of `ask` questions and parsing of typed answers.
 * Pure functions: no omp runtime, so they are tested directly.
 */

export interface AskOption {
	label: string;
	description?: string;
	preview?: string;
}

export interface AskQuestion {
	id: string;
	question: string;
	options: AskOption[];
	header?: string;
	multi?: boolean;
	recommended?: number;
}

export interface Answer {
	selected: string[];
	custom?: string;
	note?: string;
}

export type ParseResult = Answer | { retry: string };

// Leading option numbers separated by spaces, commas or semicolons, then an optional note.
const NUMBERS = /^\s*(\d+(?:\s*[,;\s]\s*\d+)*)(?:\s*[:.)\-—–]?\s+(.*))?\s*$/s;
// `hc send` from another agent wraps text as <hc from="t1">…</hc>; a person's input never is.
const HC_WRAPPER = /^\s*<hc\b[^>]*>([\s\S]*)<\/hc>\s*$/;

function recommendedIndex(q: AskQuestion): number | undefined {
	const rec = q.recommended;
	return Number.isInteger(rec) && rec! >= 0 && rec! < q.options.length ? rec : undefined;
}

export function formatQuestion(q: AskQuestion, index: number, total: number): string {
	const lines: string[] = [];
	const head = q.header ? `[${q.header}] ` : "";
	lines.push(`${total > 1 ? `(${index + 1}/${total}) ` : ""}${head}${q.question}`);
	const rec = recommendedIndex(q);
	q.options.forEach((o, i) => {
		lines.push(`  ${i + 1}. ${o.label}${rec === i ? " (рекомендую)" : ""}`);
		if (o.description) lines.push(`     ${o.description}`);
	});
	lines.push(
		q.multi
			? "Ответ: номера через пробел или запятую (1 3), после них можно комментарий; или свой текст."
			: "Ответ: номер (2), после него можно комментарий; или свой текст.",
	);
	return lines.join("\n");
}

export function inputPlaceholder(q: AskQuestion): string {
	return q.multi ? "1 3 или свой текст" : "номер или свой текст";
}

/**
 * "2" picks option 2, "1 3" / "1,3" pick several (multi only), text after the numbers
 * becomes a note, anything not starting with valid numbers is a custom answer, and an
 * empty answer takes the recommended option.
 */
export function parseAnswer(q: AskQuestion, raw: string): ParseResult {
	const cleaned = raw.replace(/\r/g, "");
	const text = (HC_WRAPPER.exec(cleaned)?.[1] ?? cleaned).trim();
	if (!text) {
		const rec = recommendedIndex(q);
		if (rec !== undefined) return { selected: [q.options[rec]!.label] };
		return { retry: "Пустой ответ: введи номер или текст." };
	}
	const m = NUMBERS.exec(text);
	if (m) {
		const nums = m[1]!.split(/[,;\s]+/).filter(Boolean).map(Number);
		const valid = nums.every(n => Number.isInteger(n) && n >= 1 && n <= q.options.length);
		if (valid && (q.multi || nums.length === 1)) {
			const selected = [...new Set(nums)].map(n => q.options[n - 1]!.label);
			const note = m[2]?.trim() || undefined;
			return note ? { selected, note } : { selected };
		}
		if (valid) return { retry: `Здесь можно выбрать только один вариант (1–${q.options.length}).` };
	}
	return { selected: [], custom: text };
}

/** Same wording as omp's built-in ask result, so the model reads it the same way. */
export function answerText(a: Answer): string {
	const parts: string[] = [];
	if (a.selected.length) parts.push(`User selected: ${a.selected.join(", ")}`);
	if (a.custom !== undefined) parts.push(`User provided custom input: ${a.custom}`);
	if (a.note) parts.push(`User added note on ${a.selected.join(", ")}: ${a.note}`);
	return parts.join("\n");
}

export function resultText(answers: { q: AskQuestion; a: Answer }[], keyed = answers.length > 1): string {
	if (!keyed) return answers.map(({ a }) => answerText(a)).join("\n");
	return answers.map(({ q, a }) => `${q.id}:\n${answerText(a).replace(/^/gm, "  ")}`).join("\n");
}
