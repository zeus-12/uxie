import Features from "@/components/Features";
import YoutubeEmbed from "@/components/YoutubeEmbed";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      <div>
        <div className="flex flex-col items-center justify-center gap-2 py-8 lg:pt-16">
          <p className="text-center text-4xl font-bold tracking-tight lg:text-5xl">
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
        <Features />
      </div>
    </>
  );
}
