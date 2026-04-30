import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function TabPlaceholder({
  title,
  description,
  checkpoint,
}: {
  title: string;
  description: string;
  checkpoint: number;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline">Checkpoint {checkpoint}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Wired in a later checkpoint of this build. Foundation is live; data
        sources will fill this tab once the relevant integration is connected.
      </CardContent>
    </Card>
  );
}
