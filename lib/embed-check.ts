/**
 * Checks whether a URL can be embedded in an <iframe>.
 *
 * Two header families block embedding:
 *  - X-Frame-Options: DENY | SAMEORIGIN | ALLOW-FROM <uri>
 *  - Content-Security-Policy: frame-ancestors <source-list>
 *
 * Returns a structured result so the UI can explain *why* embedding fails.
 */

export type EmbedCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "x-frame-options-deny"
        | "x-frame-options-sameorigin"
        | "x-frame-options-allow-from"
        | "csp-frame-ancestors"
        | "fetch-failed"
        | "not-https";
      detail?: string;
    };

export async function checkEmbeddable(
  url: string,
  selfOrigin: string,
): Promise<EmbedCheckResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { ok: false, reason: "fetch-failed", detail: "Invalid URL" };
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return { ok: false, reason: "not-https", detail: target.protocol };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  let res: Response;
  try {
    res = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "SEOAnalyticsDashboard/0.1 (+embed-check; HEAD-equivalent)",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      reason: "fetch-failed",
      detail: err instanceof Error ? err.message : "Unknown fetch error",
    };
  }
  clearTimeout(timer);

  const xfo = res.headers.get("x-frame-options")?.toLowerCase().trim();
  if (xfo) {
    if (xfo === "deny") {
      return { ok: false, reason: "x-frame-options-deny", detail: xfo };
    }
    if (xfo === "sameorigin") {
      const sameOrigin = target.origin === selfOrigin;
      if (!sameOrigin) {
        return { ok: false, reason: "x-frame-options-sameorigin", detail: xfo };
      }
    }
    if (xfo.startsWith("allow-from")) {
      return { ok: false, reason: "x-frame-options-allow-from", detail: xfo };
    }
  }

  const csp = res.headers.get("content-security-policy");
  if (csp) {
    const directives = csp.split(";").map((d) => d.trim());
    const frameAncestors = directives.find((d) =>
      d.toLowerCase().startsWith("frame-ancestors"),
    );
    if (frameAncestors) {
      const sources = frameAncestors
        .replace(/^frame-ancestors/i, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => s.toLowerCase());

      if (
        sources.includes("'none'") ||
        (!sources.includes("*") &&
          !sources.includes(selfOrigin.toLowerCase()) &&
          !sources.includes("'self'"))
      ) {
        return {
          ok: false,
          reason: "csp-frame-ancestors",
          detail: frameAncestors,
        };
      }
    }
  }

  return { ok: true };
}

export function describeEmbedFailure(reason: EmbedCheckResult): string {
  if (reason.ok) return "";
  switch (reason.reason) {
    case "x-frame-options-deny":
      return "This site sets X-Frame-Options: DENY — it cannot be embedded anywhere.";
    case "x-frame-options-sameorigin":
      return "This site only allows embedding from its own origin (X-Frame-Options: SAMEORIGIN).";
    case "x-frame-options-allow-from":
      return "This site restricts embedding via X-Frame-Options: ALLOW-FROM.";
    case "csp-frame-ancestors":
      return "This site's Content-Security-Policy frame-ancestors directive blocks embedding here.";
    case "fetch-failed":
      return `Could not reach the URL${reason.detail ? `: ${reason.detail}` : ""}.`;
    case "not-https":
      return "URL must use http or https.";
  }
}
