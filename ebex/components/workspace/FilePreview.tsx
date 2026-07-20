"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { HtmlPreviewFrame } from "@/components/workspace/HtmlPreviewFrame";
import {
  fileExtension,
  formatStructuredPreview,
  formatVttTimestamp,
  parseCsv,
  parseVtt,
  resolveMarkdownLink,
  vttSpeakerHue,
  type VttCue,
} from "@/lib/file-preview";
import { cn } from "@/lib/utils";
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

type VttRow = {
  cue: VttCue;
  side: "left" | "right";
  /** 話者交代直後（連続ブロックの先頭）だけアイコンと名前を表示する */
  showAvatar: boolean;
};

function buildVttRows(cues: VttCue[]): VttRow[] {
  const rows: VttRow[] = [];
  let side: "left" | "right" = "left";
  let prevKey: string | null = null;
  cues.forEach((cue, index) => {
    const key = cue.speaker ?? "__unknown__";
    const isNewSpeaker = key !== prevKey;
    // 最初の発話は左固定。以降は話者が変わるたびに左右反転する
    if (isNewSpeaker && index > 0) {
      side = side === "left" ? "right" : "left";
    }
    rows.push({ cue, side, showAvatar: isNewSpeaker });
    prevKey = key;
  });
  return rows;
}

function VttBubble({ cue, side, showAvatar }: VttRow) {
  const isUnknown = !cue.speaker;
  const name = cue.speaker ?? "不明";
  const alignRight = side === "right";
  const avatarStyle = cue.speaker
    ? { backgroundColor: `hsl(${vttSpeakerHue(cue.speaker)} 45% 55%)` }
    : undefined;

  return (
    <div
      className={cn(
        "flex items-start gap-2",
        alignRight && "flex-row-reverse",
      )}
    >
      <div className="flex w-12 shrink-0 flex-col items-center gap-1">
        {showAvatar ? (
          <>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-sm font-medium text-white",
                isUnknown && "bg-muted-foreground",
              )}
              style={avatarStyle}
              aria-hidden="true"
            >
              {name.slice(0, 1)}
            </span>
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {name}
            </span>
          </>
        ) : null}
      </div>
      <div
        className={cn(
          "flex min-w-0 max-w-[75%] flex-col gap-0.5",
          alignRight ? "items-end" : "items-start",
        )}
      >
        <div className="rounded-2xl bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap text-foreground">
          {cue.text}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatVttTimestamp(cue.start)} → {formatVttTimestamp(cue.end)}
        </span>
      </div>
    </div>
  );
}

function VttChatPreview({ content }: { content: string }) {
  const rows = useMemo(() => buildVttRows(parseVtt(content)), [content]);
  return (
    <div className="flex flex-col gap-3 p-4">
      {rows.map((row, i) => (
        <VttBubble
          key={i}
          cue={row.cue}
          side={row.side}
          showAvatar={row.showAvatar}
        />
      ))}
    </div>
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
    return <VttChatPreview content={content} />;
  }

  return (
    <pre className="workspace-scrollbar overflow-auto p-4 text-sm whitespace-pre-wrap">
      {content}
    </pre>
  );
}
