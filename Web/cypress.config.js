const { defineConfig } = require('cypress');
const path = require('path');
const fs = require('fs');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8000',
    video: false,
    screenshotOnRunFailure: false,
    setupNodeEvents(on, config) {
      on('task', {
        resetDb() {
          const dbPath = path.join(__dirname, '..', 'data.sqlite');
          if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
          }
          return null;
        },
      });
      return config;
    },
  },
});
