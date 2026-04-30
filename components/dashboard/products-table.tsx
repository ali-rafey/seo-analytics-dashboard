"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Row = {
  id: string;
  name: string;
  url: string;
  logoUrl: string | null;
  description: string | null;
  createdAt: string;
  integrationCount: number;
  connectedCount: number;
};

export function ProductsTable({ products }: { products: Row[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not delete", { description: data?.error });
        return;
      }
      toast.success("Product deleted");
      setConfirmId(null);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          You haven&apos;t added any products yet.
        </p>
        <Button asChild>
          <Link href="/dashboard/products/new">
            <Plus className="h-4 w-4" /> Add your first product
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-2 font-medium">Product</th>
            <th className="px-2 py-2 font-medium">URL</th>
            <th className="px-2 py-2 font-medium">Integrations</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              className="border-t border-border/40 hover:bg-card/40"
            >
              <td className="px-2 py-3">
                <div className="flex items-center gap-3">
                  {p.logoUrl ? (
                    <Image
                      src={p.logoUrl}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-xs font-bold uppercase text-muted-foreground">
                      {p.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    {p.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-2 py-3">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <span className="max-w-[260px] truncate">{p.url}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </td>
              <td className="px-2 py-3">
                {p.connectedCount > 0 ? (
                  <Badge variant="success">
                    {p.connectedCount} connected
                  </Badge>
                ) : (
                  <Badge variant="outline">None</Badge>
                )}
              </td>
              <td className="px-2 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/dashboard?product=${p.id}`}
                        className="flex w-full items-center gap-2"
                      >
                        Open dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        className="flex w-full items-center gap-2"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setConfirmId(p.id);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmId && (
        <DeleteDialog
          productName={products.find((p) => p.id === confirmId)?.name ?? ""}
          deleting={deletingId === confirmId}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => onDelete(confirmId)}
        />
      )}
    </div>
  );
}

function DeleteDialog({
  productName,
  deleting,
  onCancel,
  onConfirm,
}: {
  productName: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Delete product?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Permanently delete <span className="font-medium">{productName}</span>{" "}
          and all of its integrations, snapshots, and audit history. This
          cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
