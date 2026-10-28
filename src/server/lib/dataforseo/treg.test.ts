import { afterEach, describe, expect, it, vi } from "vitest";
import { createTregFetch } from "./treg";
import { resolveTregEndpoint } from "./treg-endpoints";

const upstream = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

afterEach(() => vi.unstubAllGlobals());

describe("Treg credential and billing boundary", () => {
  it.each([
    "https://attacker.example/v3/serp/google/organic/live/advanced",
    "https://api.dataforseo.com.attacker.example/v3/serp/google/organic/live/advanced",
    "http://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    "https://api.dataforseo.com/v3/serp/google/organic/task_post",
  ])("refuses unsupported targets before sending the team token: %s", async (url) => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    await expect(createTregFetch("team-token")(url, { method: "POST" }))
      .rejects.toMatchObject({ code: "TREG_ENDPOINT_UNAVAILABLE" });
    expect(network).not.toHaveBeenCalled();
  });

  it.each([
    [401, "TREG_AUTH_FAILED"],
    [402, "TREG_BILLING_ISSUE"],
    [429, "RATE_LIMITED"],
    [503, "UPSTREAM_UNAVAILABLE"],
  ])("sanitizes Treg's %i refusal without direct-provider fallback", async (status, code) => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { balance_micro: 19, topup_url: "https://private.example/billing" },
      { status, headers: { "X-Treg-Error": "1", "X-Treg-Call-Id": "call-1" } },
    ));
    vi.stubGlobal("fetch", network);
    const result = createTregFetch("team-token")(upstream, { method: "POST" });
    await expect(result).rejects.toMatchObject({
      code,
      message: code,
      details: { provider: "treg", providerStatus: String(status), callId: "call-1" },
    });
    expect(network).toHaveBeenCalledOnce();
  });

  it("does not send direct credentials or cookies to Treg and refuses redirects", async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", network);
    await createTregFetch("team-token")(upstream, {
      method: "POST",
      headers: { Authorization: "Basic secret", Cookie: "session=private", "X-Treg-Org": "wrong-team" },
    });
    const [, init] = network.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("Cookie")).toBe(false);
    expect(headers.has("X-Treg-Org")).toBe(false);
    expect(init?.redirect).toBe("error");
  });

  it("keeps async task ids in a single encoded query parameter", () => {
    const target = resolveTregEndpoint(new URL(
      "https://api.dataforseo.com/v3/business_data/google/reviews/task_get/task%26country%3Dwrong?id=other",
    ), "GET");
    expect(target.pathname).toBe("/call/dataforseo.x.business-data-google-reviews-task-get");
    expect(target.searchParams.get("id")).toBe("task&country=wrong");
    expect(target.searchParams.has("country")).toBe(false);
    expect(() => resolveTregEndpoint(new URL(upstream), "GET"))
      .toThrowError(expect.objectContaining({ code: "TREG_ENDPOINT_UNAVAILABLE" }));
  });
});
