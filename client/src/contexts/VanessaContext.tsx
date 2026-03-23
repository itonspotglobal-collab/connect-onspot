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

// localStorage keys
const THREAD_ID_KEY = "vanessa_thread_id";
const MESSAGES_KEY = "vanessa_messages";

// Safe localStorage helpers
function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage unavailable — continue silently
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Continue silently
  }
}

export function VanessaProvider({ children }: { children: ReactNode }) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [hasInteractedWithVanessa, setHasInteractedWithVanessa] = useState(false);

  // Restore threadId from localStorage on first load.
  // localStorage persists across page reloads, new tabs, and browser restarts —
  // which is what keeps one browser session mapped to one OpenAI thread.
  // TODO: When admin auth is complete, tie threadId to the authenticated user's ID instead.
  const [threadId, setThreadIdState] = useState<string | null>(() => {
    const stored = lsGet(THREAD_ID_KEY);
    if (stored) {
      console.log(`[VanessaContext] Restored threadId from localStorage: ${stored}`);
    }
    return stored;
  });

  // Restore messages from localStorage so the UI stays in sync with the thread.
  // Opening messages are only shown when messages.length === 0, so restoring them
  // here safely skips the intro sequence for returning visitors.
  const [messages, setMessagesState] = useState<Message[]>(() => {
    try {
      const raw = lsGet(MESSAGES_KEY);
      if (!raw) return [];
      const parsed: Message[] = JSON.parse(raw);
      // Strip any "typing" bubbles that were mid-stream when the page was last closed
      return parsed.map((m) => ({ ...m, isTyping: false }));
    } catch {
      return [];
    }
  });

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);

  // Sync threadId to localStorage whenever it changes
  const setThreadId: React.Dispatch<React.SetStateAction<string | null>> = (value) => {
    setThreadIdState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) {
        lsSet(THREAD_ID_KEY, next);
        console.log(`[VanessaContext] threadId saved to localStorage: ${next}`);
      } else {
        lsRemove(THREAD_ID_KEY);
        console.log("[VanessaContext] threadId cleared from localStorage");
      }
      return next;
    });
  };

  // Wrapper that syncs to state AND localStorage simultaneously
  const setMessages: React.Dispatch<React.SetStateAction<Message[]>> = (value) => {
    setMessagesState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      // Only persist finished messages (skip mid-stream typing bubbles)
      const toStore = next.filter((m) => !m.isTyping);
      try {
        lsSet(MESSAGES_KEY, JSON.stringify(toStore));
      } catch {
        // Continue silently if stringify fails
      }
      return next;
    });
  };

  // Check if user has previously interacted with Vanessa
  useEffect(() => {
    const hasInteracted = lsGet("hasInteractedWithVanessa") === "true";
    setHasInteractedWithVanessa(hasInteracted);
  }, []);

  // Handle opening Vanessa chat
  const openVanessa = () => {
    setShowVanessaChat(true);
    setIsMinimized(false);
    if (!hasInteractedWithVanessa) {
      lsSet("hasInteractedWithVanessa", "true");
      setHasInteractedWithVanessa(true);
    }
  };

  const closeVanessa = () => {
    setShowVanessaChat(false);
    setIsMinimized(true);
    // Don't reset conversation — persist across open/close cycles
  };

  const resetConversation = () => {
    setMessagesState([]);
    lsRemove(MESSAGES_KEY);
    setCurrentMessageIndex(0);
    setShowOptions(false);
    setSelectedTopic(null);
    // Clear threadId so the next message starts a completely fresh OpenAI thread
    setThreadIdState(null);
    lsRemove(THREAD_ID_KEY);
    console.log("[VanessaContext] Conversation reset — threadId and messages cleared from localStorage");
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
