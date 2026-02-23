import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/authRoutes"
import dealRoutes from "./routes/dealRoutes"
import paymentRoutes from "./routes/paymentRoutes"
import dashboardRoutes from "./routes/dashboardRoutes"
import analyticsRoutes from "./routes/analyticsRoutes"
import calendarRoutes from "./routes/calendarRoutes"
import settingsRoutes from "./routes/settingsRoutes"
import billingRoutes from "./routes/billingRoutes"
import notificationRoutes from "./routes/notificationRoutes"
import searchRoutes from "./routes/searchRoutes"
import platformRoutes from "./routes/platformRoutes"
import publicRoutes from "./routes/publicRoutes"
import ratingRoutes from "./routes/ratingRoutes"
import { stripeWebhook } from "./controllers/billingController"
import { connectDB } from "./config/db"
import { cleanupOldNotifications } from "./utils/notifications"

dotenv.config()

const app = express()
connectDB()
app.use(cors()) 
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook)
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook)
app.use(express.json())
app.use("/api/auth", authRoutes)
app.use("/api/deals", dealRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/calendar", calendarRoutes)
app.use("/api/settings", settingsRoutes)
app.use("/api/billing", billingRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/search", searchRoutes)
app.use("/api/platforms", platformRoutes)
app.use("/api/public", publicRoutes)
app.use("/api/ratings", ratingRoutes)
app.get("/", (req, res) => {
  res.send("CreatorFlow Backend Running")
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`)
})

setInterval(() => {
  cleanupOldNotifications().catch(() => undefined)
}, 24 * 60 * 60 * 1000)
