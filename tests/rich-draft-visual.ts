/**
 * Visual test: streams mdgramRich HTML into sendRichMessageDraft
 * 6 chars per chunk of source markdown, 2 times per second (500ms interval).
 * Sends html: (not markdown:) so every partial update is pre-rendered.
 *
 * Run:
 *   BOT_TOKEN=xxx CHAT_ID=yyy npx tsx tests/rich-draft-visual.ts
 */
import { mdgramRich } from "../src/index.js";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHAT_ID = process.env.CHAT_ID!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DRAFT_ID = 424242;
const CHUNK = 40;
const INTERVAL_MS = 1000;

const MARKDOWN = `# Ultimate Markdown Stress Test

**Bold text** and *italic text* and ~~strikethrough~~ and ||spoiler|| and ==marked==.

Combined: ***bold italic*** and **~~bold strikethrough~~** and *==italic marked==*.

## Code Examples

Inline: use \`const x = 42\` instead of \`var\`.

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  return res.json();
}
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    a, b = 0, 1
    result = []
    while a < n:
        result.append(a)
        a, b = b, a + b
    return result

print(fibonacci(100))
\`\`\`

## Lists

Unordered:
- **First item** with bold text
- *Second item* with italic
- Third item with \`inline code\`
- Fourth with ~~strikethrough~~
- Fifth with [a link](https://telegram.org)

Ordered:
1. Step one: install dependencies
2. Step two: configure environment
3. Step three: run \`npm start\`
4. Step four: open https://telegram.org/dev

## Blockquotes

> This is a simple blockquote.
> It spans multiple lines.
> **Bold inside quote** and *italic inside quote*.

> Nested content:
> Use \`sendRichMessageDraft\` for streaming.
> Then call \`sendRichMessage\` to finalize.

## Table

| Method | Speed | Errors | Notes |
|--------|------:|:------:|-------|
| Raw MarkdownV2 | slow | **100%** | Unusable |
| editMessageText + mdgram | fast | 0% | ✅ Recommended |
| sendRichMessageDraft | fast | ~5% | ✅ Animated |
| sendRichMessageDraft + mdgram | fast | 0% | ✅ Best quality |

## Links and Mentions

Visit [Telegram Bot API](https://core.telegram.org/bots/api) for docs.

Email: [support@telegram.org](mailto:support@telegram.org)

## Math

Inline formula: $E = mc^2$ and $\\alpha + \\beta = \\gamma$.

Block formula:

$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

\`\`\`math
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
\`\`\`

## Highlight & HTML

The ==most important== concept: ==streaming== without flicker.

Water: H<sub>2</sub>O. Pythagorean: a<sup>2</sup> + b<sup>2</sup> = c<sup>2</sup>.

---

## Final Paragraph

The quick **brown fox** jumps over the *lazy dog*.
\`console.log("done")\` — that's all folks!`;

async function tg(method: string, body: object) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; description?: string }>;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`Markdown length: ${MARKDOWN.length} chars`);
  console.log(`Chunk size: ${CHUNK} chars → ${Math.ceil(MARKDOWN.length / CHUNK)} updates`);
  console.log(
    `Interval: ${INTERVAL_MS}ms → ~${(((MARKDOWN.length / CHUNK) * INTERVAL_MS) / 1000).toFixed(0)}s total`,
  );
  console.log("Streaming to Telegram...\n");

  let ok = 0;
  let errors = 0;

  for (let i = CHUNK; i <= MARKDOWN.length + CHUNK; i += CHUNK) {
    const partial = MARKDOWN.slice(0, i);

    const html = mdgramRich(partial);
    if (!html) {
      ok++;
      process.stdout.write(".");
      await sleep(INTERVAL_MS);
      continue;
    }

    const r = await tg("sendRichMessageDraft", {
      chat_id: Number(CHAT_ID),
      draft_id: DRAFT_ID,
      rich_message: { html },
    });

    if (r.ok) {
      ok++;
      process.stdout.write(".");
    } else {
      errors++;
      // Respect rate limit
      const wait = r.description?.match(/retry after (\d+)/);
      if (wait) {
        process.stdout.write(`[wait ${wait[1]}s]`);
        await sleep((Number(wait[1]) + 1) * 1000);
      } else {
        process.stdout.write(`✗`);
      }
    }

    await sleep(INTERVAL_MS);
  }

  console.log(`\n\nDone: ${ok} OK, ${errors} errors`);
  console.log("Finalizing with sendRichMessage...");

  const final = await tg("sendRichMessage", {
    chat_id: CHAT_ID,
    rich_message: { html: mdgramRich(MARKDOWN) },
  });
  console.log(final.ok ? "✅ Finalized!" : `❌ ${final.description}`);
}

main();
