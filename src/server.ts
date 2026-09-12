import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🛡️  TaxShield MENA running on http://localhost:${PORT}`);
  console.log(`📖 Interactive Swagger Documentation: http://localhost:${PORT}/docs`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/health`);
});
