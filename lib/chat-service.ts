"use server"

import { searchSharePoint, getDocumentContent, getSiteInfo, checkSharePointAccess } from "./sharepoint-service"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

// Process user query and return a response
export async function processQuery(query: string, userName: string): Promise<string> {
  try {
    // First check if we have SharePoint access
    const hasAccess = await checkSharePointAccess()
    if (!hasAccess) {
      return "I'm having trouble accessing SharePoint with your current credentials. Please try refreshing the page or signing out and back in."
    }

    // Search SharePoint for relevant content
    const searchResults = await searchSharePoint(query)

    // Check if searchResults is valid and has values
    if (!searchResults || !searchResults.value || searchResults.value.length === 0) {
      return "I couldn't find any relevant information in SharePoint. Could you try rephrasing your question?"
    }

    // Extract and process the most relevant results
    const relevantContent = await extractRelevantContent(searchResults)

    // Use AI to generate a response based on the SharePoint content
    const response = await generateAIResponse(query, relevantContent, userName)

    return response
  } catch (error) {
    console.error("Error processing query:", error)

    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes("No active account")) {
        return "I'm having trouble with your authentication session. Please try refreshing the page or signing out and back in."
      } else if (error.message.includes("token")) {
        return "Your authentication token has expired. Please refresh the page to sign in again."
      }
    }

    return "I'm sorry, I encountered an error while processing your request. Please try again later."
  }
}

// Extract relevant content from search results
async function extractRelevantContent(searchResults: any) {
  // Ensure searchResults has the expected structure
  if (!searchResults || !searchResults.value || !Array.isArray(searchResults.value)) {
    console.log("Search results are not in the expected format:", searchResults)
    return "No detailed content could be extracted due to unexpected search result format."
  }

  const relevantItems = searchResults.value.slice(0, 3) // Take top 3 results
  let extractedContent = ""

  for (const item of relevantItems) {
    try {
      // Check if item and item.resource exist
      if (!item || !item.resource) {
        console.log("Item or item.resource is undefined:", item)
        continue
      }

      // Check for @odata.type property
      const odataType = item.resource["@odata.type"]

      if (odataType === "#microsoft.graph.driveItem") {
        // For documents - check if parentReference and driveId exist
        if (item.resource.parentReference && item.resource.parentReference.driveId && item.resource.id) {
          try {
            const content = await getDocumentContent(item.resource.parentReference.driveId, item.resource.id)
            extractedContent += `Document: ${item.resource.name || "Unnamed document"}\n${content}\n\n`
          } catch (docError) {
            console.error("Error getting document content:", docError)
            extractedContent += `Document: ${item.resource.name || "Unnamed document"}\nCould not retrieve content.\n\n`
          }
        } else {
          extractedContent += `Document: ${item.resource.name || "Unnamed document"}\nMissing reference information.\n\n`
        }
      } else if (odataType === "#microsoft.graph.site") {
        // For sites - check if id exists
        if (item.resource.id) {
          try {
            const siteInfo = await getSiteInfo(item.resource.id)
            extractedContent += `Site: ${siteInfo.displayName || "Unnamed site"}\nDescription: ${siteInfo.description || "No description"}\n\n`
          } catch (siteError) {
            console.error("Error getting site info:", siteError)
            extractedContent += `Site: ${item.resource.name || "Unnamed site"}\nCould not retrieve site information.\n\n`
          }
        } else {
          extractedContent += `Site: ${item.resource.name || "Unnamed site"}\nMissing ID information.\n\n`
        }
      } else {
        // For other types or when @odata.type is missing
        extractedContent += `Item: ${item.resource.name || "Unnamed item"}\n`
        if (item.resource.description) {
          extractedContent += `Description: ${item.resource.description}\n\n`
        } else {
          extractedContent += `No description available.\n\n`
        }
      }
    } catch (error) {
      console.error("Error extracting content for item:", error)
      extractedContent += "Error extracting content for an item.\n\n"
    }
  }

  return extractedContent || "No detailed content could be extracted."
}

// Generate AI response based on SharePoint content
async function generateAIResponse(query: string, content: string, userName: string) {
  try {
    const prompt = `
You are a helpful SharePoint assistant for ${userName}. 
Answer the following question based on the SharePoint content provided.
If the content doesn't contain relevant information to answer the question, say so.

User question: ${query}

SharePoint content:
${content}

Please provide a concise, helpful response based only on the information in the SharePoint content.
`

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: prompt,
      maxTokens: 500,
    })

    return text
  } catch (error) {
    console.error("Error generating AI response:", error)
    return "I'm sorry, I couldn't generate a response based on the SharePoint content."
  }
}
