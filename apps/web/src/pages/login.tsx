import { GoogleIcon } from "@/components/other/icons";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Brain, ChevronLeftIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="mx-auto h-full w-full max-w-5xl flex-1  px-4 py-2 lg:px-16">
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "w-fit justify-start",
        )}
      >
        <>
          <ChevronLeftIcon className="mr-2 h-4 w-4" />
          Back
        </>
      </Link>
      <div className="absolute left-1/2 top-1/2 mx-auto flex h-full flex-1 -translate-x-1/2 -translate-y-1/2 flex-col justify-center space-y-6  sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <Brain className="mx-auto h-6 w-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
        </div>

        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline" }))}
          onClick={() => {
            setIsLoading(true);
            signIn("google");
          }}
          disabled={isLoading}
        >
          {isLoading ? <Spinner /> : <GoogleIcon className="mr-2 h-4 w-4" />}{" "}
          Google
        </button>
      </div>
    </div>
  );
};
export default Login;
