import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Try to connect to Prisma
    await prisma.$queryRaw`SELECT 1`
    
    // If successful, return ok status
    return NextResponse.json({ status: "ok" }, { status: 200 })
  } catch (error) {
    // If connection fails, return error status
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}

