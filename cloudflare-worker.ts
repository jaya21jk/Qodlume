import openNextWorker from "./.open-next/worker.js";
import {
  publishDueDailyGameChallenges,
  publishDueQuizzes,
} from "./src/lib/quiz-database";

export default {
  fetch(request: Request, env: CloudflareEnv, context: ExecutionContext) {
    return openNextWorker.fetch(request, env, context);
  },
  scheduled(_controller: ScheduledController, env: CloudflareEnv, context: ExecutionContext) {
    context.waitUntil((async () => {
      try {
        const publishedCount = await publishDueQuizzes(env.DB);
        if (publishedCount > 0) {
          console.info("Scheduled quizzes published.", { publishedCount });
        }
        const publishedGameChallengeCount =
          await publishDueDailyGameChallenges(env.DB);
        if (publishedGameChallengeCount > 0) {
          console.info("Scheduled daily game challenges published.", {
            publishedCount: publishedGameChallengeCount,
          });
        }
      } catch (error) {
        console.error("Scheduled quiz publication failed.", error);
        throw error;
      }
    })());
  },
};
