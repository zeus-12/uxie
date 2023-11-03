import { useEffect } from "react";
import { useInView } from "framer-motion";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useFeatureStore } from "@/lib/store";

const features = [
  {
    title: "Annotate your notes w. ease",
    imageUrl: "",
  },
  {
    title: "Take notes with a notion like editor",
    imageUrl: "",
  },
  {
    title: "Ask the chatbot anything pdf related",
    imageUrl: "",
  },
  {
    title: "Collaborate with your team",
    imageUrl: "",
  },
];

function Features() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <div>
        <div className="flex w-full items-start gap-20">
          <div className="w-full py-[50vh]">
            <ul>
              {features.map((feature, index) => (
                <li key={index}>
                  <FeatureTitle id={index}>{feature.title}</FeatureTitle>
                </li>
              ))}
            </ul>
          </div>
          <div className="sticky top-0 flex h-screen w-full items-center">
            <div className="relative aspect-square w-full rounded-2xl bg-gray-100 [&:has(>_.active-card)]:bg-transparent">
              {features.map((feature, id) => (
                <FeatureCard key={id} id={id}>
                  <Image
                    alt="feature"
                    src={feature.imageUrl}
                    width={200}
                    height={200}
                    className="h-full w-full"
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

type Props = {
  children: React.ReactNode;
  id: number;
};

export const FeatureTitle = ({ children, id }: Props) => {
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
        "feature-title font-heading py-16 text-5xl font-semibold tracking-tight transition-colors",
        isInView ? "text-black" : "text-gray-300",
      )}
    >
      {children}
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
