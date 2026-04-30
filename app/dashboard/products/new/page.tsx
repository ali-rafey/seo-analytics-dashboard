import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProductForm } from "@/components/dashboard/product-form";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl p-6">
      <ProductForm mode="create" />
    </div>
  );
}
