import { defineBackend } from "@aws-amplify/backend";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Bucket, HttpMethods } from "aws-cdk-lib/aws-s3";
import { auth } from "./auth/resource";
import { verifier } from "./functions/verifier/resource";

const backend = defineBackend({ auth, verifier });
const stack = backend.createStack("data");

// One table, one item per entry.
const entries = new Table(stack, "Entries", {
  partitionKey: { name: "id", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

// The clips. The browser PUTs straight here with a presigned URL and plays them back with a presigned GET.
// The site origin is a CloudFront domain only known after the hosting stack exists, so CORS allows any origin;
// the presigned signature is what gates access.
const clips = new Bucket(stack, "Clips", {
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
  lifecycleRules: [{ expiration: Duration.days(30) }],
  cors: [
    {
      allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
      exposedHeaders: ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    },
  ],
});

const worker = backend.verifier.resources.lambda;
entries.grantReadWriteData(worker);
clips.grantRead(worker);
backend.verifier.addEnvironment("ENTRIES_TABLE", entries.tableName);
backend.verifier.addEnvironment("CLIPS_BUCKET", clips.bucketName);
backend.verifier.addEnvironment("PRANK_MODEL", process.env.PRANK_MODEL ?? "google/gemini-3.8-flash");
// The OpenRouter key lives in SSM as a SecureString, put there from Infisical before the deploy (README), never in
// this template. Only the worker calls the model in AWS, so only the worker can read it.
const KEY_PARAM = "/amplify/p-rank-take-home/openrouter-api-key";
backend.verifier.addEnvironment("OPENROUTER_KEY_PARAM", KEY_PARAM);
worker.addToRolePolicy(
  new PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: [`arn:aws:ssm:${Stack.of(stack).region}:${Stack.of(stack).account}:parameter${KEY_PARAM}`],
  }),
);

// The Next server reads these from amplify_outputs.json at deploy time (amplify/hosting.ts).
backend.addOutput({
  custom: {
    entriesTable: entries.tableName,
    entriesTableArn: entries.tableArn,
    clipsBucket: clips.bucketName,
    clipsBucketArn: clips.bucketArn,
    workerFunction: worker.functionName,
    workerFunctionArn: worker.functionArn,
    userPoolArn: backend.auth.resources.userPool.userPoolArn,
  },
});
