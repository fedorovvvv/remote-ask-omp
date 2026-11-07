import { describe, expect, test } from "bun:test";
import { type AskQuestion, parseAnswer, resultText } from "../src/answer";

const single: AskQuestion = {
	id: "db",
	question: "Database?",
	options: [{ label: "SQLite" }, { label: "Postgres" }, { label: "MySQL" }],
	recommended: 1,
};
const multi: AskQuestion = {
	id: "features",
	question: "Features?",
	multi: true,
	options: [{ label: "Auth" }, { label: "Search" }, { label: "CSV" }, { label: "Notify" }],
};

describe("parseAnswer", () => {
	test("a number picks that option", () => {
		expect(parseAnswer(single, "2")).toEqual({ selected: ["Postgres"] });
	});

	test("text after the number becomes a note", () => {
		expect(parseAnswer(single, "3 но с бэкапами")).toEqual({ selected: ["MySQL"], note: "но с бэкапами" });
		expect(parseAnswer(single, "1: quick one")).toEqual({ selected: ["SQLite"], note: "quick one" });
	});

	test("multi accepts spaces and commas, dedupes, keeps a trailing note", () => {
		expect(parseAnswer(multi, "1 3")).toEqual({ selected: ["Auth", "CSV"] });
		expect(parseAnswer(multi, "1,3; 4")).toEqual({ selected: ["Auth", "CSV", "Notify"] });
		expect(parseAnswer(multi, "2 2 4 без CSV")).toEqual({ selected: ["Search", "Notify"], note: "без CSV" });
	});

	test("several numbers on a single-select question ask again", () => {
		expect(parseAnswer(single, "1 3")).toHaveProperty("retry");
	});

	test("out-of-range or non-numeric input is a custom answer", () => {
		expect(parseAnswer(single, "7 дней")).toEqual({ selected: [], custom: "7 дней" });
		expect(parseAnswer(single, "через 3 дня")).toEqual({ selected: [], custom: "через 3 дня" });
		expect(parseAnswer(multi, "0")).toEqual({ selected: [], custom: "0" });
	});

	test("empty input takes the recommended option, else asks again", () => {
		expect(parseAnswer(single, "   ")).toEqual({ selected: ["Postgres"] });
		expect(parseAnswer(multi, "")).toHaveProperty("retry");
		expect(parseAnswer({ ...single, recommended: 9 }, "")).toHaveProperty("retry");
	});

	test("an hc agent wrapper is stripped before parsing", () => {
		expect(parseAnswer(single, '<hc from="t48">2 ok</hc>')).toEqual({ selected: ["Postgres"], note: "ok" });
	});
});

describe("resultText", () => {
	test("one question uses the built-in ask wording", () => {
		expect(resultText([{ q: single, a: { selected: ["MySQL"], note: "x" } }])).toBe(
			"User selected: MySQL\nUser added note on MySQL: x",
		);
	});

	test("several questions are keyed by id", () => {
		expect(
			resultText([
				{ q: single, a: { selected: ["Postgres"] } },
				{ q: multi, a: { selected: [], custom: "nothing" } },
			]),
		).toBe("db:\n  User selected: Postgres\nfeatures:\n  User provided custom input: nothing");
	});
});
