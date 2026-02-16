import express from "express"
import { getCalendarEvents } from "../controllers/calendarController.js"
import { protect } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(protect)
router.get("/", getCalendarEvents)

export default router