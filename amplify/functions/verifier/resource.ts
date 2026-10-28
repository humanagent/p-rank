import { defineFunction } from "@aws-amplify/backend";

// The worker: one find call, or three rate calls plus scoring. Invoked async by the web app with { job, entryId }.
export const verifier = defineFunction({
  name: "verifier",
  entry: "../../../src/server/verifier/lambda.ts",
  timeoutSeconds: 600,
  memoryMB: 1024,
});
