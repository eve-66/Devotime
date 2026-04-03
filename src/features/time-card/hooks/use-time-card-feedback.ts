"use client";

import { useEffect, useState } from "react";

import type { Feedback } from "@/features/time-card/context/time-card-app-context";

export function useTimeCardFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // フィードバック
  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  return {
    feedback,
    setFeedback,
  };
}
