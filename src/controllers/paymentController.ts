import { Request, Response } from "express"
import Payment from "../models/Payment"
import Deal from "../models/Deal"
import { createNotification } from "../utils/notifications"

const recalcDealPayments = async (dealId: string, userId: string) => {
  const deal = await Deal.findOne({ _id: dealId, user: userId })
  if (!deal) return

  const payments = await Payment.find({ deal: dealId, user: userId })
  const totalReceived = payments.reduce((sum, p) => sum + (p.received || 0), 0)
  const totalExpected = deal.amount || payments.reduce((sum, p) => sum + (p.amount || 0), 0)

  let paymentStatus: "pending" | "partially_paid" | "paid" = "pending"
  if (totalReceived >= totalExpected && totalExpected > 0) paymentStatus = "paid"
  else if (totalReceived > 0) paymentStatus = "partially_paid"

  deal.amountReceived = totalReceived
  deal.paymentStatus = paymentStatus
  await deal.save()
}

export const createPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const { dealId, amount, received, status, dueDate, paidAt, notes } = req.body
    const deal = await Deal.findOne({ _id: dealId, user: userId })
    if (!deal) return res.status(404).json({ success: false, message: "Deal not found" })

    const payment = await Payment.create({
      user: userId,
      deal: dealId,
      amount,
      received,
      status,
      dueDate,
      paidAt,
      notes
    })

    if (received && received > 0) {
      await createNotification({
        userId: userId.toString(),
        type: "payment_received",
        title: "Payment received",
        message: `${deal.brandName} sent $${Number(received).toLocaleString()}`,
        metadata: { dealId: deal._id.toString(), paymentId: payment._id.toString() }
      })
    }

    await recalcDealPayments(dealId, userId.toString())

    return res.status(201).json({ success: true, data: payment })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create payment" })
  }
}

export const getPayments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const { dealId, status } = req.query
    const query: Record<string, unknown> = { user: userId }
    if (dealId) query.deal = dealId
    if (status && status !== "all") query.status = status

    const payments = await Payment.find(query)
      .populate("deal", "brandName dealName")
      .sort({ createdAt: -1 })

    return res.json({ success: true, data: payments })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch payments" })
  }
}

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const exportPayments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const { dealId, status } = req.query
    const query: Record<string, unknown> = { user: userId }
    if (dealId) query.deal = dealId
    if (status && status !== "all") query.status = status

    const payments = await Payment.find(query)
      .populate("deal", "brandName dealName")
      .sort({ createdAt: -1 })

    const rows = payments.map((payment) => {
      const deal = payment.deal as { brandName?: string; dealName?: string } | string
      const brandName = typeof deal === "string" ? "" : deal?.brandName || ""
      const dealName = typeof deal === "string" ? "" : deal?.dealName || ""
      const dueDate = payment.dueDate ? payment.dueDate.toISOString().slice(0, 10) : ""
      const paidAt = payment.paidAt ? payment.paidAt.toISOString().slice(0, 10) : ""
      const createdAt = payment.createdAt ? payment.createdAt.toISOString().slice(0, 10) : ""

      return [
        brandName,
        dealName,
        payment.amount,
        payment.received,
        payment.status,
        dueDate,
        paidAt,
        createdAt
      ]
    })

    const header = [
      "Brand",
      "Deal",
      "Amount",
      "Received",
      "Status",
      "Due Date",
      "Paid At",
      "Created At"
    ]

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n")

    const today = new Date().toISOString().slice(0, 10)
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename=payments-report-${today}.csv`)
    return res.status(200).send(csv)
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to export payments" })
  }
}

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const payment = await Payment.findOne({ _id: req.params.id, user: userId }).populate(
      "deal",
      "brandName dealName"
    )
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" })

    return res.json({ success: true, data: payment })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch payment" })
  }
}

export const updatePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const existing = await Payment.findOne({ _id: req.params.id, user: userId })
    if (!existing) return res.status(404).json({ success: false, message: "Payment not found" })

    const previousReceived = existing.received || 0
    const nextReceived = typeof req.body.received === "number" ? req.body.received : previousReceived
    const previousStatus = existing.status

    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { $set: req.body },
      { new: true }
    )

    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" })

    {
      const receivedIncrease = nextReceived - previousReceived
      const statusUpgraded = previousStatus !== "paid" && payment.status === "paid"

      if (receivedIncrease > 0 || statusUpgraded) {
        const deal = await Deal.findOne({ _id: payment.deal, user: userId })
        if (deal) {
          await createNotification({
            userId: userId.toString(),
            type: "payment_received",
            title: "Payment received",
            message: `${deal.brandName} sent $${Number(nextReceived).toLocaleString()}`,
            metadata: { dealId: deal._id.toString(), paymentId: payment._id.toString() }
          })
        }
      }
    }

    await recalcDealPayments(payment.deal.toString(), userId.toString())

    return res.json({ success: true, data: payment })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update payment" })
  }
}

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const payment = await Payment.findOneAndDelete({ _id: req.params.id, user: userId })
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" })

    await recalcDealPayments(payment.deal.toString(), userId.toString())

    return res.json({ success: true, message: "Payment deleted" })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete payment" })
  }
}