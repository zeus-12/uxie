// import Features from "@/components/Features";
import { Button } from "@/components/ui/button";
// import Image from "next/image";
import Link from "next/link";
import LiteYouTubeEmbed from "react-lite-youtube-embed";

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
        <LiteYouTubeEmbed
          id="m97zcPWSceU"
          noCookie={true}
          poster="maxresdefault"
          playerClass="rounded-md"
          title="Uxie | Demo Video"
        />
      </div>
    </>
  );
}

/* <Image
        src="/demo.png"
        width={1000}
        height={500}
        alt="Demo"
        className="rounded-sm"
      /> */

/* <Features /> */
/* <div className="flex justify-center">
        <div className="grid grid-cols-2 gap-2">
          {features.map((item) => (
            <FeatureCard
              title={item.title}
              description={item.description}
              key={item.title}
            />
          ))}
        </div>
      </div> */
// const FeatureCard = ({
//   title,
//   description,
// }: {
//   title: string;
//   description: string;
// }) => {
//   return (
//     <div className="flex max-w-xs flex-col items-center justify-center gap-2 py-8 lg:pt-16">
//       <p className="text-center text-2xl font-bold tracking-tight">{title}</p>
//       <p className="text-base text-gray-400 md:text-lg">{description}</p>
//     </div>
//   );
// };

// const features = [
//   {
//     title: "Annotate your notes w. ease",
//     description: "Text, Image highlight, instantly adds to your notes.",
//   },
//   {
//     title: "Take notes with a notion like editor",
//     description: "Also export it as markdown.",
//   },
//   {
//     title: "Ask the chatbot anything pdf related",
//     description: "Clear all your doubts with a custom trained chatbot.",
//   },
//   {
//     title: "Collaborate with your team",
//     description: "Invite your friends and work together on a document.",
//   },
// ];
