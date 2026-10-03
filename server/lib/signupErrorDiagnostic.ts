const graphCodes = new Set([
  "invalid_client", "invalid_grant", "invalid_scope", "invalid_request", "unauthorized_client",
  "access_denied", "temporarily_unavailable", "server_error",
  "ErrorAccessDenied", "ErrorSendAsDenied", "ErrorInvalidUser", "ErrorInvalidRecipients",
  "MailboxNotEnabledForRESTAPI", "ErrorMailboxNotEnabledForRESTAPI", "ErrorItemNotFound",
  "Request_ResourceNotFound", "InvalidAuthenticationToken", "Authorization_RequestDenied",
  "OrganizationFromTenantGuidNotFound", "ErrorQuotaExceeded", "TooManyRequests",
  "ErrorInternalServerError", "ErrorMessageSizeExceeded", "ErrorMailRecipientNotFound",
]);

/** Keep provider HTTP/code metadata, never its raw body or descriptive message. */
export class SignupGraphError extends Error {
  readonly providerCode: string;
  constructor(readonly stage: "token" | "sendMail", readonly httpStatus: number, body: string) {
    super("Microsoft Graph verification email request failed");
    this.name = "SignupGraphError";
    let code: unknown;
    try {
      const parsed = JSON.parse(body);
      code = typeof parsed.error === "string" ? parsed.error : parsed.error?.code;
    } catch { /* Never retain/log a non-JSON response body. */ }
    this.providerCode = typeof code === "string" && graphCodes.has(code) ? code : "UNKNOWN_PROVIDER_CODE";
  }
}

/** Deliberately omit SQL detail, parameters, arbitrary messages, and request data. */
export function signupErrorDiagnostic(error: unknown) {
  const value = error instanceof Error ? error as Error & { code?: unknown } : null;
  const classes = ["Error", "TypeError", "RangeError", "AggregateError", "DatabaseError", "SignupGraphError"];
  const errorClass = value && classes.includes(value.constructor.name) ? value.constructor.name : "Error";
  const frame = value?.stack?.split("\n").filter(line => /^\s+at /.test(line))
    .map(line => line.match(/server\/(?:services\/(?:signupVerificationService|signupVerificationRuntime|signupVerificationEmail|microsoftGraphEmailService)|routes\/signupVerification|db|auth-utils)\.(?:ts|js):\d+:\d+/)?.[0])
    .find(Boolean);
  const source = frame ?? "server/routes/signupVerification.ts";
  if (error instanceof SignupGraphError) {
    return { errorClass, message: error.message, source,
      stage: error.stage, httpStatus: error.httpStatus, providerCode: error.providerCode };
  }
  const code = typeof value?.code === "string" && (
    /^(?:08|22|23|40|42|53|55|57|XX)[A-Z0-9]{3}$/.test(value.code)
    || ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH"].includes(value.code)
  ) ? value.code : "UNEXPECTED_BACKEND_ERROR";
  // Only anchored, structural PostgreSQL messages can pass through. No DETAIL,
  // query, values, addresses, stack header, credential echoes or provider bodies.
  const structural = value && ["42P01", "42703", "23505", "23502", "23503", "23514"].includes(code)
    && /^(?:relation "[a-zA-Z_][a-zA-Z0-9_.]*" does not exist|column "[a-zA-Z_][a-zA-Z0-9_.]*"(?: of relation "[a-zA-Z_][a-zA-Z0-9_.]*")? does not exist|duplicate key value violates unique constraint "[a-zA-Z_][a-zA-Z0-9_.]*"|null value in column "[a-zA-Z_][a-zA-Z0-9_.]*" of relation "[a-zA-Z_][a-zA-Z0-9_.]*" violates not-null constraint|insert or update on table "[a-zA-Z_][a-zA-Z0-9_.]*" violates foreign key constraint "[a-zA-Z_][a-zA-Z0-9_.]*"|new row for relation "[a-zA-Z_][a-zA-Z0-9_.]*" violates check constraint "[a-zA-Z_][a-zA-Z0-9_.]*")$/.test(value.message);
  const connectionMessage = value && [
    "Connection terminated unexpectedly", "Connection terminated", "timeout exceeded when trying to connect",
  ].includes(value.message);
  return { errorClass, code, message: structural || connectionMessage ? value!.message
    : "Signup backend exception; unsafe message withheld", source };
}