import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/dashboard/product-form";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <ProductForm
        mode="edit"
        productId={product.id}
        initial={{
          name: product.name,
          url: product.url,
          logoUrl: product.logoUrl ?? "",
          description: product.description ?? "",
        }}
      />
    </div>
  );
}
