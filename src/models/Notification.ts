import mongoose from "mongoose"

export type NotificationType =
  | "deal_created"
  | "payment_received"
  | "deadline_reminder"
  | "billing_event"

export interface INotification extends mongoose.Document {
  user: mongoose.Types.ObjectId
  type: NotificationType
  title: string
  message: string
  readAt?: Date | null
  dedupeKey?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String },
    metadata: { type: Object }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

notificationSchema.index({ user: 1, createdAt: -1 })
notificationSchema.index({ user: 1, dedupeKey: 1 })

export default mongoose.model<INotification>("Notification", notificationSchema)
