// import FeatureCard from "@/components/other/feature-card";
// import { api } from "@/lib/api";
// import { useCitationHighlightStore } from "@/lib/store";
// import { cn } from "@/lib/utils";
// import { Search } from "lucide-react";
// import { useRouter } from "next/router";
// import { useState } from "react";
// import { toast } from "sonner";
// import { useDebouncedCallback } from "use-debounce";

// export default function SemanticSearch({
//   isVectorised,
// }: {
//   isVectorised: boolean;
// }) {
//   const { query: routerQuery } = useRouter();
//   const docId = typeof routerQuery?.docId === "string" ? routerQuery.docId : "";

//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedQuery, setDebouncedQuery] = useState("");

//   const debouncedSetQuery = useDebouncedCallback((value: string) => {
//     setDebouncedQuery(value);
//   }, 300);

//   const handleInputChange = (value: string) => {
//     setSearchQuery(value);
//     debouncedSetQuery(value);
//   };

//   const {
//     data: results,
//     isLoading,
//     isFetching,
//   } = api.document.semanticSearch.useQuery(
//     { docId, query: debouncedQuery, limit: 15 },
//     {
//       enabled: !!debouncedQuery.trim() && isVectorised,
//       refetchOnWindowFocus: false,
//       onError: (err: any) => {
//         toast.error(err.message, { duration: 3000 });
//       },
//     },
//   );

//   const utils = api.useContext();
//   const { mutate: vectoriseDocMutation, isLoading: isVectorising } =
//     api.document.vectorise.useMutation({
//       onSuccess: () => {
//         utils.document.getDocData.setData({ docId }, (prev) => {
//           if (!prev) return undefined;
//           return { ...prev, isVectorised: true };
//         });
//       },
//     });

//   if (!isVectorised) {
//     return (
//       <FeatureCard
//         isLoading={isVectorising}
//         bulletPoints={[
//           "Find specific passages instantly with semantic understanding.",
//           "Search by meaning, not just keywords.",
//           "Click results to jump directly to the page.",
//         ]}
//         onClick={() => {
//           vectoriseDocMutation(
//             { documentId: docId },
//             {
//               onError: (err) => {
//                 toast.error(err.message, { duration: 3000 });
//               },
//             },
//           );
//         }}
//         buttonText="Enable Search"
//         subtext="Index your document to unlock semantic search:"
//         title="Search your PDF with AI-powered understanding"
//       />
//     );
//   }

//   return (
//     <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
//       <SearchInput
//         value={searchQuery}
//         onChange={handleInputChange}
//         isLoading={isLoading || isFetching}
//       />
//       <SearchResults
//         results={results}
//         isLoading={isLoading || isFetching}
//         query={debouncedQuery}
//       />
//     </div>
//   );
// }

// function SearchInput({
//   value,
//   onChange,
//   isLoading,
// }: {
//   value: string;
//   onChange: (value: string) => void;
//   isLoading: boolean;
// }) {
//   return (
//     <div className="relative">
//       <Search
//         size={18}
//         className={cn(
//           "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400",
//           isLoading && "animate-pulse",
//         )}
//       />
//       <input
//         type="text"
//         placeholder="Search your document..."
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//         className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//         maxLength={500}
//       />
//     </div>
//   );
// }

// interface SearchResult {
//   content: string;
//   pageNumber: number;
//   score: number;
// }

// function SearchResults({
//   results,
//   isLoading,
//   query,
// }: {
//   results: SearchResult[] | undefined;
//   isLoading: boolean;
//   query: string;
// }) {
//   if (!query.trim()) {
//     return (
//       <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
//         Enter a search query to find relevant passages
//       </div>
//     );
//   }

//   if (isLoading) {
//     return (
//       <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
//         Searching...
//       </div>
//     );
//   }

//   if (!results || results.length === 0) {
//     return (
//       <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
//         No results found
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-col gap-1 overflow-auto">
//       <div className="text-xs text-gray-500 px-1">
//         {results.length} result{results.length !== 1 ? "s" : ""}
//       </div>
//       <div className="flex flex-col gap-2 overflow-auto hideScrollbar">
//         {results.map((result, index) => (
//           <SearchResultCard key={index} result={result} query={query} />
//         ))}
//       </div>
//     </div>
//   );
// }

// function SearchResultCard({
//   result,
//   query,
// }: {
//   result: SearchResult;
//   query: string;
// }) {
//   const { highlightSource } = useCitationHighlightStore();

//   const handleClick = () => {
//     if (highlightSource) {
//       highlightSource(result.pageNumber, result.content);
//     }
//   };

//   const scorePercentage = Math.round(result.score * 100);
//   const scoreColor =
//     scorePercentage >= 70
//       ? "text-green-600 bg-green-50"
//       : scorePercentage >= 50
//       ? "text-yellow-600 bg-yellow-50"
//       : "text-gray-500 bg-gray-50";

//   return (
//     <button
//       onClick={handleClick}
//       className="flex flex-col gap-1 rounded-lg border border-gray-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
//     >
//       <div className="flex items-center justify-between gap-2">
//         <span className="text-xs font-medium text-blue-600">
//           Page {result.pageNumber}
//         </span>
//         <span className={cn("text-xs px-1.5 py-0.5 rounded", scoreColor)}>
//           {scorePercentage}%
//         </span>
//       </div>
//       <p className="text-sm text-gray-700 line-clamp-3">
//         <HighlightedText text={result.content} query={query} />
//       </p>
//     </button>
//   );
// }

// function HighlightedText({ text, query }: { text: string; query: string }) {
//   if (!query.trim()) return <>{text}</>;

//   const words = query
//     .toLowerCase()
//     .split(/\s+/)
//     .filter((w) => w.length > 2);
//   if (words.length === 0) return <>{text}</>;

//   const regex = new RegExp(`(${words.map(escapeRegex).join("|")})`, "gi");
//   const parts = text.split(regex);

//   return (
//     <>
//       {parts.map((part, i) =>
//         words.some((w) => part.toLowerCase() === w) ? (
//           <mark key={i} className="bg-yellow-200 rounded px-0.5">
//             {part}
//           </mark>
//         ) : (
//           part
//         ),
//       )}
//     </>
//   );
// }

// function escapeRegex(str: string): string {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }
