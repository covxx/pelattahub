"use server"

import { headers } from "next/headers"
import { z } from "zod"

import { sendEmail } from "@/lib/email"

export type ContactFormState = {
  success?: boolean
  error?: string
}

const contactSchema = z.object({
  name: z.string().min(2, "Name is required").trim(),
  email: z.string().email("Valid email is required").trim(),
  company: z.string().min(2, "Company is required").trim(),
  phone: z
    .string()
    .max(50, "Phone is too long")
    .optional()
    .transform((value) => (value ? value.trim() : undefined)),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000, "Message is too long").trim(),
})

export async function submitContact(prevState: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
    phone: formData.get("phone"),
    message: formData.get("message"),
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input."
    return { success: false, error: firstError }
  }

  const { name, email, company, phone, message } = parsed.data
  const destination = process.env.SALES_EMAIL || process.env.EMAIL_FROM

  if (!destination) {
    return { success: false, error: "Contact email is not configured. Set SALES_EMAIL or EMAIL_FROM." }
  }

  const requestHeaders = await headers()
  const referer = requestHeaders.get("origin") ?? requestHeaders.get("referer") ?? "unknown"

  try {
    await sendEmail({
      to: destination,
      subject: `PalettaHub contact: ${company} (${name})`,
      text: [
        message,
        "",
        `From: ${name}`,
        `Email: ${email}`,
        `Company: ${company}`,
        `Phone: ${phone ?? "N/A"}`,
        `Source: ${referer}`,
      ].join("\n"),
      html: `
        <p>${message.replace(/\n/g, "<br/>")}</p>
        <hr />
        <p><strong>Name:</strong> ${name}<br/>
        <strong>Email:</strong> ${email}<br/>
        <strong>Company:</strong> ${company}<br/>
        <strong>Phone:</strong> ${phone ?? "N/A"}<br/>
        <strong>Source:</strong> ${referer}</p>
      `,
    })

    return { success: true, error: undefined }
  } catch (error) {
    console.error("contact:send_failed", error)
    return { success: false, error: "Unable to send your message right now. Please try again later." }
  }
}

