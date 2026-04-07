const express = require("express");
const welcomeRoute = require("./routes/welcome");

const app = express();
const PORT = process.env.PORT || 5000;

// Parse JSON bodies for API requests.
app.use(express.json());

// Mount welcome API routes under /api.
app.use("/api", welcomeRoute);

// Optional root endpoint to show server status.
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend server is running.",
  });
});

// JSON 404 handler for unknown routes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler for unexpected runtime errors.
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start Express server.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

