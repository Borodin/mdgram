import { parse_html } from "@telegraf/entity";
import { describe, expect, it } from "vitest";
import { CAPTION_LIMIT, MESSAGE_LIMIT, mdgram, textLength, truncate } from "../src/index.js";

/** Reference length via @telegraf/entity parser */
function refLength(html: string): number {
  return parse_html(html).text.length;
}

describe("textLength", () => {
  const cases = [
    { name: "plain text", html: "hello" },
    { name: "bold tags", html: "<b>hello</b>" },
    { name: "HTML entity", html: "&amp;" },
    { name: "text with entity", html: "A &amp; B" },
    { name: "nested tags", html: '<a href="https://t.me"><b>click</b></a>' },
    { name: "newlines", html: "a\nb" },
    { name: "tg-spoiler", html: "<tg-spoiler>hidden</tg-spoiler>" },
    { name: "bold + italic", html: "<b><i>text</i></b>" },
    { name: "code block", html: '<pre><code class="language-js">let x = 1;</code></pre>' },
    { name: "multiple entities", html: "a &lt; b &amp;&amp; c &gt; d" },
  ];

  for (const { name, html } of cases) {
    it(`${name}: matches @telegraf/entity`, () => {
      expect(textLength(html)).toBe(refLength(html));
    });
  }

  it("counts emoji as 2 (UTF-16 surrogate pair)", () => {
    expect(textLength("🎉")).toBe(2);
    expect(textLength("hi 🎉")).toBe(5);
  });
});

describe("truncate", () => {
  it("returns as-is when within limit", () => {
    expect(truncate("<b>short</b>", 100)).toBe("<b>short</b>");
  });

  it("truncates plain text and adds ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc\u2026");
  });

  it("closes open tags after truncation", () => {
    const result = truncate("<b>long bold text</b>", 6);
    expect(result).toBe("<b>long \u2026</b>");
    // Must be valid Telegram HTML
    expect(() => parse_html(result)).not.toThrow();
  });

  it("closes nested tags correctly", () => {
    const result = truncate("<b><i>nested text</i></b>", 6);
    expect(result).toBe("<b><i>neste\u2026</i></b>");
    expect(() => parse_html(result)).not.toThrow();
  });

  it("counts HTML entities as 1 char", () => {
    // "&amp;" = 1 visible char, total: a + & + b = 3 chars
    const result = truncate("a&amp;b", 3);
    expect(result).toBe("a&amp;b");
  });

  it("truncates when entity pushes over limit", () => {
    // "a&amp;bcd" = 5 visible chars, limit 4 → "a&amp;b…" (3 + ellipsis)
    const result = truncate("a&amp;bcd", 4);
    expect(result).toBe("a&amp;b\u2026");
  });

  it("handles maxLength 0", () => {
    expect(truncate("hello", 0)).toBe("");
  });

  it("handles maxLength 1", () => {
    expect(truncate("hello", 1)).toBe("\u2026");
  });

  it("handles tg-spoiler tag", () => {
    const result = truncate("<tg-spoiler>long hidden text</tg-spoiler>", 6);
    expect(result).toBe("<tg-spoiler>long \u2026</tg-spoiler>");
    expect(() => parse_html(result)).not.toThrow();
  });

  it("handles code blocks", () => {
    const result = truncate('<pre><code class="language-js">const x = 1;</code></pre>', 8);
    expect(result).toBe('<pre><code class="language-js">const x\u2026</code></pre>');
    expect(() => parse_html(result)).not.toThrow();
  });

  it("produces valid Telegram HTML for complex content", () => {
    const html = mdgram("**bold** and *italic* and `code` and [link](https://t.me)");
    const result = truncate(html, 15);
    expect(() => parse_html(result)).not.toThrow();
    expect(textLength(result)).toBeLessThanOrEqual(15);
    expect(textLength(result)).toBe(refLength(result));
  });
});

describe("mdgram with maxLength", () => {
  it("truncates when maxLength is set", () => {
    const long = "a".repeat(5000);
    const result = mdgram(long, { maxLength: MESSAGE_LIMIT });
    expect(textLength(result)).toBeLessThanOrEqual(MESSAGE_LIMIT);
  });

  it("does not truncate short messages", () => {
    const result = mdgram("**hello**", { maxLength: MESSAGE_LIMIT });
    expect(result).toBe("<b>hello</b>");
  });

  it("works with CAPTION_LIMIT", () => {
    const long = "word ".repeat(300);
    const result = mdgram(long, { maxLength: CAPTION_LIMIT });
    expect(textLength(result)).toBeLessThanOrEqual(CAPTION_LIMIT);
  });

  it("truncated output is always valid Telegram HTML", () => {
    const md = "**bold** *italic* `code` ~~strike~~ ||spoiler|| [link](https://t.me) ".repeat(100);
    const result = mdgram(md, { maxLength: 50 });
    expect(() => parse_html(result)).not.toThrow();
    expect(textLength(result)).toBeLessThanOrEqual(50);
    expect(textLength(result)).toBe(refLength(result));
  });
});

function isValidUnicode(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

describe("truncate — surrogate pairs", () => {
  it("never produces lone surrogates in plain text", () => {
    // "abc🎉" = 5 UTF-16 code units (a, b, c, high, low)
    for (let max = 1; max <= 6; max++) {
      const result = truncate("abc🎉", max);
      expect(isValidUnicode(result), `maxLength=${max}: lone surrogate`).toBe(true);
    }
  });

  it("never produces lone surrogates in tagged html", () => {
    // "<b>abc🎉def</b>" — emoji is inside tags
    for (let max = 1; max <= 10; max++) {
      const result = truncate("<b>abc🎉def</b>", max);
      expect(isValidUnicode(result), `maxLength=${max}: lone surrogate`).toBe(true);
      expect(() => parse_html(result)).not.toThrow();
    }
  });

  it("never produces lone surrogates with multiple emoji", () => {
    for (let max = 1; max <= 15; max++) {
      const result = truncate("a🎉b🔥c❤️d", max);
      expect(isValidUnicode(result), `maxLength=${max}: lone surrogate`).toBe(true);
    }
  });

  it("truncates before emoji when cut lands on high surrogate", () => {
    // "abc🎉def" has textLength 8 (a,b,c,🎉=2,d,e,f)
    // maxLength=5 → effectiveMax=4 → can fit abc (3) but not 🎉 (needs 2 more, total 5 > 4)
    // should skip emoji and truncate: "abc…"
    const result = truncate("abc🎉def", 5);
    expect(result).toBe("abc\u2026");
    expect(isValidUnicode(result)).toBe(true);
  });

  it("includes emoji when both code units fit", () => {
    // maxLength=6 → effectiveMax=5 → both code units of 🎉 fit
    const result = truncate("abc🎉def", 6);
    expect(result).toBe("abc🎉\u2026");
    expect(isValidUnicode(result)).toBe(true);
  });

  it("handles emoji at start of truncation boundary in tags", () => {
    const result = truncate("<b>🎉abc</b>", 3);
    expect(isValidUnicode(result)).toBe(true);
    expect(() => parse_html(result)).not.toThrow();
  });

  it("handles consecutive emoji", () => {
    // "🎉🔥" = 4 UTF-16 code units
    for (let max = 1; max <= 5; max++) {
      const result = truncate("🎉🔥", max);
      expect(isValidUnicode(result), `maxLength=${max}: lone surrogate`).toBe(true);
    }
  });

  it("mdgram truncation with emoji produces valid output", () => {
    const result = mdgram("Привет 🎉🔥 **мир**", { maxLength: 10 });
    expect(isValidUnicode(result)).toBe(true);
    expect(() => parse_html(result)).not.toThrow();
    expect(textLength(result)).toBeLessThanOrEqual(10);
  });
});

describe("constants", () => {
  it("MESSAGE_LIMIT is 4096", () => {
    expect(MESSAGE_LIMIT).toBe(4096);
  });

  it("CAPTION_LIMIT is 1024", () => {
    expect(CAPTION_LIMIT).toBe(1024);
  });
});
