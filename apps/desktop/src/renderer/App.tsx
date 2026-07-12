import { useState } from "react";
import { Assistant } from "./assistant";
import { Library } from "./library";
import { Reader } from "./reader";
import { SettingsPage } from "./settings";

type View =
  | { name: "library" }
  | { name: "reader"; id: string }
  | { name: "settings" }
  | { name: "assistant" };

export default function App() {
  const [view, setView] = useState<View>({ name: "library" });
  const toLibrary = () => setView({ name: "library" });

  switch (view.name) {
    case "reader":
      return <Reader id={view.id} onBack={toLibrary} />;
    case "settings":
      return <SettingsPage onBack={toLibrary} />;
    case "assistant":
      return <Assistant onBack={toLibrary} />;
    default:
      return (
        <Library
          onOpen={(id) => setView({ name: "reader", id })}
          onSettings={() => setView({ name: "settings" })}
          onAssistant={() => setView({ name: "assistant" })}
        />
      );
  }
}
