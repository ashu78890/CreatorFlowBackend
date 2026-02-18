import express from "express"
import { protect } from "../middleware/authMiddleware"
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  streamNotifications
} from "../controllers/notificationController"

const router = express.Router()

router.get("/stream", streamNotifications)

router.use(protect)
router.get("/", getNotifications)
router.patch("/read", markAllNotificationsRead)
router.patch("/:id/read", markNotificationRead)

export default router
