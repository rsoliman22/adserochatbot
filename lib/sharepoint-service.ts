import { getMsalInstance, loginRequest, getActiveAccount } from "./auth"

// Base URL for Microsoft Graph API
const GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0"

// Function to get access token with retry
const getAccessToken = async (retryCount = 0): Promise<string> => {
  try {
    const msalInstance = await getMsalInstance()
    if (!msalInstance) throw new Error("MSAL instance not initialized")

    const account = await getActiveAccount()
    if (!account) {
      // If no active account and we haven't retried yet, try to get accounts again
      if (retryCount < 2) {
        console.log("No active account found, checking all accounts...")
        const accounts = msalInstance.getAllAccounts()
        if (accounts.length > 0) {
          console.log("Found account, setting as active...")
          msalInstance.setActiveAccount(accounts[0])
          // Retry with the newly set active account
          return getAccessToken(retryCount + 1)
        }
      }
      throw new Error("No active account")
    }

    // Try to acquire token silently
    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      })
      return response.accessToken
    } catch (silentError) {
      console.error("Silent token acquisition failed, trying popup:", silentError)

      // If silent acquisition fails, try popup
      const response = await msalInstance.acquireTokenPopup({
        ...loginRequest,
        account,
      })
      return response.accessToken
    }
  } catch (error) {
    console.error("Error getting access token:", error)
    throw error
  }
}

// Function to search SharePoint content
export const searchSharePoint = async (query: string) => {
  try {
    const accessToken = await getAccessToken()

    // Using Microsoft Search API to search across SharePoint
    const response = await fetch(`${GRAPH_ENDPOINT}/search/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            entityTypes: ["driveItem", "listItem", "site", "list"],
            query: {
              queryString: query,
            },
            from: 0,
            size: 10,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Error searching SharePoint: ${response.statusText}`)
    }

    const data = await response.json()

    // Ensure we have a consistent structure even if the API response changes
    if (!data || !data.value) {
      console.log("Search response missing expected structure:", data)
      return { value: [] }
    }

    // Log the first result to help with debugging
    if (data.value && data.value.length > 0) {
      console.log("First search result structure:", JSON.stringify(data.value[0], null, 2))
    }

    return data
  } catch (error) {
    console.error("Error searching SharePoint:", error)
    // Return an empty result set on error
    return { value: [] }
  }
}

// Function to get document content
export const getDocumentContent = async (driveId: string, itemId: string) => {
  try {
    const accessToken = await getAccessToken()

    // Get document content
    const response = await fetch(`${GRAPH_ENDPOINT}/drives/${driveId}/items/${itemId}/content`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Error getting document content: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    console.error("Error getting document content:", error)
    return "Could not retrieve document content."
  }
}

// Function to get site information
export const getSiteInfo = async (siteId: string) => {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(`${GRAPH_ENDPOINT}/sites/${siteId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Error getting site info: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting site info:", error)
    return { displayName: "Unknown Site", description: "Could not retrieve site information." }
  }
}

// Function to check if user is authenticated and has access to SharePoint
export const checkSharePointAccess = async (): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken()

    // Try a simple API call to verify access
    const response = await fetch(`${GRAPH_ENDPOINT}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return response.ok
  } catch (error) {
    console.error("Error checking SharePoint access:", error)
    return false
  }
}
