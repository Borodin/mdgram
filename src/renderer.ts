import type {
  RendererExtension,
  RendererObject,
  RendererThis,
  TokenizerExtension,
  Tokens,
} from "marked";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(text: string): string {
  return esc(text).replace(/"/g, "&quot;");
}

export const spoilerExtension: TokenizerExtension & RendererExtension = {
  name: "spoiler",
  level: "inline",
  start(src: string) {
    return src.match(/\|\|/)?.index;
  },
  tokenizer(src: string) {
    const match = src.match(/^\|\|([^|]+(?:\|[^|]+)*)\|\|/);
    if (match) {
      const token = {
        type: "spoiler",
        raw: match[0],
        text: match[1],
        tokens: [] as Tokens.Generic[],
      };
      this.lexer.inline(token.text, token.tokens);
      return token;
    }
  },
  renderer(this: RendererThis, token) {
    return `<tg-spoiler>${this.parser.parseInline(token.tokens ?? [])}</tg-spoiler>`;
  },
};

export const telegramRenderer: RendererObject = {
  // Block-level

  code({ text, lang }) {
    const escaped = esc(text);
    if (lang) {
      return `<pre><code class="language-${escAttr(lang)}">${escaped}</code></pre>\n`;
    }
    return `<pre>${escaped}</pre>\n`;
  },

  blockquote({ tokens }) {
    const body = this.parser.parse(tokens).trimEnd();
    return `<blockquote>${body}</blockquote>\n`;
  },

  heading({ tokens }) {
    return `<b>${this.parser.parseInline(tokens)}</b>\n`;
  },

  hr() {
    return "\n";
  },

  list(token) {
    let result = "";
    const start = typeof token.start === "number" ? token.start : 1;
    for (let i = 0; i < token.items.length; i++) {
      const prefix = token.ordered ? `${start + i}. ` : "• ";
      const item = token.items[i];
      const body = this.parser.parse(item.tokens, !!item.loose).trimEnd();
      result += `${prefix}${body}\n`;
    }
    return result;
  },

  paragraph({ tokens }) {
    return `${this.parser.parseInline(tokens)}\n`;
  },

  table(token) {
    const texts = [token.header.map((c) => c.text), ...token.rows.map((r) => r.map((c) => c.text))];
    const colWidths = token.header.map((_, ci) =>
      Math.max(...texts.map((row) => (row[ci] ?? "").length)),
    );

    function pad(text: string, width: number, align: string | null): string {
      const gap = width - text.length;
      if (gap <= 0) return text;
      if (align === "right") return " ".repeat(gap) + text;
      if (align === "center") {
        const left = Math.floor(gap / 2);
        return " ".repeat(left) + text + " ".repeat(gap - left);
      }
      return text + " ".repeat(gap);
    }

    const lines = texts.map((row, ri) => {
      const cells = row.map((t, ci) => pad(t, colWidths[ci], token.align[ci]));
      const line = cells.join(" | ");
      if (ri === 0) {
        const sep = colWidths.map((w) => "-".repeat(w)).join("-+-");
        return `${line}\n${sep}`;
      }
      return line;
    });

    return `<pre>${esc(lines.join("\n"))}</pre>\n`;
  },

  space() {
    return "\n";
  },

  html({ text }: Tokens.HTML | Tokens.Tag) {
    return esc(text);
  },

  // Inline-level

  strong({ tokens }) {
    return `<b>${this.parser.parseInline(tokens)}</b>`;
  },

  em({ tokens }) {
    return `<i>${this.parser.parseInline(tokens)}</i>`;
  },

  codespan({ text }) {
    return `<code>${esc(text)}</code>`;
  },

  del({ tokens }) {
    return `<s>${this.parser.parseInline(tokens)}</s>`;
  },

  link({ href, tokens }) {
    return `<a href="${escAttr(href)}">${this.parser.parseInline(tokens)}</a>`;
  },

  image({ text }) {
    return esc(text);
  },

  br() {
    return "\n";
  },

  text(token) {
    if ("tokens" in token && token.tokens) {
      return this.parser.parseInline(token.tokens);
    }
    return esc(token.text);
  },
};
