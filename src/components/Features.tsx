import { useEffect } from "react";
import { useInView } from "framer-motion";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useFeatureStore } from "@/lib/store";

const features = [
  {
    title: "Annotate your notes w. ease",
    imageUrl: "/features/annotation.gif",
    description:
      "To create area highlight hold ⌥ Option key (Alt), then click and drag.",
  },
  {
    title: "Take notes with a notion like editor",
    imageUrl: "/features/editor.gif",
    description: "With export to Markdown.",
  },
  {
    title: "Ask the chatbot anything pdf related",
    imageUrl: "/features/chatbot.gif",
  },
  {
    title: "Collaborate with your team",
    imageUrl: "/features/collab.gif",
    description: "With real-time updates.",
  },
  {
    title: "AI-powered autocompletion",
    imageUrl: "/features/completion.gif",
    description: "Add '++' to the end of a sentence to autocomplete.",
  },
];

function Features() {
  return (
    <div className="mx-auto hidden max-w-6xl px-4 md:block">
      <div>
        <div className="flex w-full items-start gap-20">
          <div className="w-full py-[50vh]">
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
          <div className="sticky top-0 flex h-screen w-full items-center">
            <div className="relative aspect-video h-[25%] w-full rounded-2xl bg-gray-100 lg:h-[40%] [&:has(>_.active-card)]:bg-transparent">
              {features.map((feature, id) => (
                <FeatureCard key={id} id={id}>
                  <Image
                    alt="feature"
                    src={feature.imageUrl}
                    width={800}
                    height={450}
                    className="h-full w-full rounded-md"
                    unoptimized={true}
                  />
                </FeatureCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        "feature-title font-heading py-16 text-4xl font-semibold tracking-tight transition-colors xl:text-5xl",
        isInView ? "text-black" : "text-gray-300",
      )}
    >
      {title}
      {description && (
        <span
          className={cn(
            "mt-3 block text-lg font-normal tracking-tight text-gray-400",
            isInView ? "text-gray-400" : "text-white",
          )}
        >
          {description}
        </span>
      )}
    </p>
  );
};

type FeatureCardProps = {
  children: React.ReactNode;
} & CardProps;

type CardProps = {
  id: number;
};

const FeatureCard = ({ children, id }: FeatureCardProps) => {
  const inViewFeature = useFeatureStore((state) => state.inViewFeature);

  return (
    <div
      className={cn(
        "absolute inset-0 h-full w-full rounded-2xl transition-opacity",
        inViewFeature === id
          ? "active-card opacity-100"
          : "pointer-events-none opacity-0",
      )}
    >
      <div
        className={cn(
          "gradient absolute inset-0 origin-bottom-left rounded-2xl bg-gradient-to-br",
        )}
      />
      {children}
    </div>
  );
};
