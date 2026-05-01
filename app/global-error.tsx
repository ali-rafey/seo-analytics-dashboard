"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary — catches errors thrown in the root layout
 * itself (where the route-level error.tsx can't help because the layout
 * rendering already failed). Provides its own <html>/<body> wrapper as
 * required by Next.js for global-error files.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] root error:", error.message, error.digest);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 24,
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            background: "rgba(239,68,68,0.05)",
          }}
        >
          <h2 style={{ margin: "0 0 12px", color: "#fca5a5" }}>
            Something went wrong
          </h2>
          <p style={{ margin: "0 0 16px", color: "#a3a3a3", fontSize: 14 }}>
            The application hit an unexpected error. Please try reloading.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0 0 16px",
                color: "#666",
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #525252",
              background: "#171717",
              color: "#e5e5e5",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
