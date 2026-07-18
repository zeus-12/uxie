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

  // ?v=3 busts the browser's (very sticky) favicon cache; bump it whenever the
  // icon changes.
  additionalLinkTags: [
    {
      rel: "icon",
      href: "/favicon.ico?v=3",
      sizes: "any",
    },
    {
      rel: "icon",
      href: "/favicon.svg?v=3",
      type: "image/svg+xml",
    },
    {
      rel: "apple-touch-icon",
      href: "/apple-touch-icon.png?v=3",
    },
  ],
};
