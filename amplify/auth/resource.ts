import { defineAuth } from "@aws-amplify/backend";

// Email codes, no passwords (USER_AUTH + EMAIL_OTP). The Next server talks to Cognito; the browser never does.
export const auth = defineAuth({
  loginWith: { email: { otpLogin: true } },
});
