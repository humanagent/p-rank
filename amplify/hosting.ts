import { readFileSync } from "node:fs";
import { defineHosting } from "@aws-amplify/hosting";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";

// The backend phase runs first and writes amplify_outputs.json; the Next server gets those names as env vars.
const outputs = JSON.parse(readFileSync("amplify_outputs.json", "utf8"));
const { custom } = outputs;

if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET must be set when deploying");

const hosting = defineHosting({
  framework: "nextjs",
  buildCommand: "bun run build",
  compute: { timeout: 30 },
  environment: {
    ENTRIES_TABLE: custom.entriesTable,
    CLIPS_BUCKET: custom.clipsBucket,
    WORKER_FUNCTION: custom.workerFunction,
    COGNITO_CLIENT_ID: outputs.auth.user_pool_client_id,
    CLUB_EMAILS: process.env.CLUB_EMAILS ?? "@meridian.club,fguespe@gmail.com",
    PRANK_MODEL: process.env.PRANK_MODEL ?? "google/gemini-3.8-flash",
    // A plain value in the template, injected at deploy time from Infisical. Not production ready (see README).
    SESSION_SECRET: process.env.SESSION_SECRET!,
  },
});

// defineHosting does not expose its SSR functions, so find them in its stack and grant what the API routes use.
const access = [
  new PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan", "dynamodb:Query"],
    resources: [custom.entriesTableArn, `${custom.entriesTableArn}/index/*`],
  }),
  new PolicyStatement({ actions: ["s3:GetObject", "s3:PutObject"], resources: [`${custom.clipsBucketArn}/*`] }),
  new PolicyStatement({ actions: ["lambda:InvokeFunction"], resources: [custom.workerFunctionArn] }),
  // The auth calls used (InitiateAuth, RespondToAuthChallenge, SignUp, ConfirmSignUp) are public client APIs; this
  // covers anything admin-side the routes may add.
  new PolicyStatement({ actions: ["cognito-idp:*"], resources: [custom.userPoolArn] }),
];
for (const node of hosting.stack.node.findAll()) {
  if (node instanceof LambdaFunction) access.forEach((statement) => node.addToRolePolicy(statement));
}
