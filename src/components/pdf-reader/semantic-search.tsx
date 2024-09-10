import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useQueryState } from "nuqs";

const SemanticSearch = () => {
  const [searchQuery, setSearchQuery] = useQueryState("search", {
    defaultValue: "",
  });

  const { mutate, data, isLoading, isError } =
    api.document.getSemanticSearch.useMutation();

  const router = useRouter();
  const { docId } = router.query as { docId: string };

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-[50%] h-4 w-4 -translate-y-[50%] text-muted-foreground" />
          <Input
            placeholder="Search for a term"
            className="pl-9 border-gray-200"
            type="search"
            value={searchQuery}
            disabled={isLoading}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          onClick={() => mutate({ docId, query: searchQuery })}
          disabled={isLoading}
        >
          Search
        </Button>
      </div>

      {isError && (
        <div className="text-red-500 text-sm">
          An error occurred while fetching the search results.
        </div>
      )}

      {data && (
        <div className="text-sm text-gray-500">
          Found {data.length} results for {searchQuery}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {data?.map((result, idx) => (
          <div key={idx} className="p-2 border-b border-gray-200">
            <div className="text-sm font-semibold">{result[0].pageContent}</div>
            {/* <div className="text-sm text-gray-500">{result.snippet}</div> */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SemanticSearch;
