const app = require('./app');

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Serveur XCE prêt sur http://localhost:${PORT}`);
});
