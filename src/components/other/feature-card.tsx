import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const FeatureCard = ({
  isLoading,
  bulletPoints,
  onClick,
  buttonText,
  subtext,
  title,
}: {
  isLoading: boolean;
  bulletPoints: string[];
  onClick: () => void;
  buttonText: string;
  subtext: string;
  title: string;
}) => {
  return (
    <div className="mx-auto flex h-full w-[90%] max-w-[30rem] flex-col justify-center">
      <p className="text-2xl font-bold tracking-tight">{title}</p>
      <p className="my-2 text-lg font-normal text-gray-500">{subtext}</p>

      <ul>
        {bulletPoints.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>

      <Button className="mt-4 md:mt-6" disabled={isLoading} onClick={onClick}>
        {isLoading && <Spinner />}
        {buttonText}
      </Button>
      {/* choose pages, and number of qns */}
    </div>
  );
};
export default FeatureCard;
