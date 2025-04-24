import { getActiveAccount } from "./auth"
import { getMsalInstance, loginRequest } from "./auth"

// Function to get user photo from Microsoft Graph
export const getUserPhoto = async (): Promise<string | null> => {
  try {
    const msalInstance = await getMsalInstance()
    if (!msalInstance) throw new Error("MSAL instance not initialized")

    const account = await getActiveAccount()
    if (!account) throw new Error("No active account")

    // Get access token
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    })

    // Fetch user photo
    const photoResponse = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
      headers: {
        Authorization: `Bearer ${response.accessToken}`,
      },
    })

    if (!photoResponse.ok) {
      if (photoResponse.status === 404) {
        console.log("User photo not found")
        return null
      }
      throw new Error(`Error fetching user photo: ${photoResponse.statusText}`)
    }

    // Convert the photo to a blob URL
    const photoBlob = await photoResponse.blob()
    const photoUrl = URL.createObjectURL(photoBlob)
    return photoUrl
  } catch (error) {
    console.error("Error getting user photo:", error)
    return null
  }
}
