import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { theme } from "@/lib/theme"

export type MessageType = "user" | "bot"

export interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  isTemporary?: boolean
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type === "user"
  const isTemporary = message.isTemporary === true

  return (
    <div className={cn("flex w-full items-start gap-4 p-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="h-8 w-8 ring-1" style={{ ringColor: theme.colors.primary }}>
          <AvatarImage src="/friendly-robot-assistant.png" alt="Bot" />
          <AvatarFallback
            className="text-white"
            style={{
              background: `linear-gradient(to bottom right, ${theme.colors.secondary}, ${theme.colors.accent})`,
            }}
          >
            Bot
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%]",
          isUser ? "text-white" : "bg-opacity-60 bg-gray-800 border border-opacity-20 text-gray-100",
          isTemporary ? "opacity-70" : "",
        )}
        style={{
          background: isUser
            ? `linear-gradient(to right, ${theme.colors.secondary}, ${theme.colors.accent})`
            : undefined,
          borderColor: isUser ? "transparent" : theme.colors.border,
        }}
      >
        <p className="whitespace-pre-wrap break-words">
          {isTemporary && <span className="inline-block animate-pulse mr-2">⟳</span>}
          {message.content}
        </p>
        <div className={cn("text-xs mt-1", isUser ? "text-gray-200" : "text-gray-400")}>
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 ring-1" style={{ ringColor: theme.colors.primary }}>
          <AvatarImage src="/vibrant-street-market.png" alt="User" />
          <AvatarFallback
            className="text-white"
            style={{
              background: `linear-gradient(to bottom right, ${theme.colors.primary}, ${theme.colors.secondary})`,
            }}
          >
            You
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
