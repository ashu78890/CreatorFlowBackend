import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  // eslint-disable-next-line no-console
  console.warn("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
  typescript: true
})