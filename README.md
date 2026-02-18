# mdgram

Streaming Markdown to Telegram HTML converter. Safely converts incomplete Markdown (token-by-token from LLMs) into valid Telegram HTML at every step.

## Install

```bash
npm install mdgram
```

## Usage

```ts
import { mdgram } from "mdgram";

mdgram("Hello **world**");
// "Hello <b>world</b>"

// Handles incomplete markdown (streaming)
mdgram("Hello **wor");
// "Hello <b>wor</b>"
```

## Supported formatting

| Markdown | Telegram HTML |
|---|---|
| `**bold**` | `<b>bold</b>` |
| `*italic*` | `<i>italic</i>` |
| `` `code` `` | `<code>code</code>` |
| ` ```lang ``` ` | `<pre><code class="language-lang">...</code></pre>` |
| `[text](url)` | `<a href="url">text</a>` |
| `~~strike~~` | `<s>strike</s>` |
| `\|\|spoiler\|\|` | `<tg-spoiler>spoiler</tg-spoiler>` |
| `> quote` | `<blockquote>quote</blockquote>` |
| `# heading` | `<b>heading</b>` |
| `- item` | `• item` |

Unsupported elements (tables, images, etc.) are rendered as plain text.

## Truncation

Telegram limits message text to **4096** and captions to **1024** UTF-16 code units.

```ts
import { mdgram, MESSAGE_LIMIT, CAPTION_LIMIT } from "mdgram";

mdgram(longMarkdown, { maxLength: MESSAGE_LIMIT });
mdgram(longMarkdown, { maxLength: CAPTION_LIMIT });
```

When truncated, the output ends with "…" (single ellipsis character) and all open HTML tags are properly closed.

## LLM system prompt

Add this to your AI agent's system prompt for best results:

    Format responses using only this Markdown:
    - **bold**, *italic*, ~~strikethrough~~
    - `inline code` and fenced code blocks (```)
    - [links](url)
    - ||spoilers||
    - > blockquotes
    - Lists: - item, 1. item
    Do NOT use images, horizontal rules, HTML tags, or LaTeX.

## How it works

1. **[remend](https://npm.im/remend)** auto-closes incomplete Markdown tokens
2. **[marked](https://npm.im/marked)** parses the completed Markdown with a custom Telegram renderer
3. Output is valid Telegram HTML at every step — safe for streaming

## License

MIT
