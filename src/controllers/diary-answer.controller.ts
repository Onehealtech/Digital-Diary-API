import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getFilledDiaryAnswers, getDiaryPage, saveAnswer, submitPage } from "../service/diary-answer.service";

/** GET /diary/:diaryId/page/:pageNo */
export const getPage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { diaryId, pageNo } = req.params;
    const page = await getDiaryPage(diaryId, pageNo);
    res.json({ success: true, data: page });
  } catch (e: any) {
    res.status(404).json({ success: false, message: e.message });
  }
};

/** PATCH /diary/:diaryId/page/:pageNo/answer  — autosave one field */
export const autosaveAnswer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { diaryId, pageNo }:any = req.params;
    const { question_no, answer } = req.body;

    if (!question_no || answer === undefined) {
      res.status(400).json({ success: false, message: "question_no and answer are required" });
      return;
    }

    const page = await saveAnswer({ diaryId, pageNo, questionNo: question_no, answer });
    res.json({ success: true, message: "Answer saved", data: page });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/** POST /diary/:diaryId/page/:pageNo/submit  — submit full page */
export const submitPageAnswers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { diaryId, pageNo } = req.params;
    const { answers } = req.body;  // Array<{ question_no, answer }>

    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ success: false, message: "answers array is required" });
      return;
    }

    const page = await submitPage(diaryId, pageNo, answers);
    res.json({ success: true, message: "Page submitted", data: page });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const getDiaryAnswers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { diaryId } = req.params;

    const data = await getFilledDiaryAnswers(diaryId);

    res.json({
      success: true,
      data
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}