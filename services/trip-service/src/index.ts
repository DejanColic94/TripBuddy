import "./env";
import app from "./app";
import { initDb, testConnection } from "./db";

const PORT = process.env.TRIP_SERVICE_PORT || 4002;

app.listen(PORT, async () => {
  console.log(`Trip service running on port ${PORT}`);
  await testConnection();
  await initDb();
});
