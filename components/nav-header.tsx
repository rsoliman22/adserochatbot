"use client"

import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { logout } from "@/lib/auth"
import { theme } from "@/lib/theme"

export function NavHeader() {
  const pathname = usePathname()
  const router = useRouter()

  const startNewChat = () => {
    router.push("/chat")
  }

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <header
      className="bg-opacity-70 bg-gray-900 backdrop-blur-md text-white p-4 shadow-lg border-b border-opacity-20"
      style={{ borderColor: theme.colors.primary }}
    >
      <div className="container mx-auto flex justify-between items-center">
        <h1
          className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-700"
          style={{ color: theme.colors.primary }}
        >
          SharePoint Chatbot
        </h1>
        <div className="flex items-center gap-2">
          {pathname !== "/chat" && (
            <Button
              variant="outline"
              size="sm"
              onClick={startNewChat}
              className="text-white border-opacity-50 hover:bg-gray-800 hover:text-white"
              style={{ borderColor: theme.colors.primary }}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              New Chat
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white hover:bg-gray-800 hover:text-white"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}
