import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CustomTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Sparkle } from "lucide-react";
import Link from "next/link";

const DocCard = ({
  title,
  id,
  isCollab,
  isVectorised,
}: {
  title: string;
  id: string;
  isCollab: boolean;
  isVectorised: boolean;
}) => {
  return (
    <Link
      prefetch={false}
      key={id}
      href={`/f/${id}`}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "flex flex-col gap-2 border py-8 hover:border-blue-300",
      )}
    >
      <div className="w-full flex justify-between">
        <p className="mr-auto min-w-0 truncate">{title}</p>
        <CustomTooltip
          content={
            isVectorised
              ? "Document is AI vectorised"
              : "Document isn't AI vectorised"
          }
        >
          <Sparkle
            className={cn(
              "h-4 w-4",
              isVectorised ? "text-primary" : "text-gray-200",
            )}
          />
        </CustomTooltip>
      </div>

      {isCollab && (
        <Badge className="mr-auto" variant="outline">
          Collab
        </Badge>
      )}
      {/* add menubar to delete, rename doc, download pdf */}
    </Link>
  );
};

export default DocCard;
