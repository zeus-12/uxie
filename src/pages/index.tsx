import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] dark:bg-gray-950 dark:bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] dark:[mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      <div className="flex flex-col items-center justify-center gap-2 py-8 lg:pt-16">
        <p className="text-4xl font-semibold tracking-tighter ">
          Create. Collaborate. Captivate.
        </p>
        <p className="text-sm text-gray-400">
          It&apos;s not just reading anymore, It&apos;s a conversation.
        </p>
        <Link href="/f">
          <Button className="mt-2">Get started 🚀</Button>
        </Link>
      </div>
      <Image
        src="/demo.png"
        width={1000}
        height={500}
        alt="Demo"
        className="rounded-sm"
      />
    </div>
  );
}
