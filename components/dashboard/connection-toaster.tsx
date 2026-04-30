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

const ERROR_MESSAGES: Record<string, string> = {
  "missing-code": "Authorization callback was missing the code parameter.",
  "state-mismatch": "Authorization state did not match — please try again.",
  "product-not-found": "Product no longer exists.",
  "token-exchange-failed": "Could not exchange the authorization code for tokens.",
  "no-access-token": "Provider did not return an access token.",
  "user-cancelled": "You cancelled the connection.",
  access_denied: "You denied access to the requested permissions.",
};

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
      toast.error("Couldn't connect", {
        description: ERROR_MESSAGES[error] ?? detail ?? error,
      });
      const next = new URLSearchParams(params.toString());
      next.delete("connect_error");
      next.delete("detail");
      router.replace(`?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return null;
}
