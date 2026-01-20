import express from "express";
import { exportActivityByDate } from "../controllers/activityExport.controller.js";
import {
  listActivityExports,
  downloadActivityExport,
} from "../controllers/activityFiles.controller.js";

const router = express.Router();

router.get("/exports/:date", exportActivityByDate);
router.get("/files", listActivityExports);
router.get("/files/:file", downloadActivityExport);

export default router;
