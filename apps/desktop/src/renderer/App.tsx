import { useState } from "react";
import { Library } from "./library";
import { Reader } from "./reader";
import { SettingsDialog } from "./settings";

type View = { name: "library" } | { name: "reader"; id: string };

export default function App() {
  const [view, setView] = useState<View>({ name: "library" });
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {view.name === "reader" ? (
        <Reader
          id={view.id}
          onBack={() => setView({ name: "library" })}
          onSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <Library
          onOpen={(id) => setView({ name: "reader", id })}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
