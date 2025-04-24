import { ChatInterface } from "@/components/chat-interface"
import { IframeHelper } from "@/components/iframe-helper"
import { AuthDebugger } from "@/components/auth-debugger"
import { NavHeader } from "@/components/nav-header"
import { UserWelcome } from "@/components/user-welcome"

export default function ChatPage() {
  return (
    <main className="flex flex-col min-h-screen">
      <IframeHelper />
      <NavHeader />
      <UserWelcome />
      <div className="flex-1 overflow-hidden container mx-auto max-w-4xl py-4">
        <ChatInterface />
      </div>
      <AuthDebugger />
    </main>
  )
}
