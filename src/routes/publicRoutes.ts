import express from "express"
import { getPublicStats, getPublicTestimonials } from "../controllers/publicController"

const router = express.Router()

router.get("/stats", getPublicStats)
router.get("/testimonials", getPublicTestimonials)

export default router
