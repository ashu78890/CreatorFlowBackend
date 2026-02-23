import express from "express"
import { createRating, getMyRating, getRatingEligibility } from "../controllers/ratingController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)

router.get("/me", getMyRating)
router.get("/eligibility", getRatingEligibility)
router.post("/", createRating)

export default router
