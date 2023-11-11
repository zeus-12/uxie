import YouTube, { YouTubeProps } from "react-youtube";

interface YoutubeEmbedProps {}

const YoutubeEmbed: React.FC<YoutubeEmbedProps> = ({}) => {
  // const onPlayerReady: YouTubeProps["onReady"] = (event: YouTubeEvent<any>) => {
  //   event.target.pauseVideo();
  // };

  const opts: YouTubeProps["opts"] = {
    height: "390",
    width: "640",

    playerVars: {
      autoplay: 0,
    },
  };
  return (
    <div className="mb-48 flex flex-col items-center">
      <YouTube
        iframeClassName="rounded-md aspect-video h-96  max-w-[90vw]"
        videoId="m97zcPWSceU"
        opts={opts}
        // onReady={onPlayerReady}
      />
    </div>
  );
};

export default YoutubeEmbed;
