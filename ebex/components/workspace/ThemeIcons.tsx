"use client";

import {
  Heart,
  HeartOff,
  HeartPlus,
  HeartPulse,
  Loader2,
  MessageSquarePlus,
  Star,
  StarOff,
} from "lucide-react";
import { useThemeKind } from "@/lib/use-resolved-dark-mode";
import { cn } from "@/lib/utils";

/**
 * ピンクテーマのときだけハート系になるアイコン群。
 *
 * 差し替えは 3 概念・8 箇所に及ぶため、各所で `useThemeKind()` を呼ぶ代わりに
 * ここへ閉じ込める。「ハートは回転させない」「Trash2 は差し替えない」といった
 * 規則も 1 箇所に書けばよくなる。
 *
 * ⚠ テーマ種別をレンダリング中に同期的に読まないこと。サーバとクライアントで
 * 初期値がずれると hydration mismatch になる——`useThemeKind()` は effect 駆動で
 * サーバ安全な初期値を返す。
 */

type IconProps = {
  className?: string;
  "aria-label"?: string;
};

/** お気に入り（行マーカー・絞り込みトグル・メニューの追加項目） */
export function FavoriteIcon({ className, ...rest }: IconProps) {
  const Icon = useThemeKind() === "pink" ? Heart : Star;
  return <Icon className={className} {...rest} />;
}

/** お気に入り解除 */
export function FavoriteOffIcon({ className, ...rest }: IconProps) {
  const Icon = useThemeKind() === "pink" ? HeartOff : StarOff;
  return <Icon className={className} {...rest} />;
}

/** チャットへ追加 */
export function AddToChatIcon({ className, ...rest }: IconProps) {
  const Icon = useThemeKind() === "pink" ? HeartPlus : MessageSquarePlus;
  return <Icon className={className} {...rest} />;
}

/**
 * 処理中スピナー。
 * ⚠ アニメーションもテーマごとに変える——ハートは回転対称でないため
 * `animate-spin` だと転がって見え、ピンクテーマの狙い（穏やかな空気）と矛盾する。
 */
export function BusySpinner({ className, ...rest }: IconProps) {
  const isPink = useThemeKind() === "pink";
  const Icon = isPink ? HeartPulse : Loader2;
  return (
    <Icon
      className={cn(isPink ? "animate-pulse" : "animate-spin", className)}
      {...rest}
    />
  );
}
