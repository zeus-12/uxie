import { BugIcon, InfoIcon, ThumbsUp } from "lucide-react";

const Feedback = ({
  correctResponse,
  wrongResponse,
  moreInfo,
}: {
  correctResponse?: string | null;
  wrongResponse?: string | null;
  moreInfo?: string | null;
}) => {
  return (
    <div className="space-y-4">
      {correctResponse && (
        <div className="rounded-md bg-[#f0fff4] p-4">
          <h4 className="mb-2 flex items-center text-sm font-semibold text-green-700">
            <ThumbsUp size="18" className="mr-1" />
            What you got right
          </h4>
          <p className="text-sm">{correctResponse}</p>
        </div>
      )}
      {wrongResponse && (
        <div className="rounded-md bg-[#fef2f2] p-4">
          <h4 className="mb-2 flex items-center text-sm font-semibold text-red-700">
            <BugIcon size="18" className="mr-1" />
            What you got wrong
          </h4>
          <p className="text-sm">{wrongResponse}</p>
        </div>
      )}
      {moreInfo && (
        <div className="rounded-md bg-[#ebf4ff] p-4">
          <h4 className="mb-2 flex items-center text-sm font-semibold text-blue-700">
            <InfoIcon size="18" className="mr-1" />
            More info
          </h4>
          <p className="text-sm">{moreInfo}</p>
        </div>
      )}
    </div>
  );
};

export default Feedback;
