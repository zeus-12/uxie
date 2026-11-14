import Navbar from "@/components/navbar";
import { ThemeProvider } from "@uxie/shared/components/theme/theme-provider";
import { Toaster } from "@uxie/shared/components/ui/sonner";
import { api } from "@/lib/api";
import "@/styles/globals.css";
import "@blocknote/mantine/style.css";
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
  // Pages that render full-bleed (no navbar chrome).
  const isFullBleed = ["/f/[docId]", "/demo"].includes(router.pathname);

  return (
    <ThemeProvider>
      <SessionProvider session={session}>
        <DefaultSeo {...SEO} />
        {isFullBleed ? (
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
    </ThemeProvider>
  );
};

export default api.withTRPC(MyApp);
