import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const port = Number(process.env.INTEGRATION_SERVICE_PORT) || 4003;

app.listen(port, () => {
  console.log(`Integration service running on port ${port}`);
});
