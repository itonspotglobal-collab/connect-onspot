import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Message {
  id: number;
  text: string;
  sender: "vanessa" | "user";
  isTyping?: boolean;
}

interface VanessaContextType {
  showVanessaChat: boolean;
  hasInteractedWithVanessa: boolean;
  messages: Message[];
  currentMessageIndex: number;
  showOptions: boolean;
  selectedTopic: string | null;
  isMinimized: boolean;
  openVanessa: () => void;
  closeVanessa: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCurrentMessageIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowOptions: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTopic: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
}

const VanessaContext = createContext<VanessaContextType | undefined>(undefined);

export function VanessaProvider({ children }: { children: ReactNode }) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [hasInteractedWithVanessa, setHasInteractedWithVanessa] = useState(false);
  
  // Shared conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);

  // Check if user has previously interacted with Vanessa
  useEffect(() => {
    const hasInteracted = localStorage.getItem("hasInteractedWithVanessa") === "true";
    setHasInteractedWithVanessa(hasInteracted);
  }, []);

  // Handle opening Vanessa chat
  const openVanessa = () => {
    setShowVanessaChat(true);
    setIsMinimized(false);
    if (!hasInteractedWithVanessa) {
      localStorage.setItem("hasInteractedWithVanessa", "true");
      setHasInteractedWithVanessa(true);
    }
  };

  const closeVanessa = () => {
    setShowVanessaChat(false);
    setIsMinimized(true);
  };

  return (
    <VanessaContext.Provider
      value={{
        showVanessaChat,
        hasInteractedWithVanessa,
        messages,
        currentMessageIndex,
        showOptions,
        selectedTopic,
        isMinimized,
        openVanessa,
        closeVanessa,
        setMessages,
        setCurrentMessageIndex,
        setShowOptions,
        setSelectedTopic,
        setIsMinimized,
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
