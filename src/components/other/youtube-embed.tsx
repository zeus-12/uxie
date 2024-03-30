import YouTube, { YouTubeProps } from "react-youtube";

interface YoutubeEmbedProps {}

const YoutubeEmbed: React.FC<YoutubeEmbedProps> = ({}) => {
  const opts: YouTubeProps["opts"] = {
    playerVars: {
      autoplay: 0,
    },
  };

  return (
    <div className="flex w-full flex-col items-center md:mb-48">
      <YouTube
        iframeClassName="rounded-md aspect-[110/67] md:h-96 w-[90vw] md:w-auto"
        videoId="m97zcPWSceU"
        opts={opts}
      />
    </div>
  );
};

export default YoutubeEmbed;
