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

// Start Express server.
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

