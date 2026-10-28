import { AppError } from "../errors";
import type { ErrorCode } from "../../../shared/error-codes";
import { resolveTregEndpoint } from "./treg-endpoints";

/** DataForSEO-compatible transport through Treg's metered catalog, never its BYOK proxy. */
export function createTregFetch(token: string): typeof fetch {
  return async (input, init) => {
    const source = input instanceof Request ? input : undefined;
    const url = new URL(source?.url ?? String(input));
    if (url.origin !== "https://api.dataforseo.com") {
      throw new AppError(
        "TREG_ENDPOINT_UNAVAILABLE",
        "Treg only accepts production DataForSEO endpoints.",
      );
    }
    const method = (init?.method ?? source?.method ?? "GET").toUpperCase();
    const target = resolveTregEndpoint(url, method);
    const headers = new Headers(init?.headers ?? source?.headers);
    headers.delete("Authorization");
    headers.delete("Cookie");
    headers.delete("X-Treg-Org");
    headers.set("X-Treg-Token", token);
    headers.set("X-Treg-Meta", "app=openseo");
    if (!headers.has("Idempotency-Key")) {
      headers.set("Idempotency-Key", crypto.randomUUID());
    }
    const response = await fetch(target, {
      ...init,
      method,
      headers,
      body: init?.body ?? source?.body,
      signal: init?.signal ?? source?.signal,
      // Never forward the team token to a redirect destination.
      redirect: "error",
    });
    const callId = response.headers.get("X-Treg-Call-Id");
    console.info("treg.call", {
      event: "treg.call",
      path: url.pathname,
      callId,
      costMicro: response.headers.get("X-Treg-Cost-Micro"),
      status: response.status,
    });
    if (response.headers.get("X-Treg-Error") === "1") {
      // Treg's refusal body can contain the team's balance and private billing
      // links. Do not expose or log it; provider errors still pass through.
      await response.body?.cancel();
      const code: ErrorCode =
        response.status === 402
          ? "TREG_BILLING_ISSUE"
          : response.status === 401 || response.status === 403
            ? "TREG_AUTH_FAILED"
            : response.status === 429
              ? "RATE_LIMITED"
              : response.status >= 500 || response.status === 409
                ? "UPSTREAM_UNAVAILABLE"
                : "TREG_ENDPOINT_UNAVAILABLE";
      throw new AppError(code, code, {
        provider: "treg",
        providerStatus: String(response.status),
        ...(callId ? { callId } : {}),
      });
    }
    return response;
  };
}
