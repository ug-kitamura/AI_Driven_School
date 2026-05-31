import type { Components } from "react-markdown";
import { isSafeImageLogicalPath, toImageApiUrl } from "@/lib/image-path";

/** プレビュー用: `images/...` と data URL を解決 */
export const lessonPreviewMarkdownComponents: Components = {
  img({ src, alt, ...props }) {
    if (!src || typeof src !== "string") return null;
    let resolved = src;
    if (isSafeImageLogicalPath(src)) {
      resolved = toImageApiUrl(src);
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...props} src={resolved} alt={alt ?? ""} />
    );
  },
};
