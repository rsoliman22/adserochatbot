"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getMsalInstance, isInteractionInProgress, clearMsalStorage, resetMsalCompletely, forceLogin } from "@/lib/auth"
import { RefreshCw, Trash, ExternalLink } from "lucide-react"
import { theme } from "@/lib/theme"

export function AuthDebugger() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebugger, setShowDebugger] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isForcing, setIsForcing] = useState(false)
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null)

  const collectDebugInfo = async () => {
    try {
      const msalInstance = await getMsalInstance()
      const interactionInProgress = await isInteractionInProgress()

      // Try to get session storage items
      let sessionStorageItems = {}
      if (typeof sessionStorage !== "undefined") {
        try {
          const keys = Object.keys(sessionStorage)
          const msalKeys = keys.filter((key) => key.startsWith("msal.") || key.includes("msal"))
          msalKeys.forEach((key) => {
            sessionStorageItems[key] = sessionStorage.getItem(key)
          })
        } catch (e) {
          sessionStorageItems = { error: "Could not access session storage" }
        }
      }

      // Try to get local storage items
      let localStorageItems = {}
      if (typeof localStorage !== "undefined") {
        try {
          const keys = Object.keys(localStorage)
          const msalKeys = keys.filter((key) => key.startsWith("msal.") || key.includes("msal"))
          msalKeys.forEach((key) => {
            localStorageItems[key] = localStorage.getItem(key)
          })
        } catch (e) {
          localStorageItems = { error: "Could not access local storage" }
        }
      }

      // Check for interaction status in a safe way
      let interactionStatus = "Unknown"
      try {
        if (msalInstance && typeof msalInstance.getInteractionStatus === "function") {
          interactionStatus = msalInstance.getInteractionStatus()
        }
      } catch (e) {
        interactionStatus = "Error getting status"
      }

      const debugData = {
        environment: {
          origin: window.location.origin,
          href: window.location.href,
          inIframe: window !== window.top,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
        msalConfig: msalInstance
          ? {
              clientId: msalInstance.getConfiguration().auth.clientId,
              redirectUri: msalInstance.getConfiguration().auth.redirectUri,
              authority: msalInstance.getConfiguration().auth.authority,
              interactionInProgress,
              interactionStatus,
            }
          : "MSAL not initialized",
        accounts: msalInstance ? msalInstance.getAllAccounts() : [],
        activeAccount: msalInstance ? msalInstance.getActiveAccount() : null,
        sessionStorage: sessionStorageItems,
        localStorage: localStorageItems,
      }

      setDebugInfo(debugData)
    } catch (error) {
      setDebugInfo({ error: `Error collecting debug info: ${error}` })
    }
  }

  const clearAuthState = async () => {
    try {
      setIsClearing(true)
      setActionResult(null)

      // Clear all MSAL storage
      clearMsalStorage()

      // Refresh debug info
      await collectDebugInfo()

      setActionResult({ success: true, message: "Authentication state cleared successfully" })
    } catch (error) {
      setActionResult({ success: false, message: `Error clearing state: ${error}` })
    } finally {
      setIsClearing(false)
    }
  }

  const resetAuth = async () => {
    try {
      setIsResetting(true)
      setActionResult(null)

      // Reset MSAL completely
      await resetMsalCompletely()

      // Refresh debug info
      await collectDebugInfo()

      setActionResult({ success: true, message: "MSAL instance reset successfully" })
    } catch (error) {
      setActionResult({ success: false, message: `Error resetting MSAL: ${error}` })
    } finally {
      setIsResetting(false)
    }
  }

  const handleForceLogin = async () => {
    try {
      setIsForcing(true)
      setActionResult(null)

      // Force login
      const success = await forceLogin(true) // Use popup for debugger

      if (success) {
        setActionResult({ success: true, message: "Force login initiated successfully" })
      } else {
        setActionResult({ success: false, message: "Force login failed" })
      }
    } catch (error) {
      setActionResult({ success: false, message: `Error forcing login: ${error}` })
    } finally {
      setIsForcing(false)
    }
  }

  const reloadPage = () => {
    window.location.reload()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!showDebugger ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebugger(true)}
          className="bg-opacity-70 bg-gray-900 text-gray-300 border-opacity-30 hover:bg-gray-800"
          style={{ borderColor: theme.colors.border }}
        >
          Authentication Debug
        </Button>
      ) : (
        <Card
          className="w-96 shadow-lg bg-opacity-90 bg-gray-900 border-opacity-30 text-gray-200"
          style={{ borderColor: theme.colors.border }}
        >
          <CardHeader className="pb-2 border-b border-opacity-20" style={{ borderColor: theme.colors.border }}>
            <CardTitle
              className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-700"
              style={{ color: theme.colors.primary }}
            >
              Authentication Debugger
            </CardTitle>
            <CardDescription className="text-gray-400">Troubleshoot authentication configuration</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                size="sm"
                onClick={collectDebugInfo}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200"
                style={{ borderColor: theme.colors.border }}
              >
                Collect Debug Info
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={clearAuthState}
                disabled={isClearing}
                className="flex items-center bg-red-900 hover:bg-red-800"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Clearing...
                  </>
                ) : (
                  <>
                    <Trash className="h-3 w-3 mr-1" /> Clear Auth State
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={resetAuth}
                disabled={isResetting}
                className="flex items-center bg-gray-700 hover:bg-gray-600 text-gray-200"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Resetting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" /> Reset MSAL
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={handleForceLogin}
                disabled={isForcing}
                className="flex items-center hover:opacity-90"
                style={{ background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})` }}
              >
                {isForcing ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Forcing...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-3 w-3 mr-1" /> Force Login
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={reloadPage}
                className="border-opacity-30 text-gray-300 hover:bg-gray-800"
                style={{ borderColor: theme.colors.border }}
              >
                Reload Page
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDebugger(false)}
                className="border-opacity-30 text-gray-300 hover:bg-gray-800"
                style={{ borderColor: theme.colors.border }}
              >
                Close
              </Button>
            </div>

            {actionResult && (
              <div
                className={`mb-4 p-2 text-sm rounded ${
                  actionResult.success
                    ? "bg-green-900 bg-opacity-50 text-green-200 border border-green-800"
                    : "bg-red-900 bg-opacity-50 text-red-200 border border-red-800"
                }`}
              >
                {actionResult.message}
              </div>
            )}

            {debugInfo && (
              <div
                className="bg-gray-800 bg-opacity-70 p-2 rounded text-xs font-mono overflow-auto max-h-80 text-gray-300 border border-opacity-20"
                style={{ borderColor: theme.colors.border }}
              >
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
