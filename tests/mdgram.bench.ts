import { bench, describe } from "vitest";
import { MESSAGE_LIMIT, mdgram, textLength, truncate } from "../src/index.js";

// --- Generators ---

function plain(n: number): string {
  return "word ".repeat(n / 5);
}

function richFormatting(n: number): string {
  const block = "**bold** *italic* ~~strike~~ `code` [link](https://t.me) ||spoiler|| ";
  return block.repeat(Math.ceil(n / block.length)).slice(0, n);
}

function codeBlocks(n: number): string {
  const line = "const x = arr.map(v => v < 10 && v > 0);\n";
  const body = line.repeat(Math.ceil(n / line.length)).slice(0, n);
  return `\`\`\`ts\n${body}\`\`\``;
}

function heavyEscaping(n: number): string {
  return '<div class="a">&amp;</div> '.repeat(n / 30);
}

function nestedFormatting(n: number): string {
  const block = "**bold *italic ~~strike `code`~~* end** normal text here. ";
  return block.repeat(Math.ceil(n / block.length)).slice(0, n);
}

function manyListItems(count: number): string {
  return Array.from({ length: count }, (_, i) => `- Item **${i + 1}** with \`code\``).join("\n");
}

function largeTable(rows: number): string {
  const header = "| Name | Value | Status |";
  const sep = "|---|---|---|";
  const line = (i: number) => `| item_${i} | ${i * 100} | ${"OK"} |`;
  return [header, sep, ...Array.from({ length: rows }, (_, i) => line(i))].join("\n");
}

function mixedContent(): string {
  return [
    "# API Reference",
    "",
    "The `mdgram` function converts **Markdown** to *Telegram HTML*.",
    "",
    "```ts",
    'import { mdgram } from "mdgram";',
    'const html = mdgram("**hello**");',
    "```",
    "",
    "> **Note:** supports ||spoiler|| syntax",
    "",
    "## Features",
    "",
    "- **Streaming** — safe at every step",
    "- **Truncation** — respects [Telegram limits](https://core.telegram.org/bots/api)",
    "- ~~Deprecated~~ `oldFunc()` removed",
    "",
    "| Format | Tag |",
    "|---|---|",
    "| bold | `<b>` |",
    "| italic | `<i>` |",
  ].join("\n");
}

// --- Benchmarks ---

describe("mdgram — content types", () => {
  const size = 4_000;

  bench("plain text", () => mdgram(plain(size)));
  bench("rich formatting", () => mdgram(richFormatting(size)));
  bench("code blocks", () => mdgram(codeBlocks(size)));
  bench("heavy escaping", () => mdgram(heavyEscaping(size)));
  bench("nested formatting", () => mdgram(nestedFormatting(size)));
  bench("list (200 items)", () => mdgram(manyListItems(200)));
  bench("table (100 rows)", () => mdgram(largeTable(100)));
  bench("mixed realistic", () => mdgram(mixedContent()));
});

describe("mdgram — scaling (rich formatting)", () => {
  bench("1 KB", () => mdgram(richFormatting(1_000)));
  bench("4 KB", () => mdgram(richFormatting(4_000)));
  bench("16 KB", () => mdgram(richFormatting(16_000)));
  bench("32 KB", () => mdgram(richFormatting(32_000)));
});

describe("truncate", () => {
  const longHtml = mdgram(richFormatting(16_000));

  bench("textLength 16 KB html", () => textLength(longHtml));
  bench("truncate to MESSAGE_LIMIT", () => truncate(longHtml, MESSAGE_LIMIT));
  bench("truncate to 200 chars", () => truncate(longHtml, 200));
  bench("no-op (within limit)", () => truncate("<b>short</b>", MESSAGE_LIMIT));
});

describe("streaming simulation", () => {
  const full = mixedContent();

  bench("char-by-char (full message)", () => {
    for (let i = 1; i <= full.length; i++) {
      mdgram(full.slice(0, i));
    }
  });

  bench("token-by-token ~20 char chunks", () => {
    for (let i = 20; i <= full.length; i += 20) {
      mdgram(full.slice(0, i));
    }
  });
});
