import { useMediaQuery } from "usehooks-ts";
import { usePdfSettingsStore } from "../lib/store";

// Reflow starts from a touch pinch, so the setting needs a touchscreen.
export const useReflowOnZoom = () => {
  const available = useMediaQuery("(any-pointer: coarse)");
  const enabled = usePdfSettingsStore((state) => state.reflowOnZoom);
  return { available, enabled: available && enabled };
};
