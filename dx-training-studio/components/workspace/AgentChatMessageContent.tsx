"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import "highlight.js/styles/github.min.css";

const CONTENTS_REF_RE = /(@contents\/[^\s@]+)/g;

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
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}

type Props = {
  content: string;
  variant?: "user" | "assistant";
};

/** Agent チャットメッセージをプレビューに近い Markdown 表示で描画する */
export function AgentChatMessageContent({
  content,
  variant = "assistant",
}: Props) {
  const segments = useMemo(() => content.split(CONTENTS_REF_RE), [content]);

  return (
    <div
      className={cn(
        "lesson-preview agent-chat-message break-words",
        variant === "user" && "agent-chat-message--user",
      )}
    >
      {segments.map((part, index) => {
        if (part.startsWith("@contents/")) {
          return <ContentsRefChip key={`ref-${index}`} path={part} />;
        }
        if (!part) return null;
        return <MarkdownSegment key={`md-${index}`} content={part} />;
      })}
    </div>
  );
}
