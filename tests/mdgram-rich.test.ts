import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { mdgram, mdgramRich } from "../src/index.js";

// ─── Rich HTML validator ───────────────────────────────────────────────────
//
// Validates that mdgramRich output:
//   1. Parses as valid HTML (node-html-parser, not regex)
//   2. Uses only tags from the Telegram Rich HTML spec
//
// Source: https://core.telegram.org/bots/api#rich-html-style

const VALID_RICH_TAGS = new Set([
  // Inline formatting
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ins",
  "s",
  "strike",
  "del",
  "code",
  "mark",
  "sub",
  "sup",
  "tg-spoiler",
  "a",
  "br",
  // Block formatting
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "pre",
  "blockquote",
  "hr",
  "ul",
  "ol",
  "li",
  "input",
  "table",
  "tr",
  "th",
  "td",
  "footer",
  "aside",
  "cite",
  "details",
  "summary",
  "figure",
  "figcaption",
  "img",
  "video",
  "audio",
  // Telegram-specific
  "tg-math",
  "tg-math-block",
  "tg-spoiler",
  "tg-thinking",
  "tg-emoji",
  "tg-time",
  "tg-reference",
  "tg-collage",
  "tg-slideshow",
  "tg-map",
]);

function assertValidRichHtml(html: string): void {
  if (!html) return;
  const root = parse(html);

  function walk(node: ReturnType<typeof parse>): void {
    const tag = node.rawTagName;
    if (tag) {
      expect(
        VALID_RICH_TAGS.has(tag.toLowerCase()),
        `Invalid Rich HTML tag <${tag.toLowerCase()}> in: ${html.slice(0, 80)}`,
      ).toBe(true);
    }
    for (const child of node.childNodes) {
      walk(child as ReturnType<typeof parse>);
    }
  }

  walk(root);
}

// ─── Test runner ───────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

function runStreamingTest(tc: TestCase): void {
  if (tc.input.length === 0) {
    expect(mdgramRich(tc.input)).toBe(tc.expected);
    return;
  }
  for (let i = 1; i <= tc.input.length; i++) {
    const partial = tc.input.slice(0, i);
    let html!: string;

    expect(() => {
      html = mdgramRich(partial);
    }, `mdgramRich threw at char ${i}`).not.toThrow();

    expect(
      () => {
        assertValidRichHtml(html);
      },
      `Invalid Rich HTML at char ${i}: ${JSON.stringify(html)}`,
    ).not.toThrow();

    if (i === tc.input.length) {
      expect(html).toBe(tc.expected);
    }
  }
}

// ─── Test cases ────────────────────────────────────────────────────────────

const cases: TestCase[] = [
  // ── Headings ──────────────────────────────────────────────────────────────
  { name: "h1", input: "# H1", expected: "<h1>H1</h1>" },
  { name: "h2", input: "## H2", expected: "<h2>H2</h2>" },
  { name: "h3", input: "### H3", expected: "<h3>H3</h3>" },
  { name: "h4", input: "#### H4", expected: "<h4>H4</h4>" },
  { name: "h5", input: "##### H5", expected: "<h5>H5</h5>" },
  { name: "h6", input: "###### H6", expected: "<h6>H6</h6>" },
  { name: "h1 with bold", input: "# **Bold** heading", expected: "<h1><b>Bold</b> heading</h1>" },
  { name: "h2 with code", input: "## Use `npm`", expected: "<h2>Use <code>npm</code></h2>" },
  { name: "h3 with italic", input: "### *italic*", expected: "<h3><i>italic</i></h3>" },
  {
    name: "h4 with link",
    input: "#### [title](https://t.me)",
    expected: '<h4><a href="https://t.me">title</a></h4>',
  },
  {
    name: "h1 with highlight",
    input: "# ==marked== title",
    expected: "<h1><mark>marked</mark> title</h1>",
  },
  {
    name: "h2 with latex inline",
    input: "## Formula $x^2$",
    expected: "<h2>Formula <tg-math>x^2</tg-math></h2>",
  },

  // ── Unordered lists ────────────────────────────────────────────────────────
  {
    name: "ul simple",
    input: "- item 1\n- item 2",
    expected: "<ul>\n<li>item 1</li>\n<li>item 2</li>\n</ul>",
  },
  { name: "ul single", input: "- only", expected: "<ul>\n<li>only</li>\n</ul>" },
  {
    name: "ul with bold",
    input: "- **bold** item",
    expected: "<ul>\n<li><b>bold</b> item</li>\n</ul>",
  },
  {
    name: "ul with italic",
    input: "- *italic* item",
    expected: "<ul>\n<li><i>italic</i> item</li>\n</ul>",
  },
  {
    name: "ul with code",
    input: "- `code` item",
    expected: "<ul>\n<li><code>code</code> item</li>\n</ul>",
  },
  {
    name: "ul with link",
    input: "- [click](https://t.me)",
    expected: '<ul>\n<li><a href="https://t.me">click</a></li>\n</ul>',
  },
  {
    name: "ul with strikethrough",
    input: "- ~~old~~ new",
    expected: "<ul>\n<li><s>old</s> new</li>\n</ul>",
  },
  {
    name: "ul with spoiler",
    input: "- ||secret||",
    expected: "<ul>\n<li><tg-spoiler>secret</tg-spoiler></li>\n</ul>",
  },
  {
    name: "ul with highlight",
    input: "- ==key== point",
    expected: "<ul>\n<li><mark>key</mark> point</li>\n</ul>",
  },
  {
    name: "ul with latex",
    input: "- formula $x^2$",
    expected: "<ul>\n<li>formula <tg-math>x^2</tg-math></li>\n</ul>",
  },
  {
    name: "ul loose bold",
    input: "- **A**\n\n- **B**",
    expected: "<ul>\n<li><b>A</b></li>\n<li><b>B</b></li>\n</ul>",
  },
  {
    name: "ul loose mixed",
    input: "- `code`\n\n- *italic*",
    expected: "<ul>\n<li><code>code</code></li>\n<li><i>italic</i></li>\n</ul>",
  },

  // ── Nested lists ───────────────────────────────────────────────────────────
  {
    name: "ul nested 2 levels",
    input: "- item 1\n  - nested",
    expected: "<ul>\n<li>item 1<ul>\n<li>nested</li>\n</ul></li>\n</ul>",
  },
  {
    name: "ul nested 3 levels",
    input: "- l1\n  - l2\n    - l3",
    expected: "<ul>\n<li>l1<ul>\n<li>l2<ul>\n<li>l3</li>\n</ul></li>\n</ul></li>\n</ul>",
  },
  {
    name: "ol nested in ul",
    input: "- outer\n  1. inner a\n  2. inner b",
    expected: "<ul>\n<li>outer<ol>\n<li>inner a</li>\n<li>inner b</li>\n</ol></li>\n</ul>",
  },
  {
    name: "ul nested with formatting",
    input: "- **parent**\n  - *child*",
    expected: "<ul>\n<li><b>parent</b><ul>\n<li><i>child</i></li>\n</ul></li>\n</ul>",
  },

  // ── Ordered lists ──────────────────────────────────────────────────────────
  {
    name: "ol simple",
    input: "1. first\n2. second",
    expected: "<ol>\n<li>first</li>\n<li>second</li>\n</ol>",
  },
  { name: "ol single", input: "1. only", expected: "<ol>\n<li>only</li>\n</ol>" },
  {
    name: "ol start 3",
    input: "3. third\n4. fourth",
    expected: '<ol start="3">\n<li>third</li>\n<li>fourth</li>\n</ol>',
  },
  {
    name: "ol start 0",
    input: "0. zero\n1. one",
    expected: '<ol start="0">\n<li>zero</li>\n<li>one</li>\n</ol>',
  },
  {
    name: "ol start 10",
    input: "10. ten\n11. eleven",
    expected: '<ol start="10">\n<li>ten</li>\n<li>eleven</li>\n</ol>',
  },
  {
    name: "ol with bold",
    input: "1. **bold** item",
    expected: "<ol>\n<li><b>bold</b> item</li>\n</ol>",
  },
  {
    name: "ol with code",
    input: "1. run `npm start`",
    expected: "<ol>\n<li>run <code>npm start</code></li>\n</ol>",
  },
  {
    name: "ol loose bold",
    input: "1. **A**\n\n2. **B**",
    expected: "<ol>\n<li><b>A</b></li>\n<li><b>B</b></li>\n</ol>",
  },

  // ── Task lists ─────────────────────────────────────────────────────────────
  {
    name: "task unchecked",
    input: "- [ ] todo",
    expected: '<ul>\n<li><input type="checkbox">todo</li>\n</ul>',
  },
  {
    name: "task checked",
    input: "- [x] done",
    expected: '<ul>\n<li><input type="checkbox" checked>done</li>\n</ul>',
  },
  {
    name: "task uppercase X",
    input: "- [X] done",
    expected: '<ul>\n<li><input type="checkbox" checked>done</li>\n</ul>',
  },
  {
    name: "task mixed",
    input: "- [ ] pending\n- [x] complete",
    expected:
      '<ul>\n<li><input type="checkbox">pending</li>\n<li><input type="checkbox" checked>complete</li>\n</ul>',
  },
  {
    name: "task with bold",
    input: "- [ ] **important** task",
    expected: '<ul>\n<li><input type="checkbox"><b>important</b> task</li>\n</ul>',
  },
  {
    name: "task with code",
    input: "- [x] run `npm test`",
    expected: '<ul>\n<li><input type="checkbox" checked>run <code>npm test</code></li>\n</ul>',
  },

  // ── Tables ─────────────────────────────────────────────────────────────────
  {
    name: "table simple",
    input: "| A | B |\n|---|---|\n| 1 | 2 |",
    expected: "<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td>1</td><td>2</td></tr>\n</table>",
  },
  {
    name: "table align left",
    input: "| Name |\n|:-----|\n| Alice |",
    expected:
      '<table>\n<tr><th align="left">Name</th></tr>\n<tr><td align="left">Alice</td></tr>\n</table>',
  },
  {
    name: "table align right",
    input: "| Num |\n|----:|\n| 42 |",
    expected:
      '<table>\n<tr><th align="right">Num</th></tr>\n<tr><td align="right">42</td></tr>\n</table>',
  },
  {
    name: "table align center",
    input: "| S |\n|:--:|\n| ok |",
    expected:
      '<table>\n<tr><th align="center">S</th></tr>\n<tr><td align="center">ok</td></tr>\n</table>',
  },
  {
    name: "table all alignments",
    input: "| L | C | R |\n|:--|:--:|--:|\n| a | b | c |",
    expected:
      '<table>\n<tr><th align="left">L</th><th align="center">C</th><th align="right">R</th></tr>\n<tr><td align="left">a</td><td align="center">b</td><td align="right">c</td></tr>\n</table>',
  },
  {
    name: "table bold header",
    input: "| **Bold** | Normal |\n|---|---|\n| 1 | 2 |",
    expected:
      "<table>\n<tr><th><b>Bold</b></th><th>Normal</th></tr>\n<tr><td>1</td><td>2</td></tr>\n</table>",
  },
  {
    name: "table code header",
    input: "| `code` | text |\n|---|---|\n| a | b |",
    expected:
      "<table>\n<tr><th><code>code</code></th><th>text</th></tr>\n<tr><td>a</td><td>b</td></tr>\n</table>",
  },
  {
    name: "table inline formatting in cells",
    input: "| A | B |\n|---|---|\n| **bold** | *italic* |",
    expected:
      "<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td><b>bold</b></td><td><i>italic</i></td></tr>\n</table>",
  },
  {
    name: "table multiple rows",
    input: "| Name | Age |\n|---|---|\n| Alice | 30 |\n| Bob | 25 |",
    expected:
      "<table>\n<tr><th>Name</th><th>Age</th></tr>\n<tr><td>Alice</td><td>30</td></tr>\n<tr><td>Bob</td><td>25</td></tr>\n</table>",
  },
  {
    name: "table empty cell",
    input: "| A | B |\n|---|---|\n| | value |",
    expected: "<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td></td><td>value</td></tr>\n</table>",
  },
  {
    name: "table html escaping in cells",
    input: "| A |\n|---|\n| <b>raw</b> |",
    expected: "<table>\n<tr><th>A</th></tr>\n<tr><td>&lt;b&gt;raw&lt;/b&gt;</td></tr>\n</table>",
  },
  {
    name: "table with highlight in cell",
    input: "| Status |\n|---|\n| ==ok== |",
    expected: "<table>\n<tr><th>Status</th></tr>\n<tr><td><mark>ok</mark></td></tr>\n</table>",
  },
  {
    name: "table with latex in cell",
    input: "| Formula |\n|---|\n| $x^2$ |",
    expected:
      "<table>\n<tr><th>Formula</th></tr>\n<tr><td><tg-math>x^2</tg-math></td></tr>\n</table>",
  },

  // ── Highlight ==...== ──────────────────────────────────────────────────────
  { name: "highlight simple", input: "==marked==", expected: "<p><mark>marked</mark></p>" },
  {
    name: "highlight in sentence",
    input: "This is ==important== text",
    expected: "<p>This is <mark>important</mark> text</p>",
  },
  {
    name: "highlight multi-word",
    input: "==multi word==",
    expected: "<p><mark>multi word</mark></p>",
  },
  { name: "highlight single = inside", input: "==a=b==", expected: "<p><mark>a=b</mark></p>" },
  {
    name: "bold around highlight",
    input: "**==both==**",
    expected: "<p><b><mark>both</mark></b></p>",
  },
  {
    name: "italic around highlight",
    input: "*==both==*",
    expected: "<p><i><mark>both</mark></i></p>",
  },
  { name: "highlight incomplete streaming", input: "==mark", expected: "<p><mark>mark</mark></p>" },
  {
    name: "two highlights",
    input: "==a== and ==b==",
    expected: "<p><mark>a</mark> and <mark>b</mark></p>",
  },

  // ── LaTeX inline $...$ ─────────────────────────────────────────────────────
  { name: "latex inline simple", input: "$x^2$", expected: "<p><tg-math>x^2</tg-math></p>" },
  {
    name: "latex inline complex",
    input: "$x^2 + y^2 = r^2$",
    expected: "<p><tg-math>x^2 + y^2 = r^2</tg-math></p>",
  },
  {
    name: "latex inline with backslash",
    input: "$\\alpha + \\beta$",
    expected: "<p><tg-math>\\alpha + \\beta</tg-math></p>",
  },
  {
    name: "latex inline in sentence",
    input: "Area is $\\pi r^2$ square units",
    expected: "<p>Area is <tg-math>\\pi r^2</tg-math> square units</p>",
  },
  {
    name: "two latex inline",
    input: "$a$ and $b$",
    expected: "<p><tg-math>a</tg-math> and <tg-math>b</tg-math></p>",
  },
  {
    name: "latex inline escaping",
    input: "$x < y$",
    expected: "<p><tg-math>x &lt; y</tg-math></p>",
  },
  {
    name: "latex inline in bold",
    input: "**$x^2$**",
    expected: "<p><b><tg-math>x^2</tg-math></b></p>",
  },
  {
    name: "latex inline streaming incomplete",
    input: "$x^2",
    expected: "<p><tg-math>x^2</tg-math></p>",
  },
  { name: "dollar in text no closing", input: "price $100", expected: "<p>price $100</p>" },

  // ── LaTeX block $$...$$ ────────────────────────────────────────────────────
  {
    name: "latex block inline",
    input: "$$E = mc^2$$",
    expected: "<tg-math-block>E = mc^2</tg-math-block>",
  },
  {
    name: "latex block multiline",
    input: "$$\n\\int_0^\\infty e^{-x} dx = 1\n$$",
    expected: "<tg-math-block>\\int_0^\\infty e^{-x} dx = 1</tg-math-block>",
  },
  {
    name: "latex block with fractions",
    input: "$$\\frac{a}{b} + \\frac{c}{d}$$",
    expected: "<tg-math-block>\\frac{a}{b} + \\frac{c}{d}</tg-math-block>",
  },
  {
    name: "latex block escaping",
    input: "$$x < y$$",
    expected: "<tg-math-block>x &lt; y</tg-math-block>",
  },
  {
    name: "latex block streaming incomplete",
    input: "$$E = mc",
    expected: "<tg-math-block>E = mc</tg-math-block>",
  },
  {
    name: "lone $$ opener no content stays literal",
    input: "$$",
    expected: "<p>$$</p>",
  },

  // ── LaTeX math code block ──────────────────────────────────────────────────
  {
    name: "latex math code block",
    input: "```math\nE = mc^2\n```",
    expected: "<tg-math-block>E = mc^2</tg-math-block>",
  },
  {
    name: "latex math code block multiline",
    input: "```math\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n```",
    expected: "<tg-math-block>\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}</tg-math-block>",
  },

  // ── HTML passthrough (<u>, <sub>, <sup>) ───────────────────────────────────
  { name: "underline u tag", input: "<u>underline</u>", expected: "<p><u>underline</u></p>" },
  {
    name: "underline ins tag",
    input: "<ins>inserted</ins>",
    expected: "<p><ins>inserted</ins></p>",
  },
  { name: "subscript", input: "<sub>2</sub>", expected: "<p><sub>2</sub></p>" },
  { name: "superscript", input: "<sup>2</sup>", expected: "<p><sup>2</sup></p>" },
  { name: "H2O with subscript", input: "H<sub>2</sub>O", expected: "<p>H<sub>2</sub>O</p>" },
  { name: "x squared with superscript", input: "x<sup>2</sup>", expected: "<p>x<sup>2</sup></p>" },
  {
    name: "bold italic underline nested",
    input: "**_<u>all three</u>_**",
    expected: "<p><b><i><u>all three</u></i></b></p>",
  },
  {
    name: "script tag still escaped",
    input: "<script>bad</script>",
    expected: "&lt;script&gt;bad&lt;/script&gt;",
  },
  {
    name: "b via html still escaped",
    input: "<b>via html</b>",
    expected: "<p>&lt;b&gt;via html&lt;/b&gt;</p>",
  },

  // ── HR ─────────────────────────────────────────────────────────────────────
  { name: "hr", input: "---", expected: "<hr/>" },
  {
    name: "text hr text",
    input: "before\n\n---\n\nafter",
    expected: "<p>before</p>\n<hr/>\n<p>after</p>",
  },

  // ── Blockquote ─────────────────────────────────────────────────────────────
  { name: "blockquote simple", input: "> quote", expected: "<blockquote>quote</blockquote>" },
  {
    name: "blockquote with bold",
    input: "> **bold** quote",
    expected: "<blockquote><b>bold</b> quote</blockquote>",
  },
  {
    name: "blockquote multiline",
    input: "> line1\n> line2",
    expected: "<blockquote>line1<br>line2</blockquote>",
  },
  {
    name: "nested blockquote",
    input: "> outer\n>> inner",
    expected: "<blockquote>outer<blockquote>inner</blockquote></blockquote>",
  },
  {
    name: "blockquote with list",
    input: "> - item 1\n> - item 2",
    expected: "<blockquote><ul>\n<li>item 1</li>\n<li>item 2</li>\n</ul></blockquote>",
  },
  {
    name: "blockquote with heading and list",
    input: "> ## Heading\n> \n> - item with **bold**",
    expected:
      "<blockquote><h2>Heading</h2><ul>\n<li>item with <b>bold</b></li>\n</ul></blockquote>",
  },
  {
    name: "blockquote with latex",
    input: "> $E = mc^2$",
    expected: "<blockquote><tg-math>E = mc^2</tg-math></blockquote>",
  },

  // ── Code blocks ────────────────────────────────────────────────────────────
  {
    name: "code block with lang",
    input: "```ts\nconst x = 1\n```",
    expected: '<pre><code class="language-ts">const x = 1</code></pre>',
  },
  { name: "code block no lang", input: "```\nhello\n```", expected: "<pre>hello</pre>" },
  { name: "empty code block skipped", input: "```ts", expected: "" },
  {
    name: "code block escaping",
    input: "```\n<div>&</div>\n```",
    expected: "<pre>&lt;div&gt;&amp;&lt;/div&gt;</pre>",
  },

  // ── Spoiler ────────────────────────────────────────────────────────────────
  { name: "spoiler", input: "||hidden||", expected: "<p><tg-spoiler>hidden</tg-spoiler></p>" },
  {
    name: "spoiler with bold",
    input: "||**bold** secret||",
    expected: "<p><tg-spoiler><b>bold</b> secret</tg-spoiler></p>",
  },
  {
    name: "spoiler with code",
    input: "||`code`||",
    expected: "<p><tg-spoiler><code>code</code></tg-spoiler></p>",
  },
  {
    name: "spoiler bold and code",
    input: "||**bold** `code`||",
    expected: "<p><tg-spoiler><b>bold</b> <code>code</code></tg-spoiler></p>",
  },
  {
    name: "spoiler incomplete streaming",
    input: "||secret",
    expected: "<p><tg-spoiler>secret</tg-spoiler></p>",
  },

  // ── Inherited inline ───────────────────────────────────────────────────────
  { name: "bold", input: "**bold**", expected: "<p><b>bold</b></p>" },
  { name: "italic", input: "*italic*", expected: "<p><i>italic</i></p>" },
  { name: "bold italic", input: "***both***", expected: "<p><i><b>both</b></i></p>" },
  { name: "strikethrough", input: "~~del~~", expected: "<p><s>del</s></p>" },
  {
    name: "strikethrough with code",
    input: "~~`code`~~",
    expected: "<p><s><code>code</code></s></p>",
  },
  { name: "inline code", input: "`code`", expected: "<p><code>code</code></p>" },
  {
    name: "link",
    input: "[click](https://t.me)",
    expected: '<p><a href="https://t.me">click</a></p>',
  },
  {
    name: "html escaping",
    input: "<script>alert(1)</script>",
    expected: "&lt;script&gt;alert(1)&lt;/script&gt;",
  },
  { name: "ampersand", input: "A & B", expected: "<p>A &amp; B</p>" },
  {
    name: "image without title",
    input: "![alt](https://example.com/img.png)",
    expected: '<img src="https://example.com/img.png"/>',
  },
  {
    name: "image with title becomes figure",
    input: '![](https://example.com/img.png "A caption")',
    expected:
      '<figure><img src="https://example.com/img.png"/><figcaption>A caption</figcaption></figure>',
  },
  {
    name: "image title with special chars is escaped",
    input: '![](https://example.com/img.png "A & B <test>")',
    expected:
      '<figure><img src="https://example.com/img.png"/><figcaption>A &amp; B &lt;test&gt;</figcaption></figure>',
  },
  {
    name: "image after paragraph",
    input: "Text\n\n![photo](https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg)",
    expected:
      '<p>Text</p>\n<img src="https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg"/>',
  },
  {
    name: "image non-http url is dropped",
    input: "![x](ftp://example.com/img.png)",
    expected: "",
  },
  {
    name: "incomplete bold streaming",
    input: "**not closed",
    expected: "<p><b>not closed</b></p>",
  },

  // ── Complex nesting ────────────────────────────────────────────────────────
  {
    name: "heading then list",
    input: "# Title\n\n- item 1\n- item 2",
    expected: "<h1>Title</h1>\n<ul>\n<li>item 1</li>\n<li>item 2</li>\n</ul>",
  },
  {
    name: "heading then table",
    input: "## Results\n\n| A | B |\n|---|---|\n| 1 | 2 |",
    expected:
      "<h2>Results</h2>\n<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td>1</td><td>2</td></tr>\n</table>",
  },
  {
    name: "code block then list",
    input: "```js\nconst x = 1\n```\n\n- item",
    expected: '<pre><code class="language-js">const x = 1</code></pre>\n<ul>\n<li>item</li>\n</ul>',
  },
  {
    name: "highlight in list",
    input: "- ==key== point",
    expected: "<ul>\n<li><mark>key</mark> point</li>\n</ul>",
  },
  {
    name: "latex in list",
    input: "- solve $x^2 = 4$",
    expected: "<ul>\n<li>solve <tg-math>x^2 = 4</tg-math></li>\n</ul>",
  },
  {
    name: "sub and sup in list",
    input: "- H<sub>2</sub>O and x<sup>2</sup>",
    expected: "<ul>\n<li>H<sub>2</sub>O and x<sup>2</sup></li>\n</ul>",
  },
  {
    name: "full document",
    input:
      "# Title\n\nParagraph with **bold** and ==highlight==.\n\n- item 1\n- item 2\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> quote\n\n```ts\nconst x = 1\n```",
    expected:
      '<h1>Title</h1>\n<p>Paragraph with <b>bold</b> and <mark>highlight</mark>.</p>\n<ul>\n<li>item 1</li>\n<li>item 2</li>\n</ul>\n<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td>1</td><td>2</td></tr>\n</table>\n<blockquote>quote</blockquote>\n<pre><code class="language-ts">const x = 1</code></pre>',
  },
  {
    name: "full document with latex",
    input:
      "# Physics\n\nEinstein's formula: $E = mc^2$\n\n$$\\nabla \\cdot E = \\rho / \\varepsilon_0$$\n\n```math\n\\oint B \\cdot dl = \\mu_0 I\n```",
    expected:
      "<h1>Physics</h1>\n<p>Einstein's formula: <tg-math>E = mc^2</tg-math></p>\n<tg-math-block>\\nabla \\cdot E = \\rho / \\varepsilon_0</tg-math-block>\n<tg-math-block>\\oint B \\cdot dl = \\mu_0 I</tg-math-block>",
  },

  // ── LaTeX \(...\) inline ───────────────────────────────────────────────────
  { name: "latex bs inline simple", input: "\\(x^2\\)", expected: "<p><tg-math>x^2</tg-math></p>" },
  {
    name: "latex bs inline complex",
    input: "\\(E = mc^2\\)",
    expected: "<p><tg-math>E = mc^2</tg-math></p>",
  },
  {
    name: "latex bs inline backslash commands",
    input: "\\(\\alpha + \\beta\\)",
    expected: "<p><tg-math>\\alpha + \\beta</tg-math></p>",
  },
  {
    name: "latex bs inline in sentence",
    input: "before \\(x^2\\) after",
    expected: "<p>before <tg-math>x^2</tg-math> after</p>",
  },
  {
    name: "latex bs inline two",
    input: "\\(a\\) and \\(b\\)",
    expected: "<p><tg-math>a</tg-math> and <tg-math>b</tg-math></p>",
  },
  {
    name: "latex bs inline escaping",
    input: "\\(x < y\\)",
    expected: "<p><tg-math>x &lt; y</tg-math></p>",
  },
  {
    name: "latex bs inline streaming incomplete",
    input: "\\(x^2",
    expected: "<p><tg-math>x^2</tg-math></p>",
  },

  // ── LaTeX \[...\] block ────────────────────────────────────────────────────
  {
    name: "latex bs block simple",
    input: "\\[E = mc^2\\]",
    expected: "<tg-math-block>E = mc^2</tg-math-block>",
  },
  {
    name: "latex bs block multiline",
    input: "\\[\n\\int_0^\\infty e^{-x} dx\n\\]",
    expected: "<tg-math-block>\\int_0^\\infty e^{-x} dx</tg-math-block>",
  },
  {
    name: "latex bs block backslash commands",
    input: "\\[\\frac{a}{b} + \\frac{c}{d}\\]",
    expected: "<tg-math-block>\\frac{a}{b} + \\frac{c}{d}</tg-math-block>",
  },
  {
    name: "latex bs block escaping",
    input: "\\[x < y\\]",
    expected: "<tg-math-block>x &lt; y</tg-math-block>",
  },
  {
    name: "latex bs block streaming incomplete",
    input: "\\[x^2",
    expected: "<tg-math-block>x^2</tg-math-block>",
  },
  {
    name: "latex bs block in document",
    input: "before\n\n\\[x^2\\]\n\nafter",
    expected: "<p>before</p>\n<tg-math-block>x^2</tg-math-block>\n<p>after</p>",
  },

  // ── HTML passthrough — new tags ────────────────────────────────────────────
  {
    name: "cite passthrough",
    input: "<cite>source</cite>",
    expected: "<p><cite>source</cite></p>",
  },
  {
    name: "tg-spoiler via html",
    input: "<tg-spoiler>hidden</tg-spoiler>",
    expected: "<p><tg-spoiler>hidden</tg-spoiler></p>",
  },
  {
    name: "tg-emoji passthrough",
    input: '<tg-emoji emoji-id="1234">👍</tg-emoji>',
    expected: '<p><tg-emoji emoji-id="1234">👍</tg-emoji></p>',
  },
  {
    name: "tg-thinking passthrough",
    input: "<tg-thinking>reasoning</tg-thinking>",
    expected: "<p><tg-thinking>reasoning</tg-thinking></p>",
  },
  {
    name: "details block passthrough",
    input: "<details><summary>Click</summary>Body</details>",
    expected: "<details><summary>Click</summary>Body</details>",
  },
  {
    name: "aside block passthrough",
    input: "<aside>pull quote</aside>",
    expected: "<aside>pull quote</aside>",
  },
  {
    name: "footer block passthrough",
    input: "<footer>author</footer>",
    expected: "<footer>author</footer>",
  },
  { name: "iframe still escaped", input: '<iframe src="x">', expected: '&lt;iframe src="x"&gt;' },
];

// ─── Test suites ───────────────────────────────────────────────────────────

describe("mdgramRich streaming", () => {
  for (const tc of cases) {
    it(tc.name, () => {
      runStreamingTest(tc);
    });
  }
});

describe("mdgramRich vs mdgram differences", () => {
  it("headings: <h1> not <b>", () => {
    expect(mdgramRich("# Title")).toBe("<h1>Title</h1>");
    expect(mdgram("# Title")).toBe("<b>Title</b>");
  });

  it("lists: <ul><li> not bullets", () => {
    expect(mdgramRich("- a\n- b")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(mdgram("- a\n- b")).toBe("• a\n• b");
  });

  it("ordered lists: <ol><li> not numbers", () => {
    expect(mdgramRich("1. a\n2. b")).toBe("<ol>\n<li>a</li>\n<li>b</li>\n</ol>");
    expect(mdgram("1. a\n2. b")).toBe("1. a\n2. b");
  });

  it("tables: <table> not <pre>", () => {
    const input = "| A | B |\n|---|---|\n| 1 | 2 |";
    expect(mdgramRich(input)).toContain("<table>");
    expect(mdgram(input)).toContain("<pre>");
  });

  it("hr: <hr/> not empty line", () => {
    expect(mdgramRich("---")).toBe("<hr/>");
    expect(mdgram("---")).toBe("");
  });

  it("highlight: ==text== renders only in rich", () => {
    expect(mdgramRich("==hi==")).toBe("<p><mark>hi</mark></p>");
    expect(mdgram("==hi==")).toBe("==hi==");
  });

  it("latex: $x^2$ renders only in rich", () => {
    expect(mdgramRich("$x^2$")).toBe("<p><tg-math>x^2</tg-math></p>");
    expect(mdgram("$x^2$")).toBe("$x^2$");
  });

  it("latex block: $$...$$ renders only in rich", () => {
    expect(mdgramRich("$$E = mc^2$$")).toBe("<tg-math-block>E = mc^2</tg-math-block>");
    expect(mdgram("$$E = mc^2$$")).toBe("$$E = mc^2$$");
  });

  it("latex \\(...\\) renders only in rich", () => {
    expect(mdgramRich("\\(x^2\\)")).toBe("<p><tg-math>x^2</tg-math></p>");
    expect(mdgram("\\(x^2\\)")).toBe("(x^2)");
  });

  it("latex \\[...\\] renders only in rich", () => {
    expect(mdgramRich("\\[E = mc^2\\]")).toBe("<tg-math-block>E = mc^2</tg-math-block>");
    expect(mdgram("\\[E = mc^2\\]")).toBe("[E = mc^2]");
  });

  it("<details> passthrough only in rich", () => {
    const input = "<details><summary>S</summary>B</details>";
    expect(mdgramRich(input)).toBe(input);
    expect(mdgram(input)).toContain("&lt;details&gt;");
  });

  it("<u> passthrough only in rich", () => {
    expect(mdgramRich("<u>text</u>")).toBe("<p><u>text</u></p>");
    expect(mdgram("<u>text</u>")).toBe("&lt;u&gt;text&lt;/u&gt;");
  });
});
