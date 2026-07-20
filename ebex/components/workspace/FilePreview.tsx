"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { HtmlPreviewFrame } from "@/components/workspace/HtmlPreviewFrame";
import {
  fileExtension,
  formatStructuredPreview,
  parseCsv,
  parseVtt,
  resolveMarkdownLink,
} from "@/lib/file-preview";
import "@/styles/hljs/lesson-preview-hljs.css";

type Props = {
  fileName: string;
  content: string;
  isResizing?: boolean;
  /** 表示中ファイルのフォルダ（workspace 相対）。MD リンク解決の基準 */
  folderPath?: string;
  /** プロジェクト内リンクを Pane 2 で開く */
  onOpenFile?: (folderPath: string, fileName: string) => void;
};

const LINK_FEEDBACK_MS = 1500;

function normalizeHeadingKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/** 見出し id が無いレンダリングでも、見出しテキスト一致でアンカーを解決する */
function scrollToAnchor(root: HTMLElement, id: string): void {
  let byId: Element | null = null;
  try {
    byId = root.querySelector(`#${CSS.escape(id)}`);
  } catch {
    byId = null;
  }
  if (byId) {
    byId.scrollIntoView({ block: "start" });
    return;
  }
  const key = normalizeHeadingKey(id);
  const heading = [...root.querySelectorAll("h1,h2,h3,h4,h5,h6")].find(
    (el) => normalizeHeadingKey(el.textContent ?? "") === key,
  );
  heading?.scrollIntoView({ block: "start" });
}

function PreviewLink({
  href,
  children,
  folderPath,
  onOpenFile,
}: {
  href?: string;
  children?: React.ReactNode;
  folderPath: string;
  onOpenFile?: (folderPath: string, fileName: string) => void;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const showFeedback = (message: string) => {
    setFeedback(message);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setFeedback(null);
    }, LINK_FEEDBACK_MS);
  };

  return (
    <>
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          const action = resolveMarkdownLink(href ?? "", folderPath);
          if (action.type === "anchor") {
            const root = (event.currentTarget as HTMLElement).closest(
              ".lesson-preview",
            );
            if (root instanceof HTMLElement) scrollToAnchor(root, action.id);
            return;
          }
          if (action.type === "open-file") {
            onOpenFile?.(action.folderPath, action.fileName);
            return;
          }
          if (action.type === "copy-external") {
            void navigator.clipboard
              .writeText(action.url)
              .then(() => showFeedback("コピーしました"))
              .catch(() => showFeedback("コピーできませんでした"));
          }
        }}
      >
        {children}
      </a>
      {feedback ? (
        <span className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {feedback}
        </span>
      ) : null}
    </>
  );
}

export function FilePreview({
  fileName,
  content,
  isResizing = false,
  folderPath = "",
  onOpenFile,
}: Props) {
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
      <div className="lesson-preview max-w-none p-4">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            a: ({ href, children }) => (
              <PreviewLink
                href={href}
                folderPath={folderPath}
                onOpenFile={onOpenFile}
              >
                {children}
              </PreviewLink>
            ),
          }}
        >
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
          <p className="text-sm text-destructive">
            Parse error: {structured.error}
          </p>
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
            <span className="font-mono text-xs text-muted-foreground">
              {cue.time}
            </span>
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
