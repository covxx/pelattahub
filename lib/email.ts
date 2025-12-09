import nodemailer, { type Transporter } from "nodemailer"

interface EmailConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

export interface EmailPayload {
  to: string
  subject: string
  text?: string
  html?: string
}

let cachedTransporter: Transporter | null = null

const getEmailConfig = (): EmailConfig => {
  const host = process.env.EMAIL_HOST || "smtp.gmail.com"
  const port = Number(process.env.EMAIL_PORT || 465)
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASSWORD
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || ""

  if (!user || !pass || !from) {
    throw new Error("Email is not configured. Set EMAIL_USER, EMAIL_PASSWORD, and EMAIL_FROM.")
  }

  return { host, port, user, pass, from }
}

const getTransporter = (): Transporter => {
  if (cachedTransporter) return cachedTransporter

  const config = getEmailConfig()

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // true for Gmail/Workspace SSL
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  return cachedTransporter
}

export const sendEmail = async (payload: EmailPayload) => {
  const transporter = getTransporter()
  const { from } = getEmailConfig()

  const message = {
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  }

  await transporter.sendMail(message)
}
