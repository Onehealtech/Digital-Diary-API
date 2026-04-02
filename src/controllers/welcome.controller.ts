import { Request, Response } from "express";

// In-memory counter for total /api/welcome visits.
// This resets when the server restarts.
let visitCount = 0;
const MAX_WELCOME_VISITS = 6;

export const getWelcomeMessage = (req: Request, res: Response): Response => {
  visitCount += 1;

  // Show welcome message only for the first 6 visits.
  if (visitCount <= MAX_WELCOME_VISITS) {
    return res.status(200).json({
      success: true,
      message: "Welcome to the platform!",
      visitCount,
      remainingWelcomeViews: MAX_WELCOME_VISITS - visitCount,
    });
  }

  // From visit 22 onward, return success false and no welcome message.
  return res.status(200).json({
    success: false,
    visitCount,
  });
};

