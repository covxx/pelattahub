import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateSetting } from "@/app/actions/settings"

/**
 * Upload company logo
 * Accepts image file, converts to base64, stores in settings
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is ADMIN or MANAGER
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Admin or Manager access required" },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("logo") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload PNG, JPEG, GIF, or WebP" },
        { status: 400 }
      )
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum size is 2MB" },
        { status: 400 }
      )
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const dataUri = `data:${file.type};base64,${base64}`

    // Store in settings
    await updateSetting(
      "company_logo_url",
      dataUri,
      "Company logo for receipts and documents (stored as base64 data URI)"
    )

    return NextResponse.json({
      success: true,
      message: "Logo uploaded successfully",
    })
  } catch (error) {
    console.error("Error uploading logo:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload logo",
      },
      { status: 500 }
    )
  }
}

/**
 * Delete company logo
 */
export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is ADMIN or MANAGER
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Admin or Manager access required" },
        { status: 403 }
      )
    }

    // Delete logo by setting to empty string
    await updateSetting(
      "company_logo_url",
      "",
      "Company logo for receipts and documents"
    )

    return NextResponse.json({
      success: true,
      message: "Logo deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting logo:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete logo",
      },
      { status: 500 }
    )
  }
}

