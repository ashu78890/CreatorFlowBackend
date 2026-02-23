import dotenv from "dotenv"
import Deal from "../models/Deal"
import { connectDB } from "../config/db"

dotenv.config()

const backfillCompletedAt = async () => {
  try {
    await connectDB()

    const deals = await Deal.find({ "deliverables.status": "completed" })
    let updatedDeals = 0
    let updatedDeliverables = 0

    for (const deal of deals) {
      let changed = false
      const next = deal.deliverables.map((deliverable: any) => {
        if (deliverable.status === "completed" && !deliverable.completedAt) {
          changed = true
          updatedDeliverables += 1
          return {
            ...deliverable.toObject(),
            completedAt: deliverable.dueDate || deal.updatedAt || new Date()
          }
        }
        return deliverable
      })

      if (changed) {
        deal.deliverables = next as any
        await deal.save()
        updatedDeals += 1
      }
    }

    console.log(`Backfill complete. Updated deals: ${updatedDeals}, deliverables: ${updatedDeliverables}`)
    process.exit(0)
  } catch (error) {
    console.error("Backfill failed", error)
    process.exit(1)
  }
}

backfillCompletedAt()
