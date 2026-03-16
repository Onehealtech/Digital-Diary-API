// Tracks total number of visits to /api/welcome.
// Note: This is in-memory storage and resets when the server restarts.
let visitCount = 0;
const MAX_WELCOME_VISITS = 21;

const getWelcomeMessage = (req, res) => {
  visitCount += 1;

  // Show welcome message only for first 21 visits.
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

module.exports = {
  getWelcomeMessage,
};

