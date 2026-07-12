import { LoaderIcon } from "lucide-react";

export function Spinner() {
  return <LoaderIcon className="mr-2 h-5 w-5 animate-spin" />;
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

// export function Spinner() {
//   const bars = Array(12).fill(0);

//   return (
//     <div className="h-[24px] w-[24px]">
//       <div className="relative left-1/2 top-1/2 h-[inherit] w-[inherit]">
//         {bars.map((_, i) => (
//           <div
//             key={`spinner-bar-${i}`}
//             aria-label={`spinner-bar-${i + 1}`}
//             className={`animate-spinner absolute -left-[10%] -top-[3.9%] h-[8%] w-[24%] rounded-md bg-neutral-400 bar:nth-child(${
//               i + 1
//             })`}
//             style={{
//               animationDelay: `-${1.3 - i * 0.1}s`,
//               transform: `rotate(${30 * i}deg) translate(146%)`,
//             }}
//           />
//         ))}
//       </div>
//     </div>
//   );
// }
