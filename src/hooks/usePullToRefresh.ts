"use client";

import { createElement, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";

const THRESHOLD = 72;
const MAX_PULL = 110;

/**
 * Pull-to-refresh for a scroll container, matching the native RefreshControl.
 * Tracks the finger 1:1 with rubber-banding past the threshold and springs
 * back on release.
 */
export const usePullToRefresh = (onRefresh: () => Promise<unknown>) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const element = useRef<HTMLElement | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const target = event.currentTarget;

      if (target.scrollTop > 0 || refreshing || event.pointerType === "mouse") {
        return;
      }

      element.current = target;
      startY.current = event.clientY;
    },
    [refreshing],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (startY.current === null || !element.current || element.current.scrollTop > 0) {
        return;
      }

      const delta = event.clientY - startY.current;

      if (delta <= 0) {
        setPull(0);
        return;
      }

      if (!dragging) {
        setDragging(true);
      }

      // Rubber-band: the further you pull, the less the indicator follows.
      const resisted = (delta * MAX_PULL) / (MAX_PULL + delta * 0.6);
      setPull(Math.min(resisted, MAX_PULL));
    },
    [dragging],
  );

  const finish = useCallback(async () => {
    if (startY.current === null) {
      return;
    }

    startY.current = null;
    setDragging(false);

    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD * 0.75);

      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }

      return;
    }

    setPull(0);
  }, [onRefresh, pull, refreshing]);

  const indicator: ReactNode = createElement(
    "div",
    {
      "aria-hidden": true,
      className: "pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center",
      style: {
        transform: `translateY(${pull - 44}px)`,
        opacity: Math.min(pull / THRESHOLD, 1),
        transition: dragging ? "none" : "transform var(--dur) var(--ease-spring), opacity var(--dur-fast) ease",
        paddingTop: "var(--safe-top)",
      },
    },
    createElement(
      "div",
      {
        className: "glass flex h-9 w-9 items-center justify-center rounded-full text-accent shadow-float",
        style: { transform: refreshing ? "none" : `rotate(${(pull / THRESHOLD) * 180}deg)` },
      },
      refreshing ? createElement(Spinner, { size: 18 }) : createElement(ArrowDown, { size: 18 }),
    ),
  );

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      style: {
        transform: pull > 0 ? `translateY(${pull * 0.35}px)` : undefined,
        transition: dragging ? "none" : "transform var(--dur) var(--ease-spring)",
      },
    },
    indicator,
    refreshing,
  };
};
