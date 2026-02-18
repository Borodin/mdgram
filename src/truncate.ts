/** Maximum text length for a regular message (UTF-16 code units). */
export const MESSAGE_LIMIT = 4096;

/** Maximum text length for a photo/video caption (UTF-16 code units). */
export const CAPTION_LIMIT = 1024;

/**
 * Returns visible text length of Telegram HTML (UTF-16 code units).
 * Tags are not counted; HTML entities count as 1 character each.
 */
export function textLength(html: string): number {
  let len = 0;
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) break;
      i = end + 1;
    } else if (html[i] === "&") {
      const end = html.indexOf(";", i);
      if (end === -1) {
        len++;
        i++;
      } else {
        len++;
        i = end + 1;
      }
    } else {
      len++;
      i++;
    }
  }
  return len;
}

/**
 * Truncates Telegram HTML to fit within `maxLength` visible characters.
 * Appends "…" and properly closes all open tags when truncated.
 */
export function truncate(html: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (textLength(html) <= maxLength) return html;

  const effectiveMax = maxLength - 1; // reserve 1 char for "…"
  let textLen = 0;
  let i = 0;
  const tagStack: string[] = [];
  let result = "";

  while (i < html.length && textLen < effectiveMax) {
    if (html[i] === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) break;
      const tag = html.slice(i, end + 1);

      if (tag[1] === "/") {
        tagStack.pop();
      } else if (!tag.endsWith("/>")) {
        const nameMatch = tag.match(/^<([\w-]+)/);
        if (nameMatch) tagStack.push(nameMatch[1]);
      }
      result += tag;
      i = end + 1;
    } else if (html[i] === "&") {
      const semiIdx = html.indexOf(";", i);
      if (semiIdx === -1) {
        result += html[i];
        textLen++;
        i++;
      } else {
        result += html.slice(i, semiIdx + 1);
        textLen++;
        i = semiIdx + 1;
      }
    } else {
      const code = html.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        // High surrogate — need 2 code units for the pair
        if (textLen + 2 > effectiveMax) break;
        result += html[i] + html[i + 1];
        textLen += 2;
        i += 2;
      } else {
        result += html[i];
        textLen++;
        i++;
      }
    }
  }

  result += "\u2026"; // …

  for (let j = tagStack.length - 1; j >= 0; j--) {
    result += `</${tagStack[j]}>`;
  }

  return result;
}
