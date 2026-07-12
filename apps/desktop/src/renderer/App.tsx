import { useState } from "react";
import { Library } from "./library";
import { Reader } from "./reader";

type View = { name: "library" } | { name: "reader"; id: string };

export default function App() {
  const [view, setView] = useState<View>({ name: "library" });

  if (view.name === "reader") {
    return (
      <Reader
        id={view.id}
        onBack={() => setView({ name: "library" })}
      />
    );
  }
  return <Library onOpen={(id) => setView({ name: "reader", id })} />;
}
