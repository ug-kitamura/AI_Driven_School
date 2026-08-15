/**
 * シリーズ・コースのヒーロー見出し。
 * キャッチコピーはタイトルの右に「～…～」で続ける（例: `DX入門コース　～地図を手に入れる～`）。
 * 一覧カードのキャッチコピーは従来どおりタイトルの下の行なので、この型は使わない。
 */
export function HeroTitle({
  title,
  catchCopy,
}: {
  title: string;
  catchCopy?: string;
}) {
  return (
    <h1 className="dxm-hero-title">
      {title}
      {catchCopy && (
        <span className="dxm-hero-catch">　～{catchCopy}～</span>
      )}
    </h1>
  );
}
