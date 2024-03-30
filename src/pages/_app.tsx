import Navbar from "@/components/navbar";
import { Toaster } from "@/components/ui/toaster";
import { api } from "@/lib/api";
import "@/styles/globals.css";
import "@blocknote/react/style.css";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { DefaultSeo } from "next-seo";
import { type AppType } from "next/app";
import { useRouter } from "next/router";
import { SEO } from "../../next-seo.config";

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
        <Component {...pageProps} />
      ) : (
        <main>
          <Navbar />
          <div className="mx-auto flex flex-col">
            <Component {...pageProps} />
          </div>
        </main>
      )}
      <Toaster />
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
