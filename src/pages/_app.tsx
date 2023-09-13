import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/router";

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
          <main className="mx-auto max-w-5xl px-4 lg:px-16">
            <Navbar />
            <Component {...pageProps} />
          </main>
        )}
      </ThemeProvider>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
