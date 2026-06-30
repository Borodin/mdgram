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

// Render blockquote tokens without <p> wrappers.
// Adjacent text paragraphs are joined with <br> (per spec example).
// Block-level elements (headings, lists, code, etc.) are appended without <br>.
function renderInlineBlocks(
  this: RendererThis & {
    parser: {
      parseInline(tokens: Tokens.Generic[]): string;
      parse(tokens: Tokens.Generic[]): string;
    };
  },
  tokens: Tokens.Generic[],
): string {
  const parts: string[] = [];
  let lastWasInline = false;
  for (const tok of tokens) {
    if (tok.type === "paragraph") {
      if (lastWasInline) parts.push("<br>");
      parts.push(this.parser.parseInline((tok as unknown as Tokens.Paragraph).tokens));
      lastWasInline = true;
    } else if (tok.type !== "space") {
      parts.push(this.parser.parse([tok]).trimEnd());
      lastWasInline = false;
    }
  }
  return parts.join("");
}

export const richRenderer: RendererObject = {
  ...telegramRenderer,

  paragraph({ tokens }) {
    const content = this.parser.parseInline(tokens);
    if (!content) return "";
    // Standalone images are block-level — don't wrap in <p>
    if (content.startsWith("<img ") || content.startsWith("<figure>")) return `${content}\n`;
    return `<p>${content}</p>\n`;
  },

  br() {
    return "<br>";
  },

  space() {
    return "";
  },

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
    // Telegram spec: media blocks support only HTTP and HTTPS URLs
    if (!href.startsWith("https://") && !href.startsWith("http://")) return "";
    const src = escAttr(href);
    if (!title) return `<img src="${src}"/>`;
    return `<figure><img src="${src}"/><figcaption>${esc(title)}</figcaption></figure>`;
  },

  blockquote({ tokens }) {
    const inner = renderInlineBlocks.call(this as never, tokens as Tokens.Generic[]);
    return `<blockquote>${inner}</blockquote>\n`;
  },

  list(token) {
    const tag = token.ordered ? "ol" : "ul";
    const startAttr =
      token.ordered && typeof token.start === "number" && token.start !== 1
        ? ` start="${token.start}"`
        : "";
    let inner = "";
    for (const item of token.items) {
      let body = this.parser.parse(item.tokens, !!item.loose).trimEnd();
      if (item.loose) {
        // parse() wraps loose content in <p> — strip for <li> compatibility
        body = body
          .replace(/<\/p>\n/g, "<br>")
          .replace(/<\/p>$/, "")
          .replace(/<p>/g, "")
          .replace(/<br>$/, "");
      }
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
