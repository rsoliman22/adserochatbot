import { NavHeader } from "@/components/nav-header"
import { IframeHelper } from "@/components/iframe-helper"
import { AuthDebugger } from "@/components/auth-debugger"
import { UserWelcome } from "@/components/user-welcome"
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"
import Link from "next/link"
import { theme } from "@/lib/theme"

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <IframeHelper />
      <NavHeader />
      <UserWelcome />
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="max-w-md w-full text-center space-y-6 bg-opacity-70 bg-gray-900 backdrop-blur-md p-8 rounded-lg shadow-xl border border-opacity-20"
          style={{ borderColor: theme.colors.border }}
        >
          <h2
            className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-700"
            style={{ color: theme.colors.primary }}
          >
            Welcome to SharePoint Chatbot
          </h2>
          <p className="text-gray-300">
            Ask questions about your SharePoint content and get instant answers powered by AI.
          </p>
          <Link href="/chat">
            <Button
              style={{
                background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`,
                borderColor: theme.colors.primary,
              }}
              className="hover:opacity-90 border-0"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Start Chatting
            </Button>
          </Link>
        </div>
      </div>
      <AuthDebugger />
    </main>
  )
}
