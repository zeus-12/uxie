import Features from "@/components/Features";
import YoutubeEmbed from "@/components/YoutubeEmbed";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="absolute top-0 -z-10 h-full w-full bg-white">
        <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-[rgba(173,109,244,0.5)] opacity-50 blur-[80px]"></div>
      </div>

      {/* <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-fuchsia-400 opacity-20 blur-[100px]"></div>
      </div> */}

      <div>
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
        <Features />
      </div>
    </>
  );
}
