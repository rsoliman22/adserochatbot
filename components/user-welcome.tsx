"use client"

import { useState, useEffect } from "react"
import { getActiveAccount } from "@/lib/auth"
import { getUserPhoto } from "@/lib/user-service"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { theme } from "@/lib/theme"

export function UserWelcome() {
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoading(true)
        const account = await getActiveAccount()

        if (account) {
          setUserName(account.name || "User")
          setUserEmail(account.username || account.localAccountId || null)

          // Try to get user photo
          try {
            const photoUrl = await getUserPhoto()
            if (photoUrl) {
              setUserPhotoUrl(photoUrl)
            }
          } catch (error) {
            console.error("Error fetching user photo:", error)
          }
        }
      } catch (error) {
        console.error("Error fetching user info:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserInfo()
  }, [])

  if (isLoading) {
    return (
      <div
        className="bg-opacity-50 bg-gray-900 backdrop-blur-md border-b border-opacity-20"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="container mx-auto py-3 px-4 flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full bg-gray-700" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 bg-gray-700" />
            <Skeleton className="h-3 w-32 bg-gray-700" />
          </div>
        </div>
      </div>
    )
  }

  if (!userName) return null

  return (
    <div
      className="bg-opacity-50 bg-gray-900 backdrop-blur-md border-b border-opacity-20"
      style={{ borderColor: theme.colors.border }}
    >
      <div className="container mx-auto py-3 px-4 flex items-center gap-4">
        <Avatar
          className="h-10 w-10 ring-2 ring-offset-2 ring-offset-gray-900"
          style={{ ringColor: theme.colors.primary }}
        >
          <AvatarImage src={userPhotoUrl || ""} alt={userName} />
          <AvatarFallback
            className="text-white"
            style={{
              background: `linear-gradient(to bottom right, ${theme.colors.primary}, ${theme.colors.secondary})`,
            }}
          >
            {userName
              .split(" ")
              .map((name) => name[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-white">Welcome, {userName}</p>
          {userEmail && <p className="text-sm text-gray-300">{userEmail}</p>}
        </div>
      </div>
    </div>
  )
}
