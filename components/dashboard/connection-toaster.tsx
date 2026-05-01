"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const CONNECTED_LABELS: Record<string, string> = {
  ga4: "Google Analytics",
  gsc: "Google Search Console",
  google: "Google",
  github: "GitHub",
};

/**
 * Friendly user-facing messages. We deliberately do NOT show raw
 * `error_description` from Google or our internal error codes — those are
 * confusing for non-technical users. The full technical detail is still
 * captured in console.warn for support/debugging.
 */
const FRIENDLY_ERROR: Record<string, string> = {
  user_cancelled: "Connection cancelled. No problem — try again whenever you're ready.",
  "user-cancelled": "Connection cancelled. No problem — try again whenever you're ready.",
  access_denied: "Connection cancelled. Make sure to grant access on the Google screen, then try again.",
};

const DEFAULT_FRIENDLY = "We couldn't finish connecting. Please try again.";

export function ConnectionToaster() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("connect_error");
    const detail = params.get("detail");

    if (connected) {
      toast.success(`${CONNECTED_LABELS[connected] ?? connected} connected`, {
        description: "Live data is streaming in.",
      });
      const next = new URLSearchParams(params.toString());
      next.delete("connected");
      router.replace(`?${next.toString()}`, { scroll: false });
    } else if (error) {
      // Log the raw error + detail to the console for debugging, but show the
      // user a single calm friendly sentence. No error codes, no Google
      // descriptions, no jargon.
      console.warn("[connect] failed:", error, detail ?? "");
      const description = FRIENDLY_ERROR[error] ?? DEFAULT_FRIENDLY;
      toast.error("Couldn't connect", { description, duration: 6000 });
      const next = new URLSearchParams(params.toString());
      next.delete("connect_error");
      next.delete("detail");
      router.replace(`?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return null;
}
