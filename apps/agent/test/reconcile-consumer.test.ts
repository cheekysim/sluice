import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { connect, StringCodec } from "nats";
import { nodeReconcileConsumer } from "../src/reconcile-consumer.js";

test(
  "node reconcile messages are retained and delivered only to their target",
  { skip: !process.env.NATS_TEST_URL },
  async (t) => {
    const suffix = randomUUID().replaceAll("-", "");
    const stream = `TEST_RECONCILE_${suffix}`;
    const subjectPrefix = `test.reconcile.${suffix}`;
    const nc = await connect({ servers: process.env.NATS_TEST_URL });
    const jsm = await nc.jetstreamManager();
    await jsm.streams.add({ name: stream, subjects: [`${subjectPrefix}.>`] });
    t.after(async () => {
      await jsm.streams.delete(stream);
      await nc.close();
    });
    const subject = (id: string) =>
      `${subjectPrefix}.${createHash("sha256").update(id).digest("hex")}`;
    const codec = StringCodec();
    await nc.jetstream().publish(subject("one"), codec.encode("one"));
    await nc.jetstream().publish(subject("two"), codec.encode("two"));
    const first = await nodeReconcileConsumer(nc, "one", {
      stream,
      subjectPrefix,
    });
    const second = await nodeReconcileConsumer(nc, "two", {
      stream,
      subjectPrefix,
    });
    const messages = await Promise.all([
      first.consume({ max_messages: 1 }),
      second.consume({ max_messages: 1 }),
    ]);
    t.after(() => messages.forEach((items) => items.stop()));
    const receive = async (items: (typeof messages)[number]) => {
      for await (const msg of items) {
        msg.ack();
        return codec.decode(msg.data);
      }
      throw new Error("Consumer stopped before receiving a message");
    };
    const timeout = setTimeout(
      () => messages.forEach((items) => items.stop()),
      5000,
    );
    try {
      assert.deepEqual(await Promise.all(messages.map(receive)), [
        "one",
        "two",
      ]);
    } finally {
      clearTimeout(timeout);
    }
  },
);
