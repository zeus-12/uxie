import Features from "@/components/Features";
import YoutubeEmbed from "@/components/YoutubeEmbed";
import { Button } from "@/components/ui/button";
import SlideUpWhenVisible from "@/hooks/SlideUpWhenVisible";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Github,
  MessageSquarePlus,
} from "lucide-react";
import Balancer from "react-wrap-balancer";

export default function Home() {
  return (
    <>
      <div className="absolute top-0 -z-10 h-full w-full bg-white">
        <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-[rgba(173,109,244,0.5)] opacity-60 blur-[80px]" />
      </div>
      <div className="px-4 py-2 lg:px-16">
        <div className="h-screen ">
          <HeroSection />
        </div>

        <Features />

        <Link
          href="/feedback"
          className="fixed bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-black hover:cursor-pointer"
          title="Submit Feedback"
        >
          <MessageSquarePlus size="24" className="text-gray-300" />
        </Link>
      </div>
      <div className="flex h-screen flex-col items-center justify-center bg-black">
        <h1 className="text-5xl font-semibold tracking-tighter text-white">
          Proudly open-source
        </h1>
        <p className="my-5 max-w-md text-center text-gray-400">
          Our source code is available on GitHub - feel free to read, review, or
          contribute to it however you want!
        </p>
        <a
          href="https://github.com/zeus-12/uxie"
          target="_blank"
          rel="noreferrer"
        >
          <Button className="">
            <Github size="20" className="mr-2" />
            View on GitHub
          </Button>
        </a>
      </div>
    </>
  );
}

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
        <p className="mt-2 max-w-lg text-center text-4xl font-bold tracking-tight text-gray-800 lg:text-5xl">
          <Balancer>Revolutionise your Learning Experience</Balancer>
        </p>
        <p className="text-base text-gray-500 md:text-lg">
          Fueling your learning journey, every step of the way
        </p>
        <Link href="/f" className="group">
          <Button className="mt-2">
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
