import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 對話串「黏底」行為（DESIGN.md §3.6）
 *  1. 用戶已經喺底部 → 新訊息到達自動滾到底
 *  2. 用戶拖咗上去睇歷史 → 唔自動搶位置，底部出「新訊息」按鈕
 */
const BOTTOM_THRESHOLD = 80; // px：距底 ≤ 80px 當作「喺底部」

export function useStickyStream(itemCount: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [pending, setPending] = useState(0);
  const prevCount = useRef(itemCount);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setPending(0);
    setAtBottom(true);
  }, []);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
    setAtBottom(bottom);
    if (bottom) setPending(0);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const grew = itemCount > prevCount.current;
    prevCount.current = itemCount;
    if (!el || !grew) return;
    if (atBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setPending(0);
    } else {
      setPending((p) => p + 1);
    }
  }, [itemCount, atBottom]);

  return { ref, onScroll, atBottom, pending, scrollToBottom };
}
