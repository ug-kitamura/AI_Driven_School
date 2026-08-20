/**
 * シリーズ・コースのヒーロー見出し。
 * キャッチコピーはタイトルの右にダッシュで導く（例: `DX入門コース ——地図を手に入れる`）。
 * 閉じ記号は付けない——以前は「～…～」で挟んでいた（2026-08-19 に変更）。
 * ⚠ ダッシュの前は**半角スペース**。EM DASH 自体が前後に空きを持つので、
 *   全角スペースを重ねると字間が抜けて見える（2026-08-20 に全角から変更）。
 *   JSX のテキストに直接書くと消えたように見えるため `{" ——"}` の形で残す。
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
        <span className="dxm-hero-catch">{" ——"}{catchCopy}</span>
      )}
    </h1>
  );
}
