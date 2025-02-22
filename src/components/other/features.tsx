import { useFeatureStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useInView } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef } from "react";

const features = [
  {
    title: "Annotate your documents w. ease",
    // imageUrl: "/features/annotation.gif",
    imageUrl:
      "https://g228eq4f8z.ufs.sh/f/D1IgV0cLWt9J5u1MmGUwszom37P105vtiGHyLqcKeJ2dI8Bl",
    description:
      "With text and area highlights (hold ⌥ Option key (Alt), then click and drag), and text-to-speech support",
  },
  {
    title: "Take notes with a notion like editor",
    // imageUrl: "/features/editor.gif",
    imageUrl:
      "https://g228eq4f8z.ufs.sh/f/D1IgV0cLWt9JSFWJYQuo9UWb2a4HE65QvgCLrD0eGtIFkKjZ",
    description:
      "With AI text autocompletion, text enhancement, and export to Markdown.",
  },
  {
    title: "Ask the chatbot anything pdf related",
    // imageUrl: "/features/chatbot.gif",
    imageUrl:
      "https://g228eq4f8z.ufs.sh/f/D1IgV0cLWt9JX0pT27tJIypBdOz9C82rsUL3Gig1vEwaVZPj",
  },
  {
    title: "Generate Flashcards",
    // imageUrl: "/features/flashcard.gif",
    imageUrl:
      "https://g228eq4f8z.ufs.sh/f/D1IgV0cLWt9Jt42d98TFXdbyuZLeUvwgPsj20RQntx4CWNzE",
    description: "Answer the flashcard, and get feedbacks on what you missed.",
  },
  {
    title: "Collaborate with your team",
    // imageUrl: "/features/collab.gif",
    imageUrl:
      "https://g228eq4f8z.ufs.sh/f/D1IgV0cLWt9J9gYv7Fn3aXo1fgS5Kjb0pnRxWzCE6Tve948O",
    description: "With real-time updates.",
  },
];

function Features() {
  return (
    <div className="bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="mx-auto max-w-6xl px-4 md:block 2xl:max-w-[80%]">
        <div>
          <div className="flex w-full items-start gap-20">
            <div className="w-full md:py-[50vh]">
              <ul>
                {features.map((feature, index) => (
                  <li key={index}>
                    <FeatureData
                      id={index}
                      title={feature.title}
                      description={feature.description}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div className="sticky top-0 hidden hd-screen w-full items-center md:flex">
              <FeatureImage />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FeatureImage = () => {
  const inViewFeature = useFeatureStore((state) => state.inViewFeature);

  const curFeature = inViewFeature !== null ? features[inViewFeature] : null;

  return (
    <div className="relative aspect-video h-[25%] w-full rounded-2xl bg-gray-100 lg:h-[40%] [&:has(>_.active-card)]:bg-transparent">
      {curFeature && (
        <Image
          alt="feature"
          src={curFeature.imageUrl}
          width={800}
          height={450}
          className="h-full w-full rounded-md"
          unoptimized={true}
        />
      )}
    </div>
  );
};

export default Features;

type FeatureDataProps = {
  id: number;
  title: string;
  description?: string;
};

export const FeatureData = ({ id, title, description }: FeatureDataProps) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const documentRef = useRef(null);
  const isInView = useInView(ref, {
    margin: "-50% 0px -50% 0px",
    root: documentRef,
  });

  const setInViewFeature = useFeatureStore((state) => state.setInViewFeature);
  const inViewFeature = useFeatureStore((state) => state.inViewFeature);

  useEffect(() => {
    if (isInView) setInViewFeature(id);
    if (!isInView && inViewFeature === id) setInViewFeature(null);
  }, [isInView, id, setInViewFeature, inViewFeature]);

  return (
    <p
      ref={ref}
      className={cn(
        "feature-title font-heading py-16 text-4xl font-semibold tracking-tight transition-colors xl:text-5xl 2xl:text-6xl",
        isInView ? "text-black" : "text-gray-300",
      )}
    >
      {title}
      {description && (
        <span
          className={cn(
            "mt-3 block text-lg font-normal tracking-tight text-gray-400 2xl:text-3xl",
            isInView ? "text-gray-400" : "text-white",
          )}
        >
          {description}
        </span>
      )}
    </p>
  );
};
