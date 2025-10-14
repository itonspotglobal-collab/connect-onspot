import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface VanessaContextType {
  showVanessaChat: boolean;
  hasInteractedWithVanessa: boolean;
  openVanessa: () => void;
  closeVanessa: () => void;
}

const VanessaContext = createContext<VanessaContextType | undefined>(undefined);

export function VanessaProvider({ children }: { children: ReactNode }) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [hasInteractedWithVanessa, setHasInteractedWithVanessa] = useState(false);

  // Check if user has previously interacted with Vanessa
  useEffect(() => {
    const hasInteracted = localStorage.getItem("hasInteractedWithVanessa") === "true";
    setHasInteractedWithVanessa(hasInteracted);
  }, []);

  // Handle opening Vanessa chat
  const openVanessa = () => {
    setShowVanessaChat(true);
    if (!hasInteractedWithVanessa) {
      localStorage.setItem("hasInteractedWithVanessa", "true");
      setHasInteractedWithVanessa(true);
    }
  };

  const closeVanessa = () => {
    setShowVanessaChat(false);
  };

  return (
    <VanessaContext.Provider
      value={{
        showVanessaChat,
        hasInteractedWithVanessa,
        openVanessa,
        closeVanessa,
      }}
    >
      {children}
    </VanessaContext.Provider>
  );
}

export function useVanessa() {
  const context = useContext(VanessaContext);
  if (context === undefined) {
    throw new Error("useVanessa must be used within a VanessaProvider");
  }
  return context;
}
