import { Router } from "express";
import { autosaveAnswer, getDiaryAnswers, getPage, submitPageAnswers } from "../controllers/diary-answer.controller";

const router = Router();

// GET  a page (with all fields + existing answers)
router.get("/:diaryId/page/:pageNo", getPage);

// PATCH autosave one field
router.patch("/:diaryId/page/:pageNo/answer", autosaveAnswer);

// POST  submit all fields on a page at once
router.post("/:diaryId/page/:pageNo/submit", submitPageAnswers);
router.get("/:diaryId/answers", getDiaryAnswers);

export default router;