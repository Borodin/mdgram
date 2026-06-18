/**
 * Telegram streaming test — run with:
 *   BOT_TOKEN=xxx CHAT_ID=yyy npx tsx tests/stream-test.ts
 *
 * Tests four approaches to streaming LLM output into Telegram:
 *   1. editMessageText + parse_mode MarkdownV2 + RAW incomplete markdown  → expect API errors
 *   2. editMessageText + parse_mode HTML     + mdgram-generated HTML       → expect smooth updates
 *   3. sendRichMessageDraft                  + RAW incomplete markdown      → expect animated, no errors
 *   4. sendRichMessageDraft                  + mdgram HTML in html field    → expect animated, no errors
 *
 * Observe which approaches error, flicker, or animate cleanly.
 */

import { mdgram } from "../src/index.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Set BOT_TOKEN and CHAT_ID environment variables");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Simulated LLM output — streams token by token, contains bold, code, list, heading
const FULL_MARKDOWN = `# Streaming Test

Here is some **bold text** and *italic* mixed together.

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

A list of items:
- First item with **bold**
- Second item with \`code\`
- Third item with ~~strikethrough~~

> A blockquote with *italic* content.

Final paragraph with a [link](https://telegram.org).`;

async function tgCall(
  method: string,
  body: object,
): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Stream character by character, calling onChunk every N chars
async function* tokenStream(text: string, chunkSize = 8) {
  for (let i = chunkSize; i <= text.length; i += chunkSize) {
    yield text.slice(0, i);
    await sleep(80);
  }
  yield text;
}

// ─────────────────────────────────────────────────
// Test 1: editMessageText + MarkdownV2 + raw incomplete markdown
// ─────────────────────────────────────────────────
async function test1_rawMarkdownV2() {
  console.log("\n=== TEST 1: editMessageText + MarkdownV2 + raw incomplete markdown ===");
  const sent = await tgCall("sendMessage", {
    chat_id: CHAT_ID,
    text: "⏳ Test 1 starting...",
  });
  if (!sent.ok) {
    console.error("sendMessage failed:", sent.description);
    return;
  }
  const msgId = (sent.result as { message_id: number }).message_id;

  let errors = 0;
  let ok = 0;
  for await (const partial of tokenStream(FULL_MARKDOWN)) {
    const r = await tgCall("editMessageText", {
      chat_id: CHAT_ID,
      message_id: msgId,
      text: partial,
      parse_mode: "MarkdownV2",
    });
    if (r.ok) {
      ok++;
    } else {
      errors++;
      process.stdout.write("✗");
    }
    process.stdout.write(".");
  }
  console.log(`\n  Result: ${ok} OK, ${errors} errors`);
  await tgCall("editMessageText", {
    chat_id: CHAT_ID,
    message_id: msgId,
    text: `✅ Test 1 done — ${ok} OK, ${errors} errors (raw MarkdownV2)`,
  });
}

// ─────────────────────────────────────────────────
// Test 2: editMessageText + HTML + mdgram (safe streaming)
// ─────────────────────────────────────────────────
async function test2_mdgramHTML() {
  console.log("\n=== TEST 2: editMessageText + HTML + mdgram ===");
  const sent = await tgCall("sendMessage", {
    chat_id: CHAT_ID,
    text: "⏳ Test 2 starting...",
  });
  if (!sent.ok) {
    console.error("sendMessage failed:", sent.description);
    return;
  }
  const msgId = (sent.result as { message_id: number }).message_id;

  let errors = 0;
  let ok = 0;
  for await (const partial of tokenStream(FULL_MARKDOWN)) {
    const html = mdgram(partial);
    const r = await tgCall("editMessageText", {
      chat_id: CHAT_ID,
      message_id: msgId,
      text: html,
      parse_mode: "HTML",
    });
    if (r.ok) {
      ok++;
    } else {
      errors++;
      process.stdout.write("✗");
    }
    process.stdout.write(".");
  }
  console.log(`\n  Result: ${ok} OK, ${errors} errors`);
  await tgCall("editMessageText", {
    chat_id: CHAT_ID,
    message_id: msgId,
    text: `✅ Test 2 done — ${ok} OK, ${errors} errors (mdgram HTML)`,
  });
}

// ─────────────────────────────────────────────────
// Test 3: sendRichMessageDraft + raw incomplete markdown
// ─────────────────────────────────────────────────
async function test3_richDraftRawMarkdown() {
  console.log("\n=== TEST 3: sendRichMessageDraft + raw incomplete markdown ===");

  const DRAFT_ID = Math.floor(Math.random() * 1_000_000) + 1;
  let errors = 0;
  let ok = 0;

  for await (const partial of tokenStream(FULL_MARKDOWN)) {
    const r = await tgCall("sendRichMessageDraft", {
      chat_id: Number(CHAT_ID),
      draft_id: DRAFT_ID,
      rich_message: { markdown: partial },
    });
    if (r.ok) {
      ok++;
    } else {
      errors++;
      process.stdout.write("✗");
    }
    process.stdout.write(".");
  }
  console.log(`\n  Draft updates: ${ok} OK, ${errors} errors`);

  // Finalize with sendRichMessage
  const final = await tgCall("sendRichMessage", {
    chat_id: CHAT_ID,
    rich_message: { markdown: FULL_MARKDOWN },
  });
  console.log(`  sendRichMessage: ${final.ok ? "OK" : `ERROR: ${final.description}`}`);
}

// ─────────────────────────────────────────────────
// Test 4: sendRichMessageDraft + mdgram HTML in html field
// ─────────────────────────────────────────────────
async function test4_richDraftMdgramHTML() {
  console.log("\n=== TEST 4: sendRichMessageDraft + mdgram in html field ===");

  const DRAFT_ID = Math.floor(Math.random() * 1_000_000) + 1;
  let errors = 0;
  let ok = 0;

  for await (const partial of tokenStream(FULL_MARKDOWN)) {
    const html = mdgram(partial);
    const r = await tgCall("sendRichMessageDraft", {
      chat_id: Number(CHAT_ID),
      draft_id: DRAFT_ID,
      rich_message: { html },
    });
    if (r.ok) {
      ok++;
    } else {
      errors++;
      process.stdout.write("✗");
    }
    process.stdout.write(".");
  }
  console.log(`\n  Draft updates: ${ok} OK, ${errors} errors`);

  const final = await tgCall("sendRichMessage", {
    chat_id: CHAT_ID,
    rich_message: { html: mdgram(FULL_MARKDOWN) },
  });
  console.log(`  sendRichMessage: ${final.ok ? "OK" : `ERROR: ${final.description}`}`);
}

// ─────────────────────────────────────────────────
// Test 5: sendRichMessageDraft + RichBlockThinking placeholder
// ─────────────────────────────────────────────────
async function test5_thinkingBlock() {
  console.log("\n=== TEST 5: sendRichMessageDraft with <tg-thinking> placeholder ===");

  const DRAFT_ID = Math.floor(Math.random() * 1_000_000) + 1;

  // First show "thinking" state
  const r1 = await tgCall("sendRichMessageDraft", {
    chat_id: Number(CHAT_ID),
    draft_id: DRAFT_ID,
    rich_message: { html: "<tg-thinking>Generating response…</tg-thinking>" },
  });
  console.log(`  Thinking block: ${r1.ok ? "OK" : `ERROR: ${r1.description}`}`);
  await sleep(2000);

  // Then stream in real content
  let ok = 0;
  let errors = 0;
  for await (const partial of tokenStream(FULL_MARKDOWN)) {
    const html = mdgram(partial);
    const r = await tgCall("sendRichMessageDraft", {
      chat_id: Number(CHAT_ID),
      draft_id: DRAFT_ID,
      rich_message: { html },
    });
    if (r.ok) {
      ok++;
    } else {
      errors++;
    }
    process.stdout.write(".");
  }
  console.log(`\n  Content stream: ${ok} OK, ${errors} errors`);

  const final = await tgCall("sendRichMessage", {
    chat_id: CHAT_ID,
    rich_message: { html: mdgram(FULL_MARKDOWN) },
  });
  console.log(`  Finalized: ${final.ok ? "OK" : `ERROR: ${final.description}`}`);
}

// Run all tests sequentially
(async () => {
  console.log("Telegram Streaming Test");
  console.log(`Chat ID: ${CHAT_ID}`);
  console.log(`Markdown length: ${FULL_MARKDOWN.length} chars`);

  await test1_rawMarkdownV2();
  await sleep(1000);
  await test2_mdgramHTML();
  await sleep(1000);
  await test3_richDraftRawMarkdown();
  await sleep(1000);
  await test4_richDraftMdgramHTML();
  await sleep(1000);
  await test5_thinkingBlock();

  console.log("\n✅ All tests complete. Observe Telegram for visual results.");
})();
