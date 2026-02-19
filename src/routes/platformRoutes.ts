import express from "express"
import { addCustomPlatform, getPlatforms } from "../controllers/platformController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)

router.get("/", getPlatforms)
router.post("/", addCustomPlatform)

export default router
