// Feedback as labelled prose rather than tinted alert boxes. Colour lives in
// the label alone, and a field the model left empty renders nothing at all.
const SECTIONS = [
  { key: "correctResponse", label: "Got right", tone: "text-emerald-700" },
  { key: "incorrectResponse", label: "Missed", tone: "text-red-700" },
  { key: "moreInfo", label: "Context", tone: "text-muted-foreground" },
] as const;

const FlashcardFeedback = ({
  correctResponse,
  wrongResponse,
  moreInfo,
}: {
  correctResponse?: string | null;
  wrongResponse?: string | null;
  moreInfo?: string | null;
}) => {
  const values = {
    correctResponse,
    incorrectResponse: wrongResponse,
    moreInfo,
  };

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ key, label, tone }) => {
        const value = values[key]?.trim();
        if (!value) return null;
        return (
          <div key={key}>
            <span
              className={`text-[11px] font-bold uppercase tracking-[0.1em] ${tone}`}
            >
              {label}
            </span>
            <p className="mt-1.5 break-words text-[13.5px] leading-relaxed">
              {value}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default FlashcardFeedback;
