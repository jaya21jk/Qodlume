import openNextWorker from "./.open-next/worker.js";
import { publishDueQuizzes } from "./src/lib/quiz-database";

export default {
  fetch(request: Request, env: CloudflareEnv, context: ExecutionContext) {
    return openNextWorker.fetch(request, env, context);
  },
  scheduled(_controller: ScheduledController, env: CloudflareEnv, context: ExecutionContext) {
    context.waitUntil(
      publishDueQuizzes(env.DB).catch((error: unknown) => {
        console.error("Scheduled quiz publication failed.", error);
        throw error;
      }),
    );
  },
};
