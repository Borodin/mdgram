import { Marked } from "marked";
import remend from "remend";
import { spoilerExtension, telegramRenderer } from "./renderer.js";
import { truncate } from "./truncate.js";

const md = new Marked({
  renderer: telegramRenderer,
  breaks: true,
  gfm: true,
});
md.use({ extensions: [spoilerExtension] });

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

const spoilerHandler = {
  name: "spoiler",
  priority: 75,
  handle(text: string): string {
    const codeRanges = computeCodeRanges(text);
    let open = false;
    for (let i = 0; i < text.length - 1; i++) {
      if (isInCodeRange(codeRanges, i)) continue;
      if (text[i] === "|" && text[i + 1] === "|") {
        open = !open;
        i++;
      }
    }
    return open ? `${text}||` : text;
  },
};

export interface MdgramOptions {
  /** Maximum visible text length (UTF-16 code units). Use MESSAGE_LIMIT or CAPTION_LIMIT. */
  maxLength?: number;
}

export function mdgram(markdown: string, options?: MdgramOptions): string {
  const completed = remend(markdown, {
    katex: false,
    images: false,
    linkMode: "text-only",
    handlers: [spoilerHandler],
  });
  const html = md.parse(completed, { async: false });
  const result = html.trimEnd();
  if (options?.maxLength) {
    return truncate(result, options.maxLength);
  }
  return result;
}

export { CAPTION_LIMIT, MESSAGE_LIMIT, textLength, truncate } from "./truncate.js";
