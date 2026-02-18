import express from "express"
import { protect } from "../middleware/authMiddleware"
import { globalSearch } from "../controllers/searchController"

const router = express.Router()

router.use(protect)
router.get("/", globalSearch)

export default router
