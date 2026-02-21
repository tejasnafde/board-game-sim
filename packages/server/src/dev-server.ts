import { startServer } from "./main";

async function run(): Promise<void> {
  const port = Number(process.env.PORT ?? "8080");
  const host = process.env.HOST ?? "127.0.0.1";

  const instance = await startServer({
    port,
    host,
    demoSessionId: process.env.DEMO_SESSION_ID ?? "demo-battleship",
    labyrinthDemoSessionId: process.env.LABYRINTH_DEMO_SESSION_ID ?? null
  });

  process.stdout.write(`server_started http://${host}:${port}\n`);

  const shutdown = async () => {
    await instance.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void run();
