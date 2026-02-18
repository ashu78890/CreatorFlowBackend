import { Request, Response } from "express"
import { stripe } from "../config/stripe"
import User from "../models/User"
import { createNotification } from "../utils/notifications"
import { sendBillingEmail } from "../utils/email"

const successUrl = process.env.STRIPE_SUCCESS_URL || ""
const cancelUrl = process.env.STRIPE_CANCEL_URL || ""
const priceId = process.env.STRIPE_PRICE_ID || ""

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(500).json({ success: false, message: "Stripe config missing" })
    }

    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        metadata: { userId: user._id.toString() }
      })
      customerId = customer.id
      user.stripeCustomerId = customerId
      await user.save()
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true
    })

    return res.json({ success: true, data: { url: session.url } })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create checkout session" })
  }
}

export const createPortalSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || ""
    const user = await User.findById(userId)
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ success: false, message: "Customer not found" })
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl || undefined
    })

    return res.json({ success: true, data: { url: portal.url } })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create portal session" })
  }
}

export const getBillingStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const user = await User.findById(userId).select("pricingPlan subscriptionStatus stripeCustomerId stripeSubscriptionId")
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    return res.json({
      success: true,
      data: {
        pricingPlan: user.pricingPlan,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load billing status" })
  }
}

const updateSubscription = async (customerId: string, subscriptionId: string | null, status: string) => {
  const pricingPlan = status === "active" || status === "trialing" ? "pro" : "free"
  return User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    {
      stripeSubscriptionId: subscriptionId || undefined,
      subscriptionStatus: status,
      pricingPlan
    },
    { new: true }
  )
}

const notifyBillingEvent = async (params: {
  userId: string
  email?: string
  title: string
  message: string
}) => {
  await createNotification({
    userId: params.userId,
    type: "billing_event",
    title: params.title,
    message: params.message
  })

  if (params.email) {
    await sendBillingEmail({
      to: params.email,
      subject: params.title,
      title: params.title,
      message: params.message
    })
  }
}

export const stripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

  if (!webhookSecret) {
    return res.status(500).send("Webhook secret not configured")
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
  } catch (error) {
    return res.status(400).send("Webhook signature verification failed")
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as { customer: string; subscription: string }
        if (session.customer) {
          const user = await updateSubscription(session.customer, session.subscription || null, "active")
          if (user) {
            await notifyBillingEvent({
              userId: user._id.toString(),
              email: user.email,
              title: "Payment successful",
              message: "Your CreatorFlow Pro subscription is now active."
            })
          }
        }
        break
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as { id: string; customer: string; status: string }
        await updateSubscription(subscription.customer, subscription.id, subscription.status)
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as { id: string; customer: string; status: string }
        const user = await updateSubscription(subscription.customer, subscription.id, "canceled")
        if (user) {
          await notifyBillingEvent({
            userId: user._id.toString(),
            email: user.email,
            title: "Subscription canceled",
            message: "Your subscription has been canceled. You will remain on Free after the current period."
          })
        }
        break
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as { customer: string; subscription: string }
        if (invoice.customer) {
          const user = await updateSubscription(invoice.customer, invoice.subscription || null, "past_due")
          if (user) {
            await notifyBillingEvent({
              userId: user._id.toString(),
              email: user.email,
              title: "Payment failed",
              message: "We could not process your latest payment. Please update your billing details."
            })
          }
        }
        break
      }
      default:
        break
    }

    return res.json({ received: true })
  } catch (error) {
    return res.status(500).send("Webhook handling failed")
  }
}