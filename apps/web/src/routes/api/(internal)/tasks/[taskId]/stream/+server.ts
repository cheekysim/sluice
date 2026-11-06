import { connect, StringCodec, type NatsConnection } from "nats";
import { env } from "$env/dynamic/private";
import { getTaskResult } from "$lib/server/nats";

const sc = StringCodec();
let ncPromise: Promise<NatsConnection> | undefined;

// Lazy so a down NATS server doesn't break module evaluation
function getNats() {
  ncPromise ??= connect({ servers: env.NATS_URL ?? "nats://nats:4222" }).catch((e) => {
    ncPromise = undefined;
    throw e;
  });
  return ncPromise;
}

export async function GET({ params }) {
  const { taskId } = params;
  const nc = await getNats();

  const stream = new ReadableStream({
    async start(controller) {
      // Prefer the result tracked at queue time; it may already have arrived
      const tracked = getTaskResult(taskId);
      if (tracked) {
        controller.enqueue(`data: ${await tracked}\n\n`);
        controller.close();
        return;
      }

      // Subscribe to the specific task's completion subject
      const sub = nc.subscribe(`task.done.${taskId}`);

      for await (const msg of sub) {
        const data = sc.decode(msg.data);
        // SSE format requires "data: " prefix and double newline
        controller.enqueue(`data: ${data}\n\n`);
        
        // Close stream and NATS subscription once complete
        sub.unsubscribe();
        controller.close();
        break;
      }
    },
    cancel() {
      console.log("Client disconnected from stream");
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}