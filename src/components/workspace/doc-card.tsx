import { Badge } from "@/components/ui/badge";
import { CustomTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileText, Sparkle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const ProgressRing = ({
  progress,
  size = 20,
  strokeWidth = 2,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-gray-200"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary"
      />
    </svg>
  );
};

const DocCard = ({
  title,
  id,
  isCollab,
  isVectorised,
  coverImageUrl,
  pageCount,
  lastReadPage,
}: {
  title: string;
  id: string;
  isCollab: boolean;
  isVectorised: boolean;
  coverImageUrl?: string | null;
  pageCount: number;
  lastReadPage: number | null;
}) => {
  const showProgress = lastReadPage !== null && pageCount > 0;
  const readingProgress = showProgress
    ? Math.round((lastReadPage / pageCount) * 100)
    : 0;

  return (
    <Link
      prefetch={false}
      key={id}
      href={`/f/${id}`}
      className="group [perspective:800px]"
    >
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-md bg-white",
          "border border-gray-200 shadow-sm",
          "transition-all duration-300 ease-out",
          "group-hover:border-gray-300 group-hover:shadow-lg",
          "[transform-style:preserve-3d] [transform-origin:left_center]",
          "group-hover:[transform:rotateY(-6deg)]",
        )}
      >
        <div className="relative aspect-[3/4] w-full bg-gray-50">
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

          {showProgress && (
            <CustomTooltip content={`${readingProgress}% read`}>
              <div className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-white/90 p-1 shadow-sm backdrop-blur-sm">
                <ProgressRing
                  progress={readingProgress}
                  size={18}
                  strokeWidth={2}
                />
              </div>
            </CustomTooltip>
          )}
        </div>

        <div className="flex flex-col gap-1 p-2.5">
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
      </div>
    </Link>
  );
};

export default DocCard;
