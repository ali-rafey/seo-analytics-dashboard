"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmptyDashboard() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Add your first product</CardTitle>
        <CardDescription>
          A product is a website or app you want to analyze. Each product holds
          its own integrations (GA4, Search Console, GitHub, …) and metric
          history.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button asChild>
          <Link href="/dashboard/products/new">
            <Plus className="h-4 w-4" /> Add product
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/products">Manage products</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
