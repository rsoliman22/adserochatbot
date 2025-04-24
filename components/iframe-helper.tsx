"use client"

import { useEffect, useState } from "react"
import { isInIframe, isV0Preview, checkPopupSupport } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ExternalLink, AlertTriangle } from "lucide-react"

export function IframeHelper() {
  const [inIframe, setInIframe] = useState(false)
  const [inV0Preview, setInV0Preview] = useState(false)
  const [popupsSupported, setPopupsSupported] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInIframe(isInIframe())
      setInV0Preview(isV0Preview())

      // Check if popups are supported
      const checkPopups = async () => {
        const supported = await checkPopupSupport()
        setPopupsSupported(supported)
      }

      checkPopups()
    }
  }, [])

  const openInNewWindow = () => {
    window.open(window.location.href, "_blank")
  }

  if (!inIframe && !inV0Preview) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-100 p-2 text-center text-sm text-yellow-800 z-50">
      <p className="flex items-center justify-center gap-2">
        {inIframe && (
          <>
            You're viewing this app in an embedded frame. For the best experience:
            <Button
              variant="outline"
              size="sm"
              className="bg-yellow-200 border-yellow-300 text-yellow-800 hover:bg-yellow-300"
              onClick={openInNewWindow}
            >
              <ExternalLink className="h-4 w-4 mr-1" /> Open in new window
            </Button>
          </>
        )}

        {inV0Preview && !inIframe && !popupsSupported && (
          <>
            <AlertTriangle className="h-4 w-4" />
            Popup windows may be blocked. Please enable popups for this site for authentication to work properly.
          </>
        )}
      </p>
    </div>
  )
}
