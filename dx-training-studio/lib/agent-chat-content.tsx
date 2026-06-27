import type { ReactNode } from "react";

const CONTENTS_REF_RE = /(@contents\/[^\s@]+)/g;
const URL_RE = /https?:\/\/[^\s<>\]\)"']+/g;

function splitUrlTrailingPunctuation(url: string): { href: string; trailing: string } {
  let href = url;
  let trailing = "";
  while (/[.,;:!?)}\]]$/.test(href)) {
    trailing = href.slice(-1) + trailing;
    href = href.slice(0, -1);
  }
  return { href, trailing };
}

function linkifyText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    const { href, trailing } = splitUrlTrailingPunctuation(url);
    if (href) {
      nodes.push(
        <a
          key={`${keyPrefix}-url-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {href}
        </a>,
      );
    }
    if (trailing) {
      nodes.push(trailing);
    }

    lastIndex = index + url.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/** Agent チャットのユーザー / アシスタントメッセージ本文を描画する */
export function renderAgentChatMessageContent(content: string): ReactNode {
  const parts = content.split(CONTENTS_REF_RE);
  return parts.flatMap((part, index) => {
    if (part.startsWith("@contents/")) {
      const fileName = part.split("/").pop() ?? part;
      return [
        <span
          key={`ref-${index}`}
          className="mx-0.5 inline-flex rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
        >
          {fileName}
        </span>,
      ];
    }
    return linkifyText(part, `part-${index}`);
  });
}
