"use client";

import { useTimeCardApp } from "@/features/time-card/context/time-card-app-context";

export function TimeCardFeedbackBanner() {
  const { feedback } = useTimeCardApp();

  if (!feedback) {
    return null;
  }

  return (
    <div className="feedback-banner" data-tone={feedback.tone}>
      {feedback.text}
    </div>
  );
}
