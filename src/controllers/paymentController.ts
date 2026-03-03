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

const formatDate = (date?: Date | string | null) => {
  if (!date) return ""
  return new Date(date).toISOString().slice(0, 10)
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
      .populate(
        "deal",
        "brandName brandHandle dealName platform status paymentStatus amount amountReceived dueDate createdDate"
      )
      .sort({ createdAt: -1 })

    const rows = payments.map((payment) => {
      const deal = payment.deal as unknown as
        | {
        _id?: { toString: () => string } | string
            brandName?: string
            brandHandle?: string
            dealName?: string
            platform?: string
            status?: string
            paymentStatus?: string
            amount?: number
            amountReceived?: number
            dueDate?: Date
            createdDate?: Date
          }
        | string

      const paymentAmount = Number(payment.amount || 0)
      const paymentReceived = Number(payment.received || 0)
      const paymentOutstanding = Math.max(paymentAmount - paymentReceived, 0)

      const dealId = typeof deal === "string" ? deal : deal?._id?.toString?.() || ""
      const brandName = typeof deal === "string" ? "" : deal?.brandName || ""
      const brandHandle = typeof deal === "string" ? "" : deal?.brandHandle || ""
      const dealName = typeof deal === "string" ? "" : deal?.dealName || ""
      const platform = typeof deal === "string" ? "" : deal?.platform || ""
      const dealStatus = typeof deal === "string" ? "" : deal?.status || ""
      const dealPaymentStatus = typeof deal === "string" ? "" : deal?.paymentStatus || ""
      const dealAmount = typeof deal === "string" ? 0 : Number(deal?.amount || 0)
      const dealAmountReceived = typeof deal === "string" ? 0 : Number(deal?.amountReceived || 0)
      const dealAmountOutstanding = Math.max(dealAmount - dealAmountReceived, 0)
      const paymentCollectionRate = paymentAmount > 0
        ? `${Math.round((paymentReceived / paymentAmount) * 100)}%`
        : "0%"

      return [
        payment._id,
        dealId,
        brandName,
        brandHandle,
        dealName,
        platform,
        dealStatus,
        dealPaymentStatus,
        dealAmount,
        dealAmountReceived,
        dealAmountOutstanding,
        paymentAmount,
        paymentReceived,
        paymentOutstanding,
        paymentCollectionRate,
        payment.status,
        formatDate(payment.dueDate),
        formatDate(payment.paidAt),
        formatDate(payment.createdAt),
        formatDate(payment.updatedAt),
        formatDate(typeof deal === "string" ? null : deal?.dueDate),
        formatDate(typeof deal === "string" ? null : deal?.createdDate),
        payment.notes || ""
      ]
    })

    const header = [
      "Payment ID",
      "Deal ID",
      "Brand",
      "Brand Handle",
      "Deal",
      "Platform",
      "Deal Status",
      "Deal Payment Status",
      "Deal Amount",
      "Deal Amount Received",
      "Deal Amount Outstanding",
      "Payment Amount",
      "Payment Received",
      "Payment Outstanding",
      "Payment Collection Rate",
      "Payment Status",
      "Payment Due Date",
      "Payment Paid At",
      "Payment Created At",
      "Payment Updated At",
      "Deal Due Date",
      "Deal Created Date",
      "Payment Notes"
    ]

    const csv = "\uFEFF" + [header, ...rows]
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