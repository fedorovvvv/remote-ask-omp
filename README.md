# remote-ask-omp

An [omp](https://github.com/can1357/oh-my-pi) extension that lets you answer omp's `ask`
questions by typing, for when you drive omp from a phone or tablet through
[Herdr](https://herdr.dev).

## The problem

omp's `ask` tool opens a picker you move through with arrow keys. The Herdr iPhone/iPad app
gives you a terminal and an on-screen keyboard — no arrow keys. A question from the agent
becomes something you can only cancel.

## What it does

Inside herdr, `ask` questions are printed in the transcript with numbered options, and each
answer is one line typed into a plain input:

| you type | the agent gets |
| --- | --- |
| `2` | option 2 |
| `3 but darker` | option 3, with your note |
| `1 3` or `1,3` | options 1 and 3 (multi-select questions) |
| text not starting with a valid number | your own answer |
| empty Enter | the recommended option |
| `Esc` | cancel |

Several questions are answered one after another. The result reaches the model in the same
wording as omp's own picker. Herdr still sees the session as blocked on a question, so the app
notifies you.

Outside herdr — or when switched off — nothing changes: omp's built-in picker runs.

## Install

```sh
omp plugin install github:fedorovvvv/remote-ask-omp
```

For local development: `omp plugin link /path/to/remote-ask-omp`.

## Switching it on and off

| | |
| --- | --- |
| `Alt+Shift+A` | toggle |
| `/remote-ask on` / `off` / `toggle` | set it |
| `/remote-ask` or `/remote-ask status` | show the current state |

The switch is shared by all your omp sessions (stored in `~/.omp/agent/remote-ask-omp.json`)
and applies to the next question without a restart. It is on by default.

`Ctrl+L` is not available: omp reserves it for live voice mode and ignores extension bindings
on it.

## How "inside herdr" is detected

`HC_TERMINAL_ID` (a Herdr Core terminal — what the Herdr app connects to) or `HERDR_ENV=1`
(a herdr TUI pane). Herdr does not tell which client is looking at a terminal, so the typed
form is used inside herdr even when you watch from a desktop terminal; toggle it off there if
you prefer the picker.

## Limits

- The question is shown in the terminal, not as a native dialog in the Herdr app: herdr only
  passes a session's state and one line of text to the app.
- Option `preview` content and the picker's `Chat about this` redirect are not available in the
  typed form.
- A single-select answer starting with several numbers (`2 3 days`) is asked again; start a
  free-text answer with a word instead (`in 3 days`).

## Development

```sh
bun install
bun test
bun run typecheck
```

## License

MIT
