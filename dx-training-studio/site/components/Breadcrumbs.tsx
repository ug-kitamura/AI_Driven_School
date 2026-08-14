import Link from "next/link";

export type Crumb = { label: string; href: string };

/** シリーズ → コース → レッスン のパンくず。最後の要素は現在地としてリンクにしない */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="dxm-breadcrumbs" aria-label="パンくず">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.href} className="dxm-breadcrumb-item">
            {isLast ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
            {!isLast && <span className="dxm-breadcrumb-sep">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
