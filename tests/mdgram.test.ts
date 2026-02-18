import { parse_html } from "@telegraf/entity";
import { describe, expect, it } from "vitest";
import { mdgram } from "../src/index.js";

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

const cases: TestCase[] = [
  {
    name: "empty string",
    input: "",
    expected: "",
  },
  {
    name: "only spaces",
    input: "   ",
    expected: "",
  },
  {
    name: "only newlines",
    input: "\n\n\n",
    expected: "",
  },
  {
    name: "only tabs",
    input: "\t\t",
    expected: "",
  },
  {
    name: "mixed whitespace",
    input: " \n \t \n ",
    expected: "",
  },
  {
    name: "plain text",
    input: "Hello world",
    expected: "Hello world",
  },
  {
    name: "bold",
    input: "**bold**",
    expected: "<b>bold</b>",
  },
  {
    name: "italic with asterisk",
    input: "*italic*",
    expected: "<i>italic</i>",
  },
  {
    name: "italic with underscore",
    input: "_italic_",
    expected: "<i>italic</i>",
  },
  {
    name: "inline code",
    input: "`code`",
    expected: "<code>code</code>",
  },
  {
    name: "code block with language",
    input: "```js\nconsole.log(1)\n```",
    expected: '<pre><code class="language-js">console.log(1)</code></pre>',
  },
  {
    name: "code block without language",
    input: "```\nhello\n```",
    expected: "<pre>hello</pre>",
  },
  {
    name: "link",
    input: "[click](https://t.me)",
    expected: '<a href="https://t.me">click</a>',
  },
  {
    name: "strikethrough",
    input: "~~deleted~~",
    expected: "<s>deleted</s>",
  },
  {
    name: "mixed bold and italic",
    input: "**bold** and *italic*",
    expected: "<b>bold</b> and <i>italic</i>",
  },
  {
    name: "nested bold + italic",
    input: "***bold italic***",
    expected: "<i><b>bold italic</b></i>",
  },
  {
    name: "multiline paragraphs",
    input: "line1\n\nline2",
    expected: "line1\n\nline2",
  },
  {
    name: "html escaping",
    input: "<script>alert(1)</script>",
    expected: "&lt;script&gt;alert(1)&lt;/script&gt;",
  },
  {
    name: "special chars in code block",
    input: "```\n<div>&</div>\n```",
    expected: "<pre>&lt;div&gt;&amp;&lt;/div&gt;</pre>",
  },
  {
    name: "bold with link inside",
    input: "**[click](https://t.me)**",
    expected: '<b><a href="https://t.me">click</a></b>',
  },
  {
    name: "ampersand in text",
    input: "A & B",
    expected: "A &amp; B",
  },
  {
    name: "underscore bold",
    input: "__bold__",
    expected: "<b>bold</b>",
  },
  {
    name: "heading h1",
    input: "# Heading",
    expected: "<b>Heading</b>",
  },
  {
    name: "heading h3",
    input: "### Sub heading",
    expected: "<b>Sub heading</b>",
  },
  {
    name: "blockquote",
    input: "> quoted text",
    expected: "<blockquote>quoted text</blockquote>",
  },
  {
    name: "multi-line blockquote",
    input: "> line1\n> line2",
    expected: "<blockquote>line1\nline2</blockquote>",
  },
  {
    name: "blockquote with bold",
    input: "> **bold** quote",
    expected: "<blockquote><b>bold</b> quote</blockquote>",
  },
  {
    name: "blockquote then text",
    input: "> quote\n\nnormal text",
    expected: "<blockquote>quote</blockquote>\n\nnormal text",
  },
  {
    name: "unordered list",
    input: "- item 1\n- item 2",
    expected: "• item 1\n• item 2",
  },
  {
    name: "ordered list",
    input: "1. first\n2. second",
    expected: "1. first\n2. second",
  },
  {
    name: "ordered list 3 items",
    input: "1. first\n2. second\n3. third",
    expected: "1. first\n2. second\n3. third",
  },
  {
    name: "list with bold",
    input: "- **bold** item",
    expected: "• <b>bold</b> item",
  },
  {
    name: "list with code",
    input: "- use `npm i` cmd",
    expected: "• use <code>npm i</code> cmd",
  },
  {
    name: "link with & in URL",
    input: "[go](https://example.com?a=1&b=2)",
    expected: '<a href="https://example.com?a=1&amp;b=2">go</a>',
  },
  {
    name: "code block preserves markdown",
    input: "```\n**not bold**\n```",
    expected: "<pre>**not bold**</pre>",
  },
  {
    name: "inline code preserves markdown",
    input: "`**not bold**`",
    expected: "<code>**not bold**</code>",
  },
  {
    name: "single line break",
    input: "line1\nline2",
    expected: "line1\nline2",
  },
  {
    name: "incomplete bold (streaming)",
    input: "**not closed",
    expected: "<b>not closed</b>",
  },
  {
    name: "spoiler",
    input: "||hidden||",
    expected: "<tg-spoiler>hidden</tg-spoiler>",
  },
  {
    name: "spoiler with formatting inside",
    input: "||**bold** hidden||",
    expected: "<tg-spoiler><b>bold</b> hidden</tg-spoiler>",
  },
  {
    name: "text around spoiler",
    input: "visible ||hidden|| visible",
    expected: "visible <tg-spoiler>hidden</tg-spoiler> visible",
  },
  {
    name: "incomplete spoiler (streaming)",
    input: "||not closed",
    expected: "<tg-spoiler>not closed</tg-spoiler>",
  },
  {
    name: "special chars in inline code",
    input: "`a < b && c > d`",
    expected: "<code>a &lt; b &amp;&amp; c &gt; d</code>",
  },
  {
    name: "nested bold in italic",
    input: "*text **bold** text*",
    expected: "<i>text <b>bold</b> text</i>",
  },
  {
    name: "code inside bold",
    input: "**use `npm`**",
    expected: "<b>use <code>npm</code></b>",
  },
  {
    name: "multiline code block",
    input: "```python\ndef foo():\n    return 42\n```",
    expected: '<pre><code class="language-python">def foo():\n    return 42</code></pre>',
  },
  {
    name: "multiple paragraphs with formatting",
    input: "**first**\n\n*second*\n\nthird",
    expected: "<b>first</b>\n\n<i>second</i>\n\nthird",
  },
  {
    name: "bold + strikethrough",
    input: "**~~both~~**",
    expected: "<b><s>both</s></b>",
  },
  {
    name: "heading with code",
    input: "# Use `npm`",
    expected: "<b>Use <code>npm</code></b>",
  },
  {
    name: "list with links",
    input: "- [a](https://a.com)\n- [b](https://b.com)",
    expected: '• <a href="https://a.com">a</a>\n• <a href="https://b.com">b</a>',
  },
  {
    name: "table with aligned columns",
    input: "| Name | Age |\n|---|---|\n| Alice | 30 |\n| Bob | 25 |",
    expected: "<pre>Name  | Age\n------+----\nAlice | 30 \nBob   | 25 </pre>",
  },
  {
    name: "table 3 columns",
    input:
      "| Method | Time | Status |\n|---|---|---|\n| GET | 120ms | OK |\n| POST | 3500ms | Error |",
    expected:
      "<pre>Method | Time   | Status\n-------+--------+-------\nGET    | 120ms  | OK    \nPOST   | 3500ms | Error </pre>",
  },
  {
    name: "image becomes alt text",
    input: "![alt text](https://example.com/img.png)",
    expected: "alt text",
  },
  {
    name: "horizontal rule",
    input: "text\n\n---\n\nmore",
    expected: "text\n\n\n\nmore",
  },
  {
    name: "unicode and emoji",
    input: "Привет 🎉 мир",
    expected: "Привет 🎉 мир",
  },
  {
    name: "link with quote in URL (escAttr)",
    input: '[link](https://example.com?q="test")',
    expected: '<a href="https://example.com?q=&quot;test&quot;">link</a>',
  },
  {
    name: "multiple empty lines collapsed",
    input: "line1\n\n\n\nline2",
    expected: "line1\n\nline2",
  },
];

/**
 * For each test case, iterates character by character from empty string
 * to the full input. At each step:
 * 1. mdgram(partial) must not throw
 * 2. parse_html(result) must not throw (valid Telegram HTML)
 * 3. At the final step, result must equal expected
 */
function runStreamingTest(tc: TestCase) {
  if (tc.input.length === 0) {
    expect(mdgram(tc.input)).toBe(tc.expected);
    return;
  }
  for (let i = 1; i <= tc.input.length; i++) {
    const partial = tc.input.slice(0, i);
    const html = mdgram(partial);

    // Result must be valid Telegram HTML
    expect(() => {
      parse_html(html);
    }).not.toThrow();

    // Final step: check expected output
    if (i === tc.input.length) {
      expect(html).toBe(tc.expected);
    }
  }
}

describe("mdgram streaming", () => {
  for (const tc of cases) {
    it(tc.name, () => {
      runStreamingTest(tc);
    });
  }
});
