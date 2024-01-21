import { SpinnerIcon } from "@/components/icons";

export function Spinner() {
  return <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />;
}

export function SpinnerPage() {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
      <Spinner />
    </div>
  );
}
