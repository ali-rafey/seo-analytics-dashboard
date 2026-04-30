"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "border-border bg-card text-card-foreground shadow-xl shadow-black/40",
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
