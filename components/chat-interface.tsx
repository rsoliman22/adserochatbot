"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import { ChatMessage, type Message } from "./chat-message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { processQuery } from "@/lib/chat-service"
import { getActiveAccount } from "@/lib/auth"
import { Send, PlusCircle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { theme } from "@/lib/theme"

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uuidv4(),
      type: "bot",
      content: "Hello! I'm your SharePoint assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()

    // Check if we have an active account
    const checkAuth = async () => {
      try {
        const account = await getActiveAccount()
        if (!account) {
          setAuthError("You don't appear to be signed in. Please refresh the page to sign in again.")
        } else {
          setAuthError(null)
        }
      } catch (error) {
        console.error("Error checking authentication:", error)
        setAuthError("There was a problem verifying your authentication. Please refresh the page.")
      }
    }

    checkAuth()
  }, [])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: uuidv4(),
      type: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Get user info for context
      const account = await getActiveAccount()

      if (!account) {
        throw new Error("No active account found. Please sign in again.")
      }

      const userName = account?.name || "User"

      // Show a temporary "thinking" message
      const thinkingId = uuidv4()
      setMessages((prev) => [
        ...prev,
        {
          id: thinkingId,
          type: "bot",
          content: "Searching SharePoint for relevant information...",
          timestamp: new Date(),
          isTemporary: true,
        },
      ])

      // Process the query
      const response = await processQuery(input.trim(), userName)

      // Remove the temporary message and add the real response
      setMessages((prev) =>
        prev
          .filter((msg) => !msg.isTemporary)
          .concat({
            id: uuidv4(),
            type: "bot",
            content: response,
            timestamp: new Date(),
          }),
      )

      setAuthError(null)
    } catch (error) {
      console.error("Error processing query:", error)

      let errorMessage = "Sorry, I encountered an error while processing your request. Please try again."

      if (error instanceof Error) {
        if (error.message.includes("No active account")) {
          errorMessage = "You don't appear to be signed in. Please refresh the page to sign in again."
          setAuthError("Authentication error: Please refresh the page to sign in again.")
        } else if (error.message.includes("token")) {
          errorMessage = "Your authentication session has expired. Please refresh the page to sign in again."
          setAuthError("Authentication error: Your session has expired.")
        } else if (error.message.includes("Cannot read properties")) {
          errorMessage =
            "I had trouble processing the search results from SharePoint. This might be due to the structure of the data or permissions. Please try a different query."
        }
      }

      // Remove any temporary messages
      setMessages((prev) =>
        prev
          .filter((msg) => !msg.isTemporary)
          .concat({
            id: uuidv4(),
            type: "bot",
            content: errorMessage,
            timestamp: new Date(),
          }),
      )
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const startNewChat = () => {
    setMessages([
      {
        id: uuidv4(),
        type: "bot",
        content: "Hello! I'm your SharePoint assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ])
    setInput("")
    setAuthError(null)
    inputRef.current?.focus()
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div
      className="flex flex-col h-full bg-opacity-70 bg-gray-900 backdrop-blur-md rounded-lg shadow-xl border border-opacity-20"
      style={{ borderColor: theme.colors.border }}
    >
      {/* Chat header */}
      <div
        className="bg-opacity-70 bg-gray-800 p-4 border-b border-opacity-20"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex justify-between items-center">
          <h2
            className="text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-700"
            style={{ color: theme.colors.primary }}
          >
            SharePoint Assistant
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={startNewChat}
            className="flex items-center gap-1 text-gray-200 border-opacity-50 hover:bg-gray-700"
            style={{ borderColor: theme.colors.primary }}
          >
            <PlusCircle className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Auth error alert */}
      {authError && (
        <Alert variant="destructive" className="m-4 bg-opacity-70 bg-red-900 border-red-800 text-white">
          <AlertDescription className="flex justify-between items-center">
            <span>{authError}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              className="flex items-center gap-1 border-red-700 text-white hover:bg-red-800"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-opacity-30 bg-gray-900">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 p-4">
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: theme.colors.primary, animationDelay: "0ms" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: theme.colors.secondary, animationDelay: "150ms" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: theme.colors.primary, animationDelay: "300ms" }}
            ></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="border-t border-opacity-20 p-4 bg-opacity-70 bg-gray-800"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex space-x-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading || !!authError}
            className="flex-1 bg-opacity-50 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-opacity-100 focus:ring-opacity-50"
            style={
              {
                borderColor: theme.colors.border,
                "--tw-ring-color": `${theme.colors.primary}80`,
              } as React.CSSProperties
            }
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading || !!authError}
            size="icon"
            style={{
              background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`,
              borderColor: theme.colors.primary,
            }}
            className="hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
