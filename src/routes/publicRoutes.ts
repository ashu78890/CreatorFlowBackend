import express from "express"
import { createRating, getPublicStats } from "../controllers/publicController"

const router = express.Router()

router.get("/stats", getPublicStats)
router.post("/ratings", createRating)

export default router
