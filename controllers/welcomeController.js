// In-memory per-user counter store.
// Shape: { [patientId]: counter }
// Replace this layer later with Redis/Mongo/SQL while keeping controller logic same.
const userVisitCounters = new Map();
const WELCOME_LIMIT = 6; // Counter values 0..5 are allowed.

/**
 * Resolve patient ID from supported request locations.
 * Primary source is query param, with optional fallback to authenticated user.
 */
const getPatientIdFromRequest = (req) => {
  if (req.query && req.query.patientId) {
    return String(req.query.patientId).trim();
  }

  // Optional fallback for token-based auth integration.
  if (req.user && req.user.id) {
    return String(req.user.id).trim();
  }

  return "";
};

/**
 * Return current counter for user (defaults to 0 for first visit).
 */
const getCurrentCounter = (patientId) => userVisitCounters.get(patientId) ?? 0;

/**
 * Persist next counter value for user.
 */
const saveNextCounter = (patientId, currentCounter) => {
  userVisitCounters.set(patientId, currentCounter + 1);
};

/**
 * GET /api/welcome
 * Response rules:
 * - counter 0..5 => success true + welcome message
 * - counter >=6 => success false + null message
 */
const welcomeUser = (req, res) => {
  try {
    const patientId = getPatientIdFromRequest(req);

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "patientId is required",
      });
    }

    const currentCounter = getCurrentCounter(patientId);
    const shouldShowWelcome = currentCounter < WELCOME_LIMIT;

    // Increment on every API call and persist per user.
    saveNextCounter(patientId, currentCounter);

    return res.status(200).json({
      success: shouldShowWelcome,
      message: shouldShowWelcome ? "Welcome to the Platform" : null,
      counter: currentCounter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  welcomeUser,
  // Exported for testing/extensibility.
  _userVisitCounters: userVisitCounters,
};

