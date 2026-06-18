# mdgram

Streaming Markdown to Telegram HTML converter. Safely converts incomplete Markdown (token-by-token from LLMs) into valid Telegram HTML at every step.

Supports both classic Telegram HTML (`mdgram`) and the Bot API 10.1 Rich HTML format (`mdgramRich`).

## Install

```bash
npm install @borodin/mdgram
```

## Usage

### Classic Telegram HTML

```ts
import { mdgram } from "@borodin/mdgram";

mdgram("Hello **world**");
// "Hello <b>world</b>"

// Handles incomplete markdown (streaming)
mdgram("Hello **wor");
// "Hello <b>wor</b>"
```

### Rich HTML (Bot API 10.1+)

```ts
import { mdgramRich } from "@borodin/mdgram";

mdgramRich("# Title\n\n- item 1\n- item 2");
// "<h1>Title</h1>\n<ul>\n<li>item 1</li>\n<li>item 2</li>\n</ul>"

// LaTeX
mdgramRich("Euler's formula: $e^{i\\pi} + 1 = 0$");
// "Euler&#39;s formula: <tg-math>e^{i\pi} + 1 = 0</tg-math>"

// Streaming — every prefix is valid Rich HTML
mdgramRich("$e^{i\\pi");
// "<tg-math>e^{i\pi}</tg-math>"
```

Use `sendRichMessage` / `sendRichMessageDraft` to send Rich HTML to Telegram.

## Supported formatting

### `mdgram` — classic Telegram HTML

| Markdown | Output |
|---|---|
| `**bold**` | `<b>bold</b>` |
| `*italic*` | `<i>italic</i>` |
| `` `code` `` | `<code>code</code>` |
| ` ```lang\n...\n``` ` | `<pre><code class="language-lang">...</code></pre>` |
| `[text](url)` | `<a href="url">text</a>` |
| `~~strike~~` | `<s>strike</s>` |
| `\|\|spoiler\|\|` | `<tg-spoiler>spoiler</tg-spoiler>` |
| `> quote` | `<blockquote>quote</blockquote>` |
| `# heading` | `<b>heading</b>` |
| `- item` / `1. item` | `• item` / `1. item` |

### `mdgramRich` — Rich HTML (superset)

Everything from `mdgram`, plus:

| Markdown | Output |
|---|---|
| `# H1` … `###### H6` | `<h1>` … `<h6>` |
| `- item` / `1. item` | `<ul><li>` / `<ol><li>` |
| `- [x] task` | `<li><input type="checkbox" checked>` |
| `\| table \|` | `<table><tr><th/td>` |
| `==highlight==` | `<mark>highlight</mark>` |
| `$formula$` | `<tg-math>formula</tg-math>` |
| `$$formula$$` | `<tg-math-block>formula</tg-math-block>` |
| ` ```math\nformula\n``` ` | `<tg-math-block>formula</tg-math-block>` |
| `\(formula\)` | `<tg-math>formula</tg-math>` |
| `\[formula\]` | `<tg-math-block>formula</tg-math-block>` |
| `---` | `<hr/>` |
| `![alt](url)` | `<img src="url"/>` |
| `![alt](url "caption")` | `<figure><img src="url"/><figcaption>caption</figcaption></figure>` |
| Raw `<tg-spoiler>`, `<tg-emoji>`, `<tg-thinking>`, `<u>`, `<ins>`, `<sub>`, `<sup>`, `<cite>`, `<details>`, `<aside>`, `<footer>` | passed through verbatim |

Currency amounts like `$100` are never misidentified as LaTeX.

## Truncation

Telegram limits message text to **4096** and captions to **1024** UTF-16 code units. Rich messages support up to **32768** characters.

```ts
import { mdgram, mdgramRich, MESSAGE_LIMIT, CAPTION_LIMIT, RICH_MESSAGE_LIMIT } from "@borodin/mdgram";

mdgram(longMarkdown, { maxLength: MESSAGE_LIMIT });
mdgram(longMarkdown, { maxLength: CAPTION_LIMIT });
mdgramRich(longMarkdown, { maxLength: RICH_MESSAGE_LIMIT });
```

When truncated, output ends with `…` and all open tags are properly closed.

## LLM system prompt

For `mdgram`:

    Format responses using Markdown:
    - **bold**, *italic*, ~~strikethrough~~
    - `inline code` and fenced code blocks (```)
    - [links](url), ||spoilers||, > blockquotes
    - Lists: - item, 1. item
    Do NOT use images, HTML tags, or LaTeX.

For `mdgramRich`:

    Format responses using Markdown:
    - **bold**, *italic*, ~~strikethrough~~, ==highlight==
    - `inline code`, fenced code blocks (```), math blocks (```math)
    - $inline LaTeX$, $$block LaTeX$$
    - [links](url), ||spoilers||, > blockquotes
    - Headings: # H1 through ###### H6
    - Lists: - item, 1. item, - [x] task list
    - Tables: | col | col |
    - Horizontal rule: ---
    - Images: ![caption](url) or ![caption](url "caption text")
    Do NOT use raw HTML tags.

## How it works

1. **[remend](https://npm.im/remend)** auto-closes incomplete Markdown tokens (bold, italic, code, spoilers, LaTeX, etc.)
2. **[marked](https://npm.im/marked)** parses the completed Markdown with a custom Telegram renderer
3. Output is valid Telegram HTML at every step — safe to stream directly to `editMessageText` or `sendRichMessageDraft`

## License

MIT
