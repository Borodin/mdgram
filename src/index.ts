import { Marked } from "marked";
import remend, { type RemendHandler } from "remend";
import { spoilerExtension, telegramRenderer } from "./renderer.js";
import {
  highlightExtension,
  latexBlockBsExtension,
  latexBlockExtension,
  latexInlineBsExtension,
  latexInlineExtension,
  richRenderer,
} from "./rich-renderer.js";
import { truncate } from "./truncate.js";

const md = new Marked({ renderer: telegramRenderer, breaks: true, gfm: true });
md.use({ extensions: [spoilerExtension] });

const mdRich = new Marked({ renderer: richRenderer, breaks: true, gfm: true });
mdRich.use({
  extensions: [
    latexBlockExtension,
    latexBlockBsExtension,
    latexInlineExtension,
    latexInlineBsExtension,
    spoilerExtension,
    highlightExtension,
  ],
});

function computeCodeRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = /```[\s\S]*?```|`[^`\n]+`/g;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function isInCodeRange(ranges: Array<[number, number]>, index: number): boolean {
  for (const [start, end] of ranges) {
    if (index >= start && index < end) return true;
    if (start > index) break;
  }
  return false;
}

// Closes an unclosed two-char delimiter pair (e.g. "||" or "==").
// With requireContent: only closes if at least one char follows the opener.
function pairHandler(name: string, priority: number, pair: string, requireContent = false) {
  return {
    name,
    priority,
    handle(text: string): string {
      const codeRanges = computeCodeRanges(text);
      let open = false;
      let openAt = -1;
      for (let i = 0; i < text.length - 1; i++) {
        if (isInCodeRange(codeRanges, i)) continue;
        if (text[i] === pair[0] && text[i + 1] === pair[1]) {
          open = !open;
          openAt = open ? i : -1;
          i++;
        }
      }
      if (!open) return text;
      if (requireContent && openAt + 2 >= text.length) return text;
      return `${text}${pair}`;
    },
  };
}

// Closes an unclosed asymmetric bracket pair (e.g. "\(" and "\)").
// Only closes when content exists after the opener.
// NOTE: \[...\] is applied before remend because remend's link-bracket
// logic strips lone "[" from incomplete "\[" sequences.
function bracketHandler(name: string, priority: number, open: string, close: string) {
  return {
    name,
    priority,
    handle(text: string): string {
      const codeRanges = computeCodeRanges(text);
      let isOpen = false;
      let openAt = -1;
      let i = 0;
      while (i < text.length - 1) {
        if (isInCodeRange(codeRanges, i)) {
          i++;
          continue;
        }
        if (text.startsWith(open, i)) {
          isOpen = true;
          openAt = i;
          i += open.length;
        } else if (text.startsWith(close, i)) {
          isOpen = false;
          openAt = -1;
          i += close.length;
        } else {
          i++;
        }
      }
      return isOpen && openAt + open.length < text.length ? `${text}${close}` : text;
    },
  };
}

const spoilerHandler = pairHandler("spoiler", 75, "||");
const highlightHandler = pairHandler("highlight", 74, "==");
const latexBlockHandler = pairHandler("latex_block", 73, "$$", true);
const latexInlineHandler: RemendHandler = {
  name: "latex_inline",
  priority: 72,
  handle(text: string): string {
    const codeRanges = computeCodeRanges(text);
    let open = false;
    let openPos = -1;
    let i = 0;
    while (i < text.length) {
      if (isInCodeRange(codeRanges, i)) {
        i++;
        continue;
      }
      if (text[i] === "$" && text[i + 1] === "$") {
        i += 2;
        continue;
      }
      if (text[i] === "$") {
        if (!open) {
          open = true;
          openPos = i;
        } else {
          open = false;
          openPos = -1;
        }
      }
      i++;
    }
    if (!open || openPos === -1) return text;
    // $100, $1.50 etc. are prices — skip if content starts with digit or whitespace
    if (/[\d\s]/.test(text[openPos + 1] ?? "")) return text;
    return `${text}$`;
  },
};
const latexBlockBsHandler = bracketHandler("latex_block_bs", 71, "\\[", "\\]");
const latexInlineBsHandler = bracketHandler("latex_inline_bs", 70, "\\(", "\\)");

export interface MdgramOptions {
  /** Maximum visible text length (UTF-16 code units). Use MESSAGE_LIMIT or CAPTION_LIMIT. */
  maxLength?: number;
}

function parseWith(
  instance: Marked,
  handlers: RemendHandler[],
  markdown: string,
  options?: MdgramOptions,
): string {
  const completed = remend(markdown, {
    katex: false,
    images: false,
    linkMode: "text-only",
    handlers,
  });
  const result = (instance.parse(completed, { async: false }) as string).trimEnd();
  return options?.maxLength ? truncate(result, options.maxLength) : result;
}

export function mdgram(markdown: string, options?: MdgramOptions): string {
  return parseWith(md, [spoilerHandler], markdown, options);
}

export function mdgramRich(markdown: string, options?: MdgramOptions): string {
  return parseWith(
    mdRich,
    [spoilerHandler, highlightHandler, latexBlockHandler, latexInlineHandler, latexInlineBsHandler],
    latexBlockBsHandler.handle(markdown),
    options,
  );
}

/** Maximum text length for a rich message (UTF-8 characters). */
export const RICH_MESSAGE_LIMIT = 32768;

export { CAPTION_LIMIT, MESSAGE_LIMIT, textLength, truncate } from "./truncate.js";
