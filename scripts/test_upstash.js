import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: "https://sacred-barnacle-150708.upstash.io",
  token: "gQAAAAAAAky0AAIgcDJkZmU2MjljODkyNTg0OGNmYTlmODlhNmI1Y2EyOWIxNA"
});

async function run() {
  await redis.set("analytics:submission_summaries:test_key_1", "val1");
  await redis.set("analytics:submission_summaries:test_key_2", "val2");
  
  const beforeKeys = await redis.keys("analytics:submission_summaries:*");
  console.log("Keys before pattern del:", beforeKeys);
  
  if (beforeKeys.length > 0) {
    await redis.del(...beforeKeys);
  }
  
  const afterKeys = await redis.keys("analytics:submission_summaries:*");
  console.log("Keys after pattern del:", afterKeys);
}

run().catch(console.error);
