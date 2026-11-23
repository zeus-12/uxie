import { useMediaQuery } from "usehooks-ts";
import { usePdfSettingsStore } from "../lib/store";

// Reflow starts from a pinch, so the setting only exists on touch devices.
export const useReflowOnZoom = () => {
  const available = useMediaQuery("(pointer: coarse)");
  const enabled = usePdfSettingsStore((state) => state.reflowOnZoom);
  return { available, enabled: available && enabled };
};
