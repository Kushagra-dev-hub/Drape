import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { registerVoiceHandlers } from "./server/voice/session";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

const httpServer = createServer();
const app = next({ dev, httpServer });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  httpServer.on("request", (req, res) => handle(req, res));

  const io = new SocketIOServer(httpServer);
  registerVoiceHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
