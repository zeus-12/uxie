import YouTube, { YouTubeProps } from "react-youtube";

interface YoutubeEmbedProps {}

const YoutubeEmbed: React.FC<YoutubeEmbedProps> = ({}) => {
  // const onPlayerReady: YouTubeProps["onReady"] = (event: YouTubeEvent<any>) => {
  //   event.target.pauseVideo();
  // };

  const opts: YouTubeProps["opts"] = {
    playerVars: {
      autoplay: 0,
    },
  };

  return (
    <div className="flex w-full flex-col items-center md:mb-48">
      <YouTube
        iframeClassName="rounded-md aspect-[110/67] md:h-96 2xl:h-[45vh] md:w-auto"
        videoId="m97zcPWSceU"
        opts={opts}
      />
    </div>
  );
};

export default YoutubeEmbed;
