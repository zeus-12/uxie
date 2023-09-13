import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="flex flex-col items-center justify-center gap-2 py-8 lg:pt-16  ">
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
    </>
  );
}
