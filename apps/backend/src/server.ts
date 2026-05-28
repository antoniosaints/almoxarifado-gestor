import "dotenv/config";
import { createServer } from "node:http";
import { app } from "./app.js";
import { installManagerRealtime } from "./services/manager-realtime-service.js";

const port = Number(process.env.PORT ?? 3333);
const server = createServer(app);

installManagerRealtime(server);

server.listen(port, () => {
  console.log(`API de almoxarifado em http://127.0.0.1:${port}`);
});
