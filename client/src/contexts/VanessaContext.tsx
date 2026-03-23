import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Message {
  id: number | string;
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
  threadId: string | null;
  openVanessa: () => void;
  closeVanessa: () => void;
  resetConversation: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCurrentMessageIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowOptions: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTopic: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
}

const VanessaContext = createContext<VanessaContextType | undefined>(undefined);

const THREAD_SESSION_KEY = "vanessa_thread_id";

export function VanessaProvider({ children }: { children: ReactNode }) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [hasInteractedWithVanessa, setHasInteractedWithVanessa] = useState(false);

  // Shared conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);

  // OpenAI thread ID — persisted to sessionStorage so remounts don't break the thread.
  // TODO: When admin auth is complete, tie threadId to a user/session identifier instead.
  const [threadId, setThreadIdState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(THREAD_SESSION_KEY) || null;
    } catch {
      return null;
    }
  });

  // Sync threadId to sessionStorage whenever it changes
  const setThreadId: React.Dispatch<React.SetStateAction<string | null>> = (value) => {
    setThreadIdState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        if (next) {
          sessionStorage.setItem(THREAD_SESSION_KEY, next);
        } else {
          sessionStorage.removeItem(THREAD_SESSION_KEY);
        }
      } catch {
        // sessionStorage unavailable (e.g. private browsing restrictions) — continue silently
      }
      return next;
    });
  };

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
    // Don't reset conversation — persist across open/close cycles
  };

  const resetConversation = () => {
    setMessages([]);
    setCurrentMessageIndex(0);
    setShowOptions(false);
    setSelectedTopic(null);
    // Clear threadId so the next message starts a fresh OpenAI thread
    setThreadId(null);
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
        threadId,
        openVanessa,
        closeVanessa,
        resetConversation,
        setMessages,
        setCurrentMessageIndex,
        setShowOptions,
        setSelectedTopic,
        setIsMinimized,
        setThreadId,
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
