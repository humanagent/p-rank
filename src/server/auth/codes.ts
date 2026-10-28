// Email sign-in codes. Local mode (no COGNITO_CLIENT_ID): a 6-digit code kept in memory and returned as devCode.
// Cloud mode: Cognito USER_AUTH with EMAIL_OTP; Cognito emails the code.
import { randomInt } from "node:crypto";

export type StartResult = { ok: true; devCode?: string } | { ok: false; error: string };
export type VerifyResult = { ok: true } | { ok: false; error: string };

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const isCloud = () => !!process.env.COGNITO_CLIENT_ID;

export async function startCode(email: string): Promise<StartResult> {
  return isCloud() ? cloudStart(email) : localStart(email);
}

export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}(\d{2})?$/.test(c)) return { ok: false, error: "Enter the 6-digit code from your email." };
  return isCloud() ? cloudVerify(email, c) : localVerify(email, c);
}

// ---------- local mode ----------

type LocalCode = { code: string; exp: number; attempts: number };
const g = globalThis as unknown as { __prankCodes?: Map<string, LocalCode>; __prankCognito?: Map<string, CognitoPending> };
const localCodes = () => (g.__prankCodes ??= new Map());

function localStart(email: string): StartResult {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  localCodes().set(email, { code, exp: Date.now() + TTL_MS, attempts: 0 });
  return { ok: true, devCode: code };
}

function localVerify(email: string, code: string): VerifyResult {
  const rec = localCodes().get(email);
  if (!rec || rec.exp < Date.now()) {
    localCodes().delete(email);
    return { ok: false, error: "That code expired. Ask for a new one." };
  }
  if (rec.code !== code) {
    rec.attempts += 1;
    if (rec.attempts >= MAX_ATTEMPTS) {
      localCodes().delete(email);
      return { ok: false, error: "Too many tries. Ask for a new code." };
    }
    return { ok: false, error: "That code is not right." };
  }
  localCodes().delete(email);
  return { ok: true };
}

// ---------- cloud mode (Cognito) ----------

type CognitoPending = { kind: "signup" | "otp"; session?: string; exp: number };
const pending = () => (g.__prankCognito ??= new Map());

async function cognito() {
  const sdk = await import("@aws-sdk/client-cognito-identity-provider");
  return { sdk, client: new sdk.CognitoIdentityProviderClient({}), ClientId: process.env.COGNITO_CLIENT_ID! };
}

async function cloudStart(email: string): Promise<StartResult> {
  const { sdk, client, ClientId } = await cognito();
  // Sign up first. The pool hides whether a user exists (Amplify's default), so InitiateAuth for an unknown email
  // returns a fake challenge instead of UserNotFoundException: no user is created and no email is sent. SignUp
  // still says UsernameExistsException, so that is the reliable way to tell a new email from a returning one.
  try {
    await client.send(
      new sdk.SignUpCommand({ ClientId, Username: email, UserAttributes: [{ Name: "email", Value: email }] }),
    );
    pending().set(email, { kind: "signup", exp: Date.now() + TTL_MS });
    return { ok: true };
  } catch (err) {
    if (!(err instanceof sdk.UsernameExistsException)) return cloudError(err);
  }
  try {
    // Returning user: passwordless sign-in, Cognito emails a one-time code.
    let out = await client.send(
      new sdk.InitiateAuthCommand({
        ClientId,
        AuthFlow: "USER_AUTH",
        AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: "EMAIL_OTP" },
      }),
    );
    if (out.ChallengeName === "SELECT_CHALLENGE") {
      out = await client.send(
        new sdk.RespondToAuthChallengeCommand({
          ClientId,
          ChallengeName: "SELECT_CHALLENGE",
          Session: out.Session,
          ChallengeResponses: { USERNAME: email, ANSWER: "EMAIL_OTP" },
        }),
      );
    }
    pending().set(email, { kind: "otp", session: out.Session, exp: Date.now() + TTL_MS });
    return { ok: true };
  } catch (err) {
    return cloudError(err);
  }
}

async function cloudVerify(email: string, code: string): Promise<VerifyResult> {
  const p = pending().get(email);
  if (!p || p.exp < Date.now()) return { ok: false, error: "That code expired. Ask for a new one." };
  const { sdk, client, ClientId } = await cognito();
  try {
    if (p.kind === "signup") {
      await client.send(new sdk.ConfirmSignUpCommand({ ClientId, Username: email, ConfirmationCode: code }));
    } else {
      const out = await client.send(
        new sdk.RespondToAuthChallengeCommand({
          ClientId,
          ChallengeName: "EMAIL_OTP",
          Session: p.session,
          ChallengeResponses: { USERNAME: email, EMAIL_OTP_CODE: code },
        }),
      );
      if (!out.AuthenticationResult) {
        if (out.Session) p.session = out.Session; // wrong code: Cognito hands back a fresh session
        return { ok: false, error: "That code is not right." };
      }
    }
    pending().delete(email);
    return { ok: true };
  } catch (err) {
    if (err instanceof sdk.CodeMismatchException) return { ok: false, error: "That code is not right." };
    if (err instanceof sdk.ExpiredCodeException) return { ok: false, error: "That code expired. Ask for a new one." };
    if (err instanceof sdk.NotAuthorizedException) {
      pending().delete(email);
      return { ok: false, error: "Too many tries or session expired. Ask for a new code." };
    }
    return cloudError(err);
  }
}

function cloudError(err: unknown): { ok: false; error: string } {
  process.stdout.write(JSON.stringify({ at: new Date().toISOString(), step: "auth", msg: String(err) }) + "\n");
  return { ok: false, error: "Could not send or check the code. Try again." };
}
