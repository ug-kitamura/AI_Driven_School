"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

const CONTENTS_REF_RE = /(@contents\/[^\s@]+)/g;
const remarkPlugins = [remarkGfm];

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props}>{children}</table>
    </div>
  ),
};

function ContentsRefChip({ path }: { path: string }) {
  const fileName = path.split("/").pop() ?? path;
  return (
    <span className="mx-0.5 inline-flex rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground">
      {fileName}
    </span>
  );
}

function MarkdownSegment({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

function PlainTextContent({ content }: { content: string }) {
  const parts = content.split(CONTENTS_REF_RE);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("@contents/")) {
          return <ContentsRefChip key={`ref-${index}`} path={part} />;
        }
        if (!part) return null;
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </>
  );
}

type Props = {
  content: string;
  variant?: "user" | "assistant";
  /** false のとき Markdown パースを省略（Agent タブ非表示時の負荷軽減） */
  richMarkdown?: boolean;
};

/** Agent チャットメッセージをプレビューに近い Markdown 表示で描画する */
export const AgentChatMessageContent = memo(function AgentChatMessageContent({
  content,
  variant = "assistant",
  richMarkdown = true,
}: Props) {
  const segments = useMemo(
    () => (richMarkdown ? content.split(CONTENTS_REF_RE) : null),
    [content, richMarkdown],
  );

  if (!richMarkdown) {
    return (
      <div
        className={cn(
          "whitespace-pre-wrap break-words font-sans text-sm",
          variant === "user" && "agent-chat-message--user",
        )}
      >
        <PlainTextContent content={content} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "lesson-preview agent-chat-message break-words",
        variant === "user" && "agent-chat-message--user",
      )}
    >
      {segments?.map((part, index) => {
        if (part.startsWith("@contents/")) {
          return <ContentsRefChip key={`ref-${index}`} path={part} />;
        }
        if (!part) return null;
        return <MarkdownSegment key={`md-${index}`} content={part} />;
      })}
    </div>
  );
});
