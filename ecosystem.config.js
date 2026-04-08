module.exports = {
  apps: [
    // ─── Production (main branch) ───────────────────────────────────────
    {
      name: "diary-api-production",
      script: "dist/index.js",
      cwd: "/home/ubuntu/Digital-Diary-API",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "diary-worker-production",
      script: "dist/worker.js",
      cwd: "/home/ubuntu/Digital-Diary-API",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },

    // ─── Staging (staging branch) ───────────────────────────────────────
    {
      name: "diary-api-staging",
      script: "dist/index.js",
      cwd: "/home/ubuntu/Digital-Diary-API-staging",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "staging",
      },
    },
    {
      name: "diary-worker-staging",
      script: "dist/worker.js",
      cwd: "/home/ubuntu/Digital-Diary-API-staging",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "staging",
      },
    },
  ],
};
