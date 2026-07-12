export const SEO = {
  title: "Uxie",
  description: "Revolutionise your Learning Experience.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "UXIE",
    // // url: "https://uxie.vercel.app/",
    siteName: "Uxie",
    images: [
      // { url: "https://uxie.vercel.app/logo.png" },
      {
        url: "https://uxie.vercel.app/og.png",
        width: 800,
        height: 600,
        alt: "Og Image",
        type: "image/jpeg",
      },
    ],
  },

  themeColor: "light",
  additionalMetaTags: [
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1.0",
    },
    {
      name: "application-name",
      content: "Uxie",
    },
  ],

  additionalLinkTags: [
    {
      rel: "icon",
      href: "https://uxie.vercel.app/favicon.ico",
    },
  ],
};
