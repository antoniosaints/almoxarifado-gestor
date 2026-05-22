import "dotenv/config";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3333);

app.listen(port, () => {
  console.log(`API de almoxarifado em http://127.0.0.1:${port}`);
});
