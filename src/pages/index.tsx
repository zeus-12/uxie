import Features from "@/components/other/features";
import SlideUpWhenVisible from "@/components/other/slide-up-when-visible";
import YoutubeEmbed from "@/components/other/youtube-embed";
import { Button } from "@/components/ui/button";
import ButtonRotatingBackgroundGradient from "@/components/ui/button-rotating-bg-gradient";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronRight,
  Github,
  MessageSquarePlus,
} from "lucide-react";
import Link from "next/link";
import Balancer from "react-wrap-balancer";

export default function Home() {
  return (
    <>
      <div className="absolute top-0 -z-10 h-full w-full bg-white">
        <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[20%] translate-y-[20%] rounded-full bg-[rgba(173,109,244,0.5)] opacity-40 blur-[80px]" />
        <div className="hidden md:flex absolute left-0 bottom-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-[rgba(173,109,244,0.5)] opacity-50 blur-[80px]" />
      </div>
      <div className="px-4 py-2 lg:px-16">
        <div className="hd-screen">
          <HeroSection />
        </div>

        <Features />

        <Link
          href="/feedback"
          className="fixed bottom-5 right-5 flex items-center justify-center rounded-full bg-black hover:cursor-pointer"
          title="Submit Feedback"
        >
          <button className="group relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-neutral-950 font-medium text-neutral-200 transition-all duration-300 hover:w-32 ">
            <div className="inline-flex whitespace-nowrap opacity-0 transition-all duration-200 group-hover:-translate-x-3 group-hover:opacity-100">
              Feedback
            </div>
            <div className="absolute right-3">
              <MessageSquarePlus size="22" className="text-gray-300" />
            </div>
          </button>
        </Link>
      </div>
      <div className="flex hd-screen flex-col items-center justify-center bg-black px-4 py-2 lg:px-16">
        <h1 className="text-center text-5xl font-semibold tracking-tighter text-white 2xl:text-7xl">
          Proudly open-source
        </h1>
        <p className="my-5 max-w-md text-center text-gray-400 2xl:max-w-lg 2xl:text-2xl">
          Our source code is available on GitHub - feel free to read, review, or
          contribute to it however you want!
        </p>
        <a
          href="https://github.com/zeus-12/uxie"
          target="_blank"
          rel="noreferrer"
        >
          <ButtonRotatingBackgroundGradient>
            <Github size="18" className="mr-2" />
            View on GitHub
          </ButtonRotatingBackgroundGradient>
        </a>
      </div>
    </>
  );
}

const positions = [
  "-left-5 top-3 group-hover:-rotate-[10deg] group-hover:-translate-y-12 md:-left-10 md:-top-2 sm:-left-5",
  "-left-5 top-0 group-hover:-rotate-[20deg] group-hover:-translate-x-10 md:-left-10 md:-top-2 sm:-left-5",
  "-right-5 top-3 group-hover:rotate-[10deg] group-hover:-translate-y-12 md:-right-10 md:-top-2 sm:-right-5",
  "-right-5 top-0 group-hover:rotate-[20deg] group-hover:translate-x-10 md:-right-10 md:-top-2 sm:-right-5",
] as const;

const learningIcons = ["📚", "🎓", "📖", "🧠"] as const;
const aiIcons = ["🤖", "🧑‍💻", "🔍", "📊"] as const;
const superchargesIcon = ["🚀", "🔥", "💡", "🌟"] as const;

const HeroSection = () => {
  return (
    <SlideUpWhenVisible>
      <div className="flex flex-col items-center justify-center gap-2 py-4 lg:py-8">
        <a
          className="group mx-auto flex max-w-fit items-center justify-center space-x-2 overflow-hidden rounded-full border border-gray-200 bg-white px-6 py-2 shadow-[inset_10px_-50px_94px_0_rgb(199,199,199,0.1)] backdrop-blur transition-all hover:border-gray-300 hover:bg-white/50"
          href="https://www.youtube.com/watch?v=7viW-0fpOYY"
          target="_blank"
        >
          <p className="text-sm font-semibold text-gray-700 [text-wrap:balance]">
            Introducing AI Generated Flashcards 📚
          </p>
          <div className="group relative flex items-center">
            <ChevronRight className="absolute -ml-1 h-3.5 w-3.5 transition-all group-hover:translate-x-1 group-hover:opacity-0" />
            <ArrowRight className="absolute -ml-1 h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
          </div>
        </a>

        <Balancer className="2xl:text-[5rem] mt-2 max-w-4xl text-center text-4xl font-semibold tracking-tight text-[#013720] sm:text-5xl lg:text-[3.5rem] lg:leading-none">
          <span className="opacity-[.32]">The</span>{" "}
          <EmojiAnimate icons={aiIcons} text="AI-Powered PDF Reader" />{" "}
          <span className="opacity-[.32]">That</span>{" "}
          <EmojiAnimate icons={superchargesIcon} text="Supercharges" />{" "}
          <span className="opacity-[.32]">Your</span>{" "}
          <EmojiAnimate icons={learningIcons} text="Learning" />
        </Balancer>

        <p className="text-center text-md text-gray-500 md:text-xl max-w-xl md:my-3">
          Uxie turns PDFs into interactive learning tools with AI-powered
          summaries and flashcards
        </p>
        <Link href="/f" className="group">
          <Button>
            Get started
            <span className="ml-2 transition-all  group-hover:animate-pulse">
              🚀
            </span>
          </Button>
        </Link>
      </div>
      <YoutubeEmbed />
    </SlideUpWhenVisible>
  );
};

// CREDITS: https://animata.design/docs/hero/hero-section-text-hover
const EmojiAnimate = ({
  text,
  icons,
}: {
  text: string;
  icons: readonly string[];
}) => {
  return (
    <div className="group relative inline-flex items-center">
      <span className="group-hover:bg-pink-200">{text}</span>
      <div className="duration-400 absolute inset-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100">
        {icons.map((emoji, index) => (
          <span
            key={index}
            className={cn(
              "pointer-events-none absolute -top-10 transform text-lg transition-transform duration-500 group-hover:scale-105 sm:text-2xl md:text-4xl",
              positions[index],
            )}
          >
            {emoji}
          </span>
        ))}
      </div>
    </div>
  );
};
