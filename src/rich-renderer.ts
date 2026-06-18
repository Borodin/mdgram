import type {
  RendererExtension,
  RendererObject,
  RendererThis,
  TokenizerExtension,
  Tokens,
} from "marked";
import { esc, escAttr, spoilerExtension, telegramRenderer } from "./renderer.js";

export { spoilerExtension };

const inlineMath = (token: Tokens.Generic) => `<tg-math>${esc(token.text as string)}</tg-math>`;
const blockMath = (token: Tokens.Generic) =>
  `<tg-math-block>${esc(token.text as string)}</tg-math-block>\n`;

export const highlightExtension: TokenizerExtension & RendererExtension = {
  name: "highlight",
  level: "inline",
  start(src: string) {
    return src.indexOf("==");
  },
  tokenizer(src: string) {
    const match = src.match(/^==((?:[^=]|=[^=])+)==/);
    if (match) {
      const token = {
        type: "highlight",
        raw: match[0],
        text: match[1],
        tokens: [] as Tokens.Generic[],
      };
      this.lexer.inline(token.text, token.tokens);
      return token;
    }
  },
  renderer(this: RendererThis, token) {
    return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`;
  },
};

export const latexInlineExtension: TokenizerExtension & RendererExtension = {
  name: "latex_inline",
  level: "inline",
  start(src: string) {
    let i = src.indexOf("$");
    while (i !== -1 && src[i + 1] === "$") i = src.indexOf("$", i + 2);
    return i === -1 ? undefined : i;
  },
  tokenizer(src: string) {
    if (src.startsWith("$$")) return undefined;
    // Content must start with non-digit, non-space to avoid matching currency ($100)
    const match = src.match(/^\$([^$\n\d\s][^$\n]*)\$/);
    if (match) return { type: "latex_inline", raw: match[0], text: match[1] };
  },
  renderer: inlineMath,
};

export const latexBlockExtension: TokenizerExtension & RendererExtension = {
  name: "latex_block",
  level: "block",
  start(src: string) {
    return src.indexOf("$$");
  },
  tokenizer(src: string) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$/);
    if (match) return { type: "latex_block", raw: match[0], text: match[1].trim() };
  },
  renderer: blockMath,
};

export const latexInlineBsExtension: TokenizerExtension & RendererExtension = {
  name: "latex_inline_bs",
  level: "inline",
  start(src: string) {
    return src.indexOf("\\(");
  },
  tokenizer(src: string) {
    const match = src.match(/^\\\(([\s\S]+?)\\\)/);
    if (match) return { type: "latex_inline_bs", raw: match[0], text: match[1] };
  },
  renderer: inlineMath,
};

export const latexBlockBsExtension: TokenizerExtension & RendererExtension = {
  name: "latex_block_bs",
  level: "block",
  start(src: string) {
    return src.indexOf("\\[");
  },
  tokenizer(src: string) {
    const match = src.match(/^\\\[([\s\S]+?)\\\]/);
    if (match) return { type: "latex_block_bs", raw: match[0], text: match[1].trim() };
  },
  renderer: blockMath,
};

// Single inline tags passed through verbatim — these have no Markdown equivalent
// but are valid in Telegram Rich HTML
const INLINE_PASSTHROUGH_RE =
  /^<\/?(u|ins|sub|sup|cite|tg-spoiler|tg-emoji|tg-thinking)(\s[^>]*)?>$/i;

// Block HTML nodes starting with a structural tag allowed in Telegram Rich HTML
const BLOCK_PASSTHROUGH_RE = /^<(details|aside|footer)[\s>]/i;

function alignAttr(a: string | null): string {
  return a ? ` align="${a}"` : "";
}

export const richRenderer: RendererObject = {
  ...telegramRenderer,

  code({ text, lang }) {
    if (!text) return "";
    if (lang === "math") return `<tg-math-block>${esc(text)}</tg-math-block>\n`;
    const escaped = esc(text);
    if (lang) return `<pre><code class="language-${escAttr(lang)}">${escaped}</code></pre>\n`;
    return `<pre>${escaped}</pre>\n`;
  },

  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
  },

  hr() {
    return "<hr/>\n";
  },

  image({ href, title }) {
    const src = escAttr(href);
    if (!title) return `<img src="${src}"/>\n`;
    return `<figure><img src="${src}"/><figcaption>${esc(title)}</figcaption></figure>\n`;
  },

  list(token) {
    const tag = token.ordered ? "ol" : "ul";
    const startAttr =
      token.ordered && typeof token.start === "number" && token.start !== 1
        ? ` start="${token.start}"`
        : "";
    let inner = "";
    for (const item of token.items) {
      const body = this.parser.parse(item.tokens, !!item.loose).trimEnd();
      if (item.task) {
        inner += `<li><input type="checkbox"${item.checked ? " checked" : ""}>${body}</li>\n`;
      } else {
        inner += `<li>${body}</li>\n`;
      }
    }
    return `<${tag}${startAttr}>\n${inner}</${tag}>\n`;
  },

  table(token) {
    let header = "<tr>";
    for (let i = 0; i < token.header.length; i++) {
      header += `<th${alignAttr(token.align[i])}>${this.parser.parseInline(token.header[i].tokens)}</th>`;
    }
    header += "</tr>\n";

    let body = "";
    for (const row of token.rows) {
      body += "<tr>";
      for (let i = 0; i < row.length; i++) {
        body += `<td${alignAttr(token.align[i])}>${this.parser.parseInline(row[i].tokens)}</td>`;
      }
      body += "</tr>\n";
    }

    return `<table>\n${header}${body}</table>\n`;
  },

  html({ text }: Tokens.HTML | Tokens.Tag) {
    const trimmed = text.trim();
    if (INLINE_PASSTHROUGH_RE.test(trimmed) || BLOCK_PASSTHROUGH_RE.test(trimmed)) return text;
    return esc(text);
  },
};
