import Features from "@/components/Features";
import YoutubeEmbed from "@/components/YoutubeEmbed";
import { Button } from "@/components/ui/button";
import SlideUpWhenVisible from "@/hooks/SlideUpWhenVisible";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";

export default function Home() {
  return (
    <>
      <div className="absolute top-0 -z-10 h-full w-full bg-white">
        <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-[rgba(173,109,244,0.5)] opacity-50 blur-[80px]" />
      </div>
      <div className="px-4 py-2 lg:px-16">
        <SlideUpWhenVisible>
          <div className="flex flex-col items-center justify-center gap-2 py-8 lg:pt-16">
            <p className="text-center text-4xl font-semibold tracking-tight lg:text-5xl">
              Create. Collaborate. Captivate.
            </p>
            <p className="text-base text-gray-400 md:text-lg">
              It&apos;s not just reading anymore, It&apos;s a conversation.
            </p>
            <Link href="/f">
              <Button className="mt-2">Get started 🚀</Button>
            </Link>
          </div>
          <YoutubeEmbed />
        </SlideUpWhenVisible>
        <Features />
        <Link
          href="/feedback"
          className="fixed bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-black hover:cursor-pointer"
          title="Submit Feedback"
        >
          <MessageSquarePlus size="24" className="text-gray-300" />
        </Link>
      </div>
    </>
  );
}
