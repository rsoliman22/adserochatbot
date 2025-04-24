"use client"

import { type ReactNode, useEffect, useState } from "react"
import {
  loginRequest,
  getMsalInstance,
  msalInitPromise,
  isInIframe,
  isV0Preview,
  getRedirectUri,
  checkPopupSupport,
  clearMsalStorage,
  resetMsalCompletely,
  forceLogin,
  isInteractionInProgress,
  isSpaConfigurationError,
  isRedirectUriMismatchError,
} from "@/lib/auth"
import { useRouter } from "next/navigation"
import { AlertCircle, Info, ExternalLink, AlertTriangle, RefreshCw, Settings } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { theme } from "@/lib/theme"

interface AuthProviderProps {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [currentRedirectUri, setCurrentRedirectUri] = useState<string>("")
  const [popupClosed, setPopupClosed] = useState(false)
  const [popupsSupported, setPopupsSupported] = useState(true)
  const [interactionInProgress, setInteractionInProgress] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [forceLoginAttempted, setForceLoginAttempted] = useState(false)
  const [isSpaError, setIsSpaError] = useState(false)
  const [isRedirectUriError, setIsRedirectUriError] = useState(false)
  const router = useRouter()

  // Function to reset any ongoing interactions
  const resetInteraction = async () => {
    try {
      setIsResetting(true)
      setAuthError(null)
      setIsCancelled(false)
      setPopupClosed(false)
      setInteractionInProgress(false)
      setForceLoginAttempted(false)
      setIsSpaError(false)
      setIsRedirectUriError(false)

      // Reset MSAL completely
      await resetMsalCompletely()

      // Wait a moment to ensure everything is cleared
      await new Promise((resolve) => setTimeout(resolve, 500))

      console.log("Authentication state reset successfully")

      // Reload the page to reset everything
      window.location.reload()
    } catch (error) {
      console.error("Error resetting interaction:", error)
      setIsResetting(false)
    }
  }

  // Function to automatically clear interaction state after a timeout
  const setupInteractionTimeout = () => {
    // If we detect an interaction in progress, set a timeout to clear it
    if (interactionInProgress) {
      console.log("Setting up interaction timeout to auto-clear after 30 seconds")
      setTimeout(async () => {
        const stillInProgress = await isInteractionInProgress()
        if (stillInProgress) {
          console.log("Interaction still in progress after timeout, auto-clearing")
          clearMsalStorage()
          setInteractionInProgress(false)
        }
      }, 30000) // 30 seconds timeout
    }
  }

  useEffect(() => {
    // Set the current redirect URI for display purposes
    setCurrentRedirectUri(getRedirectUri())

    // Check if popups are supported
    const checkPopups = async () => {
      const supported = await checkPopupSupport()
      setPopupsSupported(supported)
      console.log("Popup support:", supported ? "Yes" : "No")
    }

    checkPopups()

    const initializeAuth = async () => {
      try {
        // Wait for MSAL to initialize
        await msalInitPromise
        setIsInitialized(true)

        const msalInstance = await getMsalInstance()
        if (!msalInstance) {
          setIsLoading(false)
          return
        }

        // Check for interaction in progress
        try {
          const inProgress = await isInteractionInProgress()
          setInteractionInProgress(inProgress)

          if (inProgress) {
            console.warn("Interaction in progress detected during initialization")
            setupInteractionTimeout()
          }
        } catch (error) {
          console.error("Error checking interaction status:", error)
        }

        // Handle redirect promise for redirect flow
        if (!isInIframe()) {
          try {
            const result = await msalInstance.handleRedirectPromise()
            // If we have a result, the user was redirected back after authentication
            if (result) {
              console.log("Redirect authentication completed successfully")
              msalInstance.setActiveAccount(result.account)
              setIsAuthenticated(true)
            }
          } catch (error) {
            console.error("Error handling redirect:", error)
            if (isSpaConfigurationError(error)) {
              setIsSpaError(true)
            }
          }
        }

        // Check if user is authenticated
        const accounts = msalInstance.getAllAccounts()
        if (accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0])
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
        setAuthError(error instanceof Error ? error.message : "Authentication initialization failed")
        if (isSpaConfigurationError(error)) {
          setIsSpaError(true)
        }
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const handleLogin = async () => {
    // Prevent multiple authentication attempts
    if (isAuthenticating || isResetting) {
      console.log("Authentication already in progress or resetting, ignoring request")
      return
    }

    try {
      setIsAuthenticating(true)
      setIsCancelled(false)
      setPopupClosed(false)
      setAuthError(null)
      setIsSpaError(false)

      if (!isInitialized) {
        console.error("MSAL not initialized yet")
        setAuthError("Authentication system not initialized yet. Please try again.")
        return
      }

      // Check if there's an interaction in progress
      const msalInstance = await getMsalInstance()
      if (!msalInstance) {
        console.error("MSAL instance not available")
        setAuthError("Authentication system not available. Please try again.")
        return
      }

      // Check if we already have an active account
      if (msalInstance.getActiveAccount()) {
        // If we already have an active account, just set authenticated
        setIsAuthenticated(true)
        setIsAuthenticating(false)
        return
      }

      // Check if there's an interaction in progress
      try {
        const inProgress = await isInteractionInProgress()
        if (inProgress) {
          console.warn("Interaction in progress detected, attempting to clear")
          setInteractionInProgress(true)

          // If we haven't tried force login yet, try it
          if (!forceLoginAttempted) {
            setForceLoginAttempted(true)

            // Try force login
            console.log("Attempting force login to bypass interaction check")
            const usePopup = isInIframe() || (isV0Preview() && popupsSupported)
            const success = await forceLogin(usePopup)

            if (success) {
              console.log("Force login initiated successfully")
              return // Exit early as we're now redirecting or handling popup
            } else {
              console.error("Force login failed")
              // Continue with normal flow but show reset option
            }
          } else {
            // We've already tried force login, suggest reset
            setAuthError("Authentication is already in progress. Please reset the authentication state and try again.")
            return
          }
        }
      } catch (error) {
        console.error("Error checking interaction status:", error)
      }

      // Use popup authentication if in iframe or popups are supported, otherwise use redirect
      if (isInIframe() || (isV0Preview() && popupsSupported)) {
        console.log("Using popup authentication")
        try {
          // Set up a timeout to detect if the popup authentication is taking too long
          const popupTimeout = setTimeout(() => {
            console.log("Popup authentication timeout - assuming popup was closed")
            setPopupClosed(true)
            setIsAuthenticating(false)
          }, 60000) // 1 minute timeout

          // Start the authentication process
          const response = await msalInstance.loginPopup(loginRequest)

          // Clear the timeout since authentication completed
          clearTimeout(popupTimeout)

          if (response) {
            msalInstance.setActiveAccount(response.account)
            setIsAuthenticated(true)
          }
        } catch (error: any) {
          // Check for SPA configuration error
          if (isRedirectUriMismatchError(error)) {
            console.error("Redirect URI mismatch error:", error)
            setIsRedirectUriError(true)
          } else if (isSpaConfigurationError(error)) {
            console.error("SPA configuration error:", error)
            setIsSpaError(true)
          }
          // Check specifically for user_cancelled error
          else if (error.errorCode === "user_cancelled") {
            console.log("User cancelled the login process")
            setIsCancelled(true)
          } else if (error.errorCode === "interaction_in_progress") {
            console.log("Interaction already in progress")
            setInteractionInProgress(true)
            setupInteractionTimeout()
          } else if (
            error.errorCode === "popup_window_closed" ||
            error.message?.includes("window closed") ||
            error.message?.includes("popup")
          ) {
            console.log("Popup window was closed")
            setPopupClosed(true)

            // If we're in the v0 preview, try redirect as a fallback
            if (isV0Preview() && !isInIframe()) {
              console.log("Popup closed, falling back to redirect authentication")
              try {
                await msalInstance.loginRedirect(loginRequest)
                return // Don't set error state as we're redirecting
              } catch (redirectError) {
                console.error("Redirect fallback error:", redirectError)
                if (isSpaConfigurationError(redirectError)) {
                  setIsSpaError(true)
                } else {
                  throw redirectError
                }
              }
            }
          } else {
            throw error // Re-throw other errors to be caught by the outer catch
          }
        }
      } else {
        console.log("Using redirect authentication")
        try {
          await msalInstance.loginRedirect(loginRequest)
        } catch (error) {
          console.error("Redirect authentication error:", error)
          if (isSpaConfigurationError(error)) {
            setIsSpaError(true)
          } else {
            throw error
          }
        }
      }
    } catch (error: any) {
      console.error("Login error:", error)

      // Handle specific error types
      if (isRedirectUriMismatchError(error)) {
        console.error("Redirect URI mismatch error:", error)
        setIsRedirectUriError(true)
      } else if (isSpaConfigurationError(error)) {
        setIsSpaError(true)
      } else if (error.errorCode === "user_cancelled") {
        setIsCancelled(true)
      } else if (error.errorCode === "interaction_in_progress") {
        setInteractionInProgress(true)
        setupInteractionTimeout()
        setAuthError("Authentication is already in progress. Please reset the authentication state and try again.")
      } else if (
        error.errorCode === "popup_window_closed" ||
        error.message?.includes("window closed") ||
        error.message?.includes("popup")
      ) {
        setPopupClosed(true)
      } else {
        setAuthError(error.errorMessage || error.message || "Authentication failed")
      }
    } finally {
      setIsAuthenticating(false)
    }
  }

  // Function to try redirect authentication as a fallback
  const tryRedirectAuth = async () => {
    try {
      setIsAuthenticating(true)

      // Reset MSAL completely before trying redirect
      await resetMsalCompletely()

      // Wait a moment before continuing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Get the new instance and try redirect
      const msalInstance = await getMsalInstance()
      if (msalInstance) {
        await msalInstance.loginRedirect(loginRequest)
      } else {
        throw new Error("Failed to create MSAL instance")
      }
    } catch (error) {
      console.error("Redirect fallback error:", error)
      if (isRedirectUriMismatchError(error)) {
        setIsRedirectUriError(true)
      } else if (isSpaConfigurationError(error)) {
        setIsSpaError(true)
      } else {
        setAuthError("Failed to start redirect authentication. Please try again.")
      }
      setIsAuthenticating(false)
    }
  }

  // Function to try force login
  const handleForceLogin = async () => {
    try {
      setIsAuthenticating(true)
      setAuthError(null)
      setIsSpaError(false)

      const usePopup = isInIframe() || (isV0Preview() && popupsSupported)
      await forceLogin(usePopup)

      // Note: We don't need to set isAuthenticating to false here
      // as we're either redirecting or the popup will handle it
    } catch (error) {
      console.error("Force login error:", error)
      if (isSpaConfigurationError(error)) {
        setIsSpaError(true)
      } else {
        setAuthError("Failed to force login. Please try resetting the authentication state.")
      }
      setIsAuthenticating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
          style={{ borderColor: theme.colors.primary }}
        ></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        style={{
          backgroundImage: "url('/images/new-cosmic-background.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        {/* Overlay for better readability */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(to bottom, ${theme.colors.overlay}, ${theme.colors.overlay})`,
          }}
        ></div>

        <div
          className="w-full max-w-md p-8 space-y-6 rounded-lg shadow-md relative z-10 backdrop-blur-md border border-opacity-20"
          style={{
            backgroundColor: "rgba(18, 24, 38, 0.8)",
            borderColor: theme.colors.border,
          }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
              SharePoint Chatbot
            </h1>
            <p className="mt-2 text-gray-300">Please sign in with your Microsoft 365 account</p>
          </div>

          {isSpaError && (
            <Alert
              variant="destructive"
              className="bg-opacity-70 border-opacity-50"
              style={{
                backgroundColor: "rgba(127, 29, 29, 0.7)",
                borderColor: "rgba(153, 27, 27, 0.5)",
              }}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Azure AD Configuration Error</AlertTitle>
              <AlertDescription>
                <p>
                  Your Azure AD application is not configured as a Single-Page Application (SPA). When using v0 preview
                  or cross-origin authentication, your app must be configured as a SPA in Azure AD.
                </p>
                <div className="mt-2 text-xs">
                  <p className="font-semibold">Required steps:</p>
                  <ol className="list-decimal pl-5 mt-1 space-y-1">
                    <li>Go to your Azure AD app registration in the Azure Portal</li>
                    <li>Navigate to "Authentication" section</li>
                    <li>Under "Platform configurations", add a "Single-page application" platform</li>
                    <li>
                      Add the following redirect URI:{" "}
                      <span className="font-mono p-1 rounded" style={{ backgroundColor: "rgba(127, 29, 29, 0.5)" }}>
                        {currentRedirectUri}
                      </span>
                    </li>
                    <li>Save the changes</li>
                  </ol>
                  <a
                    href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Authentication/appId/0fe31e18-5134-4b69-aff9-4bda86d45a65/isMSAApp/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:text-red-300 mt-2"
                    style={{ color: theme.colors.text.accent }}
                  >
                    <Settings className="h-3 w-3 mr-1" /> Open Azure Portal Configuration
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {isRedirectUriError && (
            <Alert
              variant="destructive"
              className="bg-opacity-70 border-opacity-50"
              style={{
                backgroundColor: "rgba(127, 29, 29, 0.7)",
                borderColor: "rgba(153, 27, 27, 0.5)",
              }}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Redirect URI Not Registered</AlertTitle>
              <AlertDescription>
                <p>
                  The current URL is not registered in your Azure AD application. You need to add the current URL to
                  your Azure AD application's redirect URIs.
                </p>
                <div className="mt-2 text-xs">
                  <p className="font-semibold">Required steps:</p>
                  <ol className="list-decimal pl-5 mt-1 space-y-1">
                    <li>Go to your Azure AD app registration in the Azure Portal</li>
                    <li>Navigate to "Authentication" section</li>
                    <li>Under "Platform configurations", find your SPA configuration</li>
                    <li>
                      Add the following redirect URI:
                      <div className="relative mt-1">
                        <input
                          type="text"
                          readOnly
                          value={currentRedirectUri}
                          className="w-full font-mono text-xs p-1 rounded pr-16"
                          style={{ backgroundColor: "rgba(127, 29, 29, 0.5)" }}
                          onClick={(e) => {
                            const input = e.target as HTMLInputElement
                            input.select()
                            navigator.clipboard.writeText(input.value)
                          }}
                        />
                        <button
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(127, 29, 29, 0.7)" }}
                          onClick={() => navigator.clipboard.writeText(currentRedirectUri)}
                        >
                          Copy
                        </button>
                      </div>
                    </li>
                    <li>Save the changes</li>
                    <li>Return here and try signing in again</li>
                  </ol>
                  <a
                    href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Authentication/appId/0fe31e18-5134-4b69-aff9-4bda86d45a65/isMSAApp/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:text-red-300 mt-2"
                    style={{ color: theme.colors.text.accent }}
                  >
                    <Settings className="h-3 w-3 mr-1" /> Open Azure Portal Configuration
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {interactionInProgress && (
            <Alert
              variant="default"
              className="border-opacity-20"
              style={{
                backgroundColor: "rgba(67, 56, 202, 0.2)",
                borderColor: theme.colors.border,
              }}
            >
              <AlertTriangle className="h-4 w-4" style={{ color: theme.colors.primary }} />
              <AlertTitle>Authentication Already in Progress</AlertTitle>
              <AlertDescription>
                <p>
                  An authentication process is already in progress. This can happen if you started signing in and didn't
                  complete the process.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={resetInteraction}
                    disabled={isResetting}
                    className="flex items-center text-sm font-medium hover:opacity-80"
                    style={{ color: theme.colors.primary }}
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Resetting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" /> Reset Authentication
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleForceLogin}
                    disabled={isAuthenticating || isResetting}
                    className="flex items-center text-sm font-medium hover:opacity-80"
                    style={{ color: theme.colors.primary }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" /> Force Login
                  </button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {popupClosed && (
            <Alert
              variant="default"
              className="border-opacity-20"
              style={{
                backgroundColor: "rgba(67, 56, 202, 0.2)",
                borderColor: theme.colors.border,
              }}
            >
              <Info className="h-4 w-4" style={{ color: theme.colors.primary }} />
              <AlertTitle>Authentication Window Closed</AlertTitle>
              <AlertDescription>
                <p>The authentication popup window was closed before the process completed.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleLogin}
                    className="text-xs underline hover:opacity-80"
                    style={{ color: theme.colors.primary }}
                  >
                    Try again with popup
                  </button>
                  {!isInIframe() && (
                    <button
                      onClick={tryRedirectAuth}
                      className="text-xs underline hover:opacity-80"
                      style={{ color: theme.colors.primary }}
                    >
                      Try with redirect instead
                    </button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {isCancelled && !popupClosed && (
            <Alert
              variant="default"
              className="border-opacity-20"
              style={{
                backgroundColor: "rgba(67, 56, 202, 0.2)",
                borderColor: theme.colors.border,
              }}
            >
              <Info className="h-4 w-4" style={{ color: theme.colors.primary }} />
              <AlertTitle>Authentication cancelled</AlertTitle>
              <AlertDescription>
                You cancelled the sign-in process. Please click the button below to try again.
              </AlertDescription>
            </Alert>
          )}

          {authError && !isCancelled && !popupClosed && !interactionInProgress && !isSpaError && (
            <Alert
              variant="destructive"
              className="bg-opacity-70 border-opacity-50"
              style={{
                backgroundColor: "rgba(127, 29, 29, 0.7)",
                borderColor: "rgba(153, 27, 27, 0.5)",
              }}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Error</AlertTitle>
              <AlertDescription>
                {authError}
                {authError.includes("redirect URI") && (
                  <div className="mt-2 text-xs">
                    <p className="font-semibold">Current redirect URI:</p>
                    <p className="font-mono p-1 rounded mt-1" style={{ backgroundColor: "rgba(127, 29, 29, 0.5)" }}>
                      {currentRedirectUri}
                    </p>
                    <p className="mt-2">
                      Add this URI to your Azure AD app registration in the Authentication section.
                    </p>
                    <a
                      href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Authentication/appId/0fe31e18-5134-4b69-aff9-4bda86d45a65/isMSAApp/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center hover:text-red-300 mt-1"
                      style={{ color: theme.colors.text.accent }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Open Azure Portal
                    </a>
                  </div>
                )}
                {authError.includes("interaction_in_progress") && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={resetInteraction}
                      disabled={isResetting}
                      className="text-xs underline hover:opacity-80 flex items-center"
                      style={{ color: theme.colors.text.accent }}
                    >
                      {isResetting ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Resetting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reset authentication state
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleForceLogin}
                      disabled={isAuthenticating || isResetting}
                      className="text-xs underline hover:opacity-80 flex items-center"
                      style={{ color: theme.colors.text.accent }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Force login
                    </button>
                  </div>
                )}
                {isInIframe() && (
                  <p className="text-xs mt-1">
                    If you're viewing this in a preview or iframe, try opening in a new tab.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <button
              onClick={interactionInProgress ? resetInteraction : handleLogin}
              disabled={isAuthenticating || isResetting}
              className="w-full px-4 py-2 text-white rounded hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`,
                borderColor: theme.colors.primary,
              }}
            >
              {isResetting ? (
                <>
                  <span className="flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Resetting...
                  </span>
                </>
              ) : isAuthenticating ? (
                "Signing in..."
              ) : interactionInProgress ? (
                "Reset Authentication State"
              ) : popupClosed ? (
                "Try Sign In Again"
              ) : isCancelled ? (
                "Try Sign In Again"
              ) : (
                "Sign in with Microsoft 365"
              )}
            </button>

            {interactionInProgress && (
              <button
                onClick={handleForceLogin}
                disabled={isAuthenticating || isResetting}
                className="w-full px-4 py-2 bg-transparent border rounded hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  color: theme.colors.primary,
                  borderColor: theme.colors.primary,
                  backgroundColor: "rgba(196, 163, 105, 0.1)",
                }}
              >
                Force Login (Bypass Interaction Check)
              </button>
            )}

            {!interactionInProgress && isV0Preview() && !isInIframe() && (
              <button
                onClick={tryRedirectAuth}
                disabled={isAuthenticating || isResetting}
                className="w-full px-4 py-2 bg-transparent border rounded hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  color: theme.colors.primary,
                  borderColor: theme.colors.primary,
                  backgroundColor: "rgba(196, 163, 105, 0.1)",
                }}
              >
                Try with redirect authentication
              </button>
            )}
          </div>

          <div
            className="text-center text-xs pt-4 border-t border-opacity-20"
            style={{ borderColor: theme.colors.border, color: theme.colors.text.muted }}
          >
            <button
              onClick={resetInteraction}
              disabled={isResetting}
              className="text-gray-500 hover:text-gray-700 underline flex items-center justify-center mx-auto hover:opacity-80"
              style={{ color: theme.colors.text.muted }}
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Resetting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" /> Reset authentication state
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
