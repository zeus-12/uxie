import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";
import "@blocknote/core/style.css";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  const router = useRouter();
  const isReader = router.pathname.startsWith("/f/");
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {isReader ? (
          <>
            <Component {...pageProps} />
          </>
        ) : (
          <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-2 lg:px-16">
            <Navbar />
            <div className="flex flex-1">
              <Component {...pageProps} />
            </div>
          </main>
        )}
      </ThemeProvider>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
