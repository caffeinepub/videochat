import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Message } from "../backend.d";
import { useGetMessages, useSendMessage } from "../hooks/useQueries";
import { UsernameDialog, getUsername } from "./UsernameDialog";

interface ChatPanelProps {
  roomId: string;
}

function formatTime(timestamp: bigint): string {
  const ms = Number(timestamp) / 1_000_000;
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageItem({
  message,
  isOwn,
  index,
}: {
  message: Message;
  isOwn: boolean;
  index: number;
}) {
  return (
    <motion.div
      data-ocid={`chat.messages_list.item.${index + 1}`}
      className={`flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className={`flex items-center gap-2 text-xs text-muted-foreground px-1 ${isOwn ? "flex-row-reverse" : ""}`}
      >
        <span className="font-medium text-foreground/70">{message.sender}</span>
        <span>{formatTime(message.timestamp)}</span>
      </div>
      <div
        className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-secondary text-secondary-foreground rounded-tl-sm"
        }`}
      >
        {message.content}
      </div>
    </motion.div>
  );
}

export function ChatPanel({ roomId }: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [username, setUsername] = useState<string | null>(getUsername());
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages = [] } = useGetMessages(roomId);
  const sendMessageMutation = useSendMessage();

  // Auto-scroll to bottom when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll side-effect on messages array ref
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = inputText.trim();
    if (!content) return;

    if (!username) {
      setPendingMessage(content);
      setShowUsernameDialog(true);
      return;
    }

    await doSend(content, username);
  }

  async function doSend(content: string, sender: string) {
    setInputText("");
    try {
      await sendMessageMutation.mutateAsync({ roomId, sender, content });
    } catch {
      // silently ignore
    }
  }

  function handleUsernameSave(name: string) {
    setUsername(name);
    setShowUsernameDialog(false);
    if (pendingMessage) {
      doSend(pendingMessage, name);
      setPendingMessage(null);
    }
  }

  return (
    <>
      <UsernameDialog open={showUsernameDialog} onSave={handleUsernameSave} />

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/40 flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-display font-semibold text-sm">Chat</span>
          {messages.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0">
          <div
            ref={scrollRef}
            data-ocid="chat.messages_list"
            className="px-4 py-4 space-y-4"
          >
            {messages.length === 0 ? (
              <div
                data-ocid="chat.messages_list.empty_state"
                className="text-center py-8"
              >
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  No messages yet.
                  <br />
                  Say hello!
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <MessageItem
                    key={`${msg.id}-${msg.timestamp}`}
                    message={msg}
                    isOwn={msg.sender === username}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/40 flex-shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              data-ocid="chat.message_input"
              placeholder={username ? "Type a message…" : "Type to chat…"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="bg-input/40 border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 h-10 text-sm"
              maxLength={500}
            />
            <Button
              data-ocid="chat.send_button"
              type="submit"
              size="icon"
              className="w-10 h-10 flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!inputText.trim() || sendMessageMutation.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          {username && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-1">
              Chatting as{" "}
              <span className="text-primary font-medium">{username}</span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
