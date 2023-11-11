import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import "@/styles/globals.css";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import "@blocknote/core/style.css";
import { Toaster } from "@/components/ui/toaster";
import { SEO } from "next-seo.config";
import { DefaultSeo } from "next-seo";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  const router = useRouter();
  const isReader = router.pathname.startsWith("/f/");
  return (
    <SessionProvider session={session}>
      <DefaultSeo {...SEO} />
      {isReader ? (
        <>
          <Component {...pageProps} />
        </>
      ) : (
        <main className="px-4 py-2 lg:px-16">
          <div className="mx-auto flex max-w-5xl flex-col">
            <Navbar />
          </div>
          <div className="mx-auto flex  min-h-screen flex-col">
            <Component {...pageProps} />
          </div>
        </main>
      )}
      <Toaster />
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
