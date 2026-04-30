import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOverviewSnapshot } from "@/lib/data/overview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFRESH_MS = 5000;
const KEEPALIVE_MS = 15000;

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!product) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        const payload =
          `event: ${event}\n` +
          `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      // Initial snapshot — synchronous so the UI shows data immediately.
      try {
        const snap = await getOverviewSnapshot(product.id);
        send("snapshot", snap);
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "snapshot failed",
        });
      }

      const refreshTimer = setInterval(async () => {
        if (closed) return;
        try {
          const snap = await getOverviewSnapshot(product.id);
          send("snapshot", snap);
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "snapshot failed",
          });
        }
      }, REFRESH_MS);

      const keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, KEEPALIVE_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(refreshTimer);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
