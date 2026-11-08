import { createHash } from "node:crypto";
import { AckPolicy, NatsError, type NatsConnection } from "nats";

export async function nodeReconcileConsumer(
  nc: NatsConnection,
  agentId: string,
  options: { stream?: string; subjectPrefix?: string } = {},
) {
  const jsm = await nc.jetstreamManager();
  const stream = options.stream ?? "AGENT_RECONCILE";
  const prefix = options.subjectPrefix ?? "agent.reconcile";
  const subjects = [`${prefix}.>`];
  try {
    const info = await jsm.streams.info(stream);
    if (!info.config.subjects?.includes(subjects[0]))
      throw new Error(`Invalid ${stream} stream subjects`);
  } catch (error) {
    if (!(error instanceof NatsError) || error.api_error?.code !== 404)
      throw error;
    try {
      await jsm.streams.add({ name: stream, subjects });
    } catch (addError) {
      let info;
      try {
        info = await jsm.streams.info(stream);
      } catch (verifyError) {
        if (
          verifyError instanceof NatsError &&
          verifyError.api_error?.code === 404
        )
          throw addError;
        throw verifyError;
      }
      if (!info.config.subjects?.includes(subjects[0]))
        throw new Error(`Invalid ${stream} stream subjects`, {
          cause: addError,
        });
    }
  }
  const token = createHash("sha256").update(agentId).digest("hex");
  const durable = `reconcile-${token}`;
  const subject = `${prefix}.${token}`;
  try {
    const info = await jsm.consumers.info(stream, durable);
    if (
      info.config.filter_subject !== subject ||
      info.config.ack_policy !== AckPolicy.Explicit ||
      info.config.max_ack_pending !== 1
    )
      throw new Error(`Invalid reconcile consumer ${durable}`);
  } catch (error) {
    if (!(error instanceof NatsError) || error.api_error?.code !== 404)
      throw error;
    await jsm.consumers.add(stream, {
      durable_name: durable,
      filter_subject: subject,
      ack_policy: AckPolicy.Explicit,
      max_ack_pending: 1,
    });
  }
  return nc.jetstream().consumers.get(stream, durable);
}
