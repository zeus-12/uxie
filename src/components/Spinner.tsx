import { Loader2 } from "lucide-react";

export function Spinner() {
  return <Loader2 className="mr-2 h-5 w-5 animate-spin" />;
}

export function SpinnerPage() {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
      <Spinner />
    </div>
  );
}

export function SpinnerCentered() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}
