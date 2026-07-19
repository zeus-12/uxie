import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef } from "react";

export const PageControlsContent = ({
  pageNumber,
  setPageNumber,
  debouncedHandlePageChange,
  totalPages,
}: {
  pageNumber: number;
  setPageNumber: (page: number) => void;
  debouncedHandlePageChange: (page: number) => void;
  totalPages: number;
}) => {
  // Mounts fresh each time the page tab opens, so focus on mount.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Input
      ref={inputRef}
      className="h-7"
      value={pageNumber > 0 ? pageNumber : ""}
      onChange={(e) => {
        const value = e.target.value;
        const pageNum = Number(value);
        setPageNumber(pageNum);
        if (pageNum > 0 && pageNum <= totalPages) {
          debouncedHandlePageChange(pageNum);
        }
      }}
      type="number"
      min={1}
      max={totalPages}
      placeholder="Go to page..."
    />
  );
};

export const PageControlsIcon = ({
  pageNumberInView,
  totalPages,
}: {
  pageNumberInView: number;
  totalPages: number;
}) => {
  return (
    <Button variant="ghost" size="xs">
      {pageNumberInView > 0 ? (
        <p>
          {pageNumberInView}{" "}
          <span className="text-muted-foreground px-[2px]">/</span>{" "}
          <span className="text-muted-foreground">{totalPages}</span>
        </p>
      ) : (
        <div className="h-7 w-7 bg-gray-200 animate-pulse m-auto rounded-md" />
      )}
    </Button>
  );
};
