"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { HtmlPreviewFrame } from "@/components/workspace/HtmlPreviewFrame";
import {
  fileExtension,
  formatStructuredPreview,
  parseCsv,
  parseVtt,
} from "@/lib/file-preview";
import "@/styles/hljs/lesson-preview-hljs.css";

type Props = {
  fileName: string;
  content: string;
  isResizing?: boolean;
};

export function FilePreview({ fileName, content, isResizing = false }: Props) {
  const ext = fileExtension(fileName);

  const structured = useMemo(
    () =>
      ext === "json" || ext === "yml" || ext === "yaml"
        ? formatStructuredPreview(content, ext)
        : null,
    [content, ext],
  );

  if (ext === "md") {
    return (
      <div className="lesson-preview prose prose-sm dark:prose-invert max-w-none p-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  if (ext === "html" || ext === "htm") {
    return (
      <HtmlPreviewFrame
        key={content}
        content={content}
        isResizing={isResizing}
      />
    );
  }

  if (ext === "csv") {
    const rows = parseCsv(content);
    return (
      <div className="workspace-scrollbar overflow-auto p-4">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border px-2 py-1">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (ext === "json" || ext === "yml" || ext === "yaml") {
    return (
      <div className="flex flex-col gap-2 p-4">
        {structured?.error ? (
          <p className="text-sm text-destructive">Parse error: {structured.error}</p>
        ) : null}
        <pre className="workspace-scrollbar overflow-auto text-sm">
          {structured?.formatted ?? content}
        </pre>
      </div>
    );
  }

  if (ext === "vtt") {
    const cues = parseVtt(content);
    return (
      <ul className="flex flex-col gap-2 p-4 text-sm">
        {cues.map((cue, i) => (
          <li key={i} className="flex flex-col gap-0.5 border-b pb-2">
            <span className="font-mono text-xs text-muted-foreground">{cue.time}</span>
            <span>{cue.text}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <pre className="workspace-scrollbar overflow-auto p-4 text-sm whitespace-pre-wrap">
      {content}
    </pre>
  );
}
