import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import Sidebar from "@/components/workspace/sidebar";
import { PanelBottomOpen } from "lucide-react";

const SidebarDrawer = ({
  canEdit,
  isOwner,
  isVectorised,
  setIsOpen,
  isOpen,
  note,
}: {
  canEdit: boolean;
  isOwner: boolean;
  isVectorised: boolean;
  setIsOpen: (o: boolean) => void;
  isOpen: boolean;
  note: string | null;
}) => {
  return (
    <Drawer open={isOpen} onOpenChange={(o) => setIsOpen(o)}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm">
          <PanelBottomOpen className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-5/6 mx-auto w-full bg-gray-50">
        <DrawerTitle className="hidden">Sidebar</DrawerTitle>
        <DrawerDescription className="hidden">
          Sidebar with chat, notes, flashcards
        </DrawerDescription>
        <div className="overflow-auto h-full">
          <Sidebar
            note={note}
            canEdit={canEdit}
            isOwner={isOwner}
            isVectorised={isVectorised}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default SidebarDrawer;
