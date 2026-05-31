import "./env";
import app from "./app";
import { initDb, testConnection } from "./db";

const PORT = process.env.IDENTITY_SERVICE_PORT || 4001;

app.listen(PORT, async () => {
  console.log(`Identity service running on port ${PORT}`);
  await testConnection();
  await initDb();
});
