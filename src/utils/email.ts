import nodemailer from "nodemailer"

const smtpHost = process.env.SMTP_HOST
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const smtpFrom = process.env.SMTP_FROM || "no-reply@creatorflow.app"

const isEmailConfigured = () => !!(smtpHost && smtpPort && smtpUser && smtpPass)

const transporter = isEmailConfigured()
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })
  : null

export const sendEmail = async (params: {
  to: string
  subject: string
  html: string
  text?: string
}) => {
  if (!transporter) return
  await transporter.sendMail({
    from: smtpFrom,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text
  })
}

export const sendBillingEmail = async (params: {
  to: string
  subject: string
  title: string
  message: string
}) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
      <h2 style="margin: 0 0 12px;">${params.title}</h2>
      <p style="margin: 0 0 8px;">${params.message}</p>
      <p style="color: #666; font-size: 12px;">CreatorFlow Billing</p>
    </div>
  `

  await sendEmail({
    to: params.to,
    subject: params.subject,
    html,
    text: `${params.title}\n${params.message}`
  })
}
