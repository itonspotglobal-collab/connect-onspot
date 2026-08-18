/**
 * Inbox — legacy route kept so existing bookmarks and links don't 404.
 * All messaging now lives at /messages (the canonical implementation).
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Inbox() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/messages", { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
