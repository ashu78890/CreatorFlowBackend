import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/authRoutes"
import { connectDB } from "./config/db"

dotenv.config()

const app = express()
connectDB()
app.use(cors())
app.use(express.json())
app.use("/api/auth", authRoutes)
app.get("/", (req, res) => {
  res.send("CreatorFlow Backend Running")
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`)
})
