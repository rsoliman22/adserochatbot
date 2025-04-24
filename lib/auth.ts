import {
  PublicClientApplication,
  type Configuration,
  LogLevel,
  type AccountInfo,
  type PopupRequest,
  type RedirectRequest,
  InteractionType,
  InteractionStatus,
  BrowserCacheLocation,
  type PopupWindowAttributes,
} from "@azure/msal-browser"

// Function to check if running in an iframe
export const isInIframe = (): boolean => {
  try {
    return window !== window.top
  } catch (e) {
    // If we can't access window.top, we're likely in an iframe with cross-origin restrictions
    return true
  }
}

// Function to check if we're in a v0 preview environment
export const isV0Preview = (): boolean => {
  if (typeof window === "undefined") return false
  return window.location.hostname.includes("lite.vusercontent.net")
}

// Get the correct redirect URI
export const getRedirectUri = (): string => {
  if (typeof window === "undefined") {
    return "https://v0-it-project.vercel.app"
  }

  // Use the exact current origin to match what the browser will use
  const currentOrigin = window.location.origin

  // Log the redirect URI for debugging
  console.log("Using redirect URI:", currentOrigin)

  return currentOrigin
}

// Configure popup window settings
const popupWindowAttributes: PopupWindowAttributes = {
  popupSize: {
    height: 600,
    width: 480,
  },
  popupPosition: {
    top: 100,
    left: 100,
  },
}

// MSAL configuration
const getMsalConfig = (): Configuration => ({
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID}`,
    redirectUri: getRedirectUri(),
    postLogoutRedirectUri: getRedirectUri(),
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.SessionStorage,
    storeAuthStateInCookie: true,
  },
  system: {
    allowRedirectInIframe: true,
    windowHashTimeout: 60000, // Increase timeout for popup window (default is 60000ms)
    iframeHashTimeout: 10000, // Timeout for iframes
    navigateFrameWait: 500, // How long to wait for the frame to navigate
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message)
            return
          case LogLevel.Info:
            console.info(message)
            return
          case LogLevel.Verbose:
            console.debug(message)
            return
          case LogLevel.Warning:
            console.warn(message)
            return
          default:
            return
        }
      },
      logLevel: LogLevel.Verbose,
    },
  },
})

// Scopes for SharePoint and Microsoft Graph access
export const loginRequest: PopupRequest & RedirectRequest = {
  scopes: ["User.Read", "Sites.Read.All", "Files.Read.All", "Sites.ReadWrite.All"],
  prompt: "select_account", // Force account selection to avoid silent sign-in issues
  popupWindowAttributes, // Add popup window attributes
}

// Create MSAL instance but don't export it directly
let msalInstanceValue: PublicClientApplication | null = null

// Function to clear all MSAL-related storage
export const clearMsalStorage = (): void => {
  if (typeof window === "undefined") return

  try {
    console.log("Clearing all MSAL storage...")

    // Clear session storage
    if (typeof sessionStorage !== "undefined") {
      // Get all keys
      const keys = Object.keys(sessionStorage)

      // Remove all MSAL-related items
      keys.forEach((key) => {
        if (key.startsWith("msal.") || key.includes("msal")) {
          console.log(`Clearing session storage item: ${key}`)
          sessionStorage.removeItem(key)
        }
      })
    }

    // Clear local storage
    if (typeof localStorage !== "undefined") {
      // Get all keys
      const keys = Object.keys(localStorage)

      // Remove all MSAL-related items
      keys.forEach((key) => {
        if (key.startsWith("msal.") || key.includes("msal")) {
          console.log(`Clearing local storage item: ${key}`)
          localStorage.removeItem(key)
        }
      })
    }

    // Clear cookies related to MSAL
    if (document && document.cookie) {
      const cookies = document.cookie.split(";")
      cookies.forEach((cookie) => {
        const cookieName = cookie.split("=")[0].trim()
        if (cookieName.startsWith("msal.") || cookieName.includes("msal")) {
          console.log(`Clearing cookie: ${cookieName}`)
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        }
      })
    }

    console.log("All MSAL storage cleared")
  } catch (e) {
    console.error("Error clearing MSAL storage:", e)
  }
}

// Function to create a new MSAL instance
export const createMsalInstance = async (): Promise<PublicClientApplication> => {
  try {
    // Create a new instance with the current config
    const instance = new PublicClientApplication(getMsalConfig())
    await instance.initialize()
    return instance
  } catch (error) {
    console.error("Failed to create MSAL instance:", error)
    throw error
  }
}

// Initialize MSAL and export the initialization promise
export const msalInitPromise =
  typeof window !== "undefined"
    ? (async () => {
        try {
          // Clear any stale interaction state
          clearMsalStorage()

          // Create a new instance
          const instance = await createMsalInstance()
          msalInstanceValue = instance

          // Register event callbacks
          instance.addEventCallback((event) => {
            if (event.eventType === "msal:loginFailure") {
              console.warn("Login failure event:", event)
            } else if (event.eventType === "msal:loginSuccess") {
              console.log("Login success event")
            }

            // Log interaction status changes
            if (event.interactionType === InteractionType.Popup || event.interactionType === InteractionType.Redirect) {
              console.log(`Interaction event:`, event)
            }
          })

          // Log important configuration for debugging
          console.log("MSAL Configuration:", {
            clientId: getMsalConfig().auth.clientId,
            redirectUri: getMsalConfig().auth.redirectUri,
            authority: getMsalConfig().auth.authority,
            isV0Preview: isV0Preview(),
            isInIframe: isInIframe(),
            hostname: window.location.hostname,
            origin: window.location.origin,
          })

          return instance
        } catch (error) {
          console.error("Failed to initialize MSAL:", error)
          throw error
        }
      })()
    : Promise.resolve(null)

// Export a function to get the initialized MSAL instance
export const getMsalInstance = async (): Promise<PublicClientApplication | null> => {
  if (typeof window === "undefined") return null

  try {
    await msalInitPromise
    return msalInstanceValue
  } catch (error) {
    console.error("Error getting MSAL instance:", error)
    return null
  }
}

// Helper function to get active account
export const getActiveAccount = async (): Promise<AccountInfo | null> => {
  try {
    const msalInstance = await getMsalInstance()
    if (!msalInstance) return null

    // First check if there's an active account
    const activeAccount = msalInstance.getActiveAccount()
    if (activeAccount) return activeAccount

    // If no active account, try to get the first account from all accounts
    const accounts = msalInstance.getAllAccounts()
    if (accounts.length > 0) {
      // Set the first account as active
      msalInstance.setActiveAccount(accounts[0])
      return accounts[0]
    }

    // If we get here, there's no account available
    console.warn("No active account found and no accounts available")
    return null
  } catch (error) {
    console.error("Error getting active account:", error)
    return null
  }
}

// Helper function to handle logout
export const logout = async (): Promise<void> => {
  const msalInstance = await getMsalInstance()
  if (!msalInstance) return

  const logoutRequest = {
    account: msalInstance.getActiveAccount() || undefined,
  }

  try {
    if (isInIframe()) {
      await msalInstance.logoutPopup(logoutRequest)
    } else {
      await msalInstance.logoutRedirect(logoutRequest)
    }
  } catch (error) {
    console.error("Logout error:", error)
  }
}

// Helper function to check if an interaction is in progress
export const isInteractionInProgress = async (): Promise<boolean> => {
  try {
    const msalInstance = await getMsalInstance()
    if (!msalInstance) return false

    // Check if the getInteractionStatus method exists
    if (typeof msalInstance.getInteractionStatus === "function") {
      return msalInstance.getInteractionStatus() === InteractionStatus.InProgress
    }

    // Alternative method: check for interaction in progress using session storage
    if (typeof sessionStorage !== "undefined") {
      const keys = Object.keys(sessionStorage)
      // Look for keys that indicate an interaction is in progress
      return keys.some((key) => key.includes("msal.interaction.status") || key.includes("msal.interaction.in.progress"))
    }

    return false
  } catch (error) {
    console.error("Error checking interaction status:", error)
    return false
  }
}

// Helper function to detect if popups are blocked
export const checkPopupSupport = async (): Promise<boolean> => {
  try {
    // Try to open a test popup
    const testPopup = window.open("about:blank", "_blank", "width=1,height=1")

    // If popup is null or undefined, popups are blocked
    if (!testPopup) {
      return false
    }

    // Close the test popup
    testPopup.close()
    return true
  } catch (e) {
    console.error("Error checking popup support:", e)
    return false
  }
}

// Function to completely reset MSAL and create a new instance
export const resetMsalCompletely = async (): Promise<PublicClientApplication | null> => {
  try {
    console.log("Completely resetting MSAL...")

    // Clear all storage
    clearMsalStorage()

    // Set the current instance to null
    msalInstanceValue = null

    // Create a new instance
    const newInstance = await createMsalInstance()
    msalInstanceValue = newInstance

    console.log("MSAL reset complete")
    return newInstance
  } catch (error) {
    console.error("Failed to reset MSAL completely:", error)
    return null
  }
}

// Function to force login bypassing interaction checks
export const forceLogin = async (usePopup = false): Promise<boolean> => {
  try {
    console.log("Forcing login...")

    // Reset MSAL completely
    await resetMsalCompletely()

    // Get the new instance
    const msalInstance = await getMsalInstance()
    if (!msalInstance) {
      console.error("No MSAL instance available after reset")
      return false
    }

    // Try to login
    if (usePopup || isInIframe()) {
      console.log("Using popup for forced login")
      await msalInstance.loginPopup(loginRequest)
    } else {
      console.log("Using redirect for forced login")
      await msalInstance.loginRedirect(loginRequest)
    }

    return true
  } catch (error) {
    console.error("Force login failed:", error)
    return false
  }
}

// Check if the error is related to SPA configuration
export const isSpaConfigurationError = (error: any): boolean => {
  if (!error) return false

  // Check for the specific error code or message
  return (
    error.errorCode === "invalid_request" ||
    (error.message && error.message.includes("AADSTS9002326")) ||
    (error.message &&
      error.message.includes("Cross-origin token redemption is permitted only for the 'Single-Page Application'"))
  )
}

// Check if the error is related to redirect URI mismatch
export const isRedirectUriMismatchError = (error: any): boolean => {
  if (!error) return false

  // Check for the specific error code or message
  return (
    error.errorCode === "AADSTS50011" ||
    (error.message && error.message.includes("AADSTS50011")) ||
    (error.message && error.message.includes("redirect URI")) ||
    (error.message && error.message.includes("does not match the redirect URIs configured"))
  )
}
