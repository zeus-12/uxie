import { Badge } from "@/components/ui/badge";
import { CustomTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileText, Sparkle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const DocCard = ({
  title,
  id,
  isCollab,
  isVectorised,
  coverImageUrl,
}: {
  title: string;
  id: string;
  isCollab: boolean;
  isVectorised: boolean;
  coverImageUrl?: string | null;
}) => {
  return (
    <Link
      prefetch={false}
      key={id}
      href={`/f/${id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-blue-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-100">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={title}
            fill
            className="object-cover object-top"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileText className="h-12 w-12 text-gray-300" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <div className="flex w-full items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium">{title}</p>
          <CustomTooltip
            content={
              isVectorised
                ? "Document is AI vectorised"
                : "Document isn't AI vectorised"
            }
          >
            <Sparkle
              className={cn(
                "h-4 w-4 shrink-0",
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
      </div>
    </Link>
  );
};

export default DocCard;
