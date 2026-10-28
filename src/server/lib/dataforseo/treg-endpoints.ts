import { AppError } from "../errors";

// Verified against https://treg.to/catalog/providers/dataforseo on 2026-10-28.
// Do not derive ids from paths: some catalog names differ, and the raw URL
// proxy only serves a team's registered BYOK tools, not Treg's platform key.
const POST_ENDPOINTS: Readonly<Record<string, string>> = {
  "/v3/dataforseo_labs/google/related_keywords/live": "dataforseo.google.keywords.ideas",
  "/v3/dataforseo_labs/google/keyword_suggestions/live": "dataforseo.x.dataforseo-labs-google-keyword-suggestions-live",
  "/v3/dataforseo_labs/google/keyword_ideas/live": "dataforseo.x.dataforseo-labs-google-keyword-ideas-live",
  "/v3/dataforseo_labs/google/domain_rank_overview/live": "dataforseo.x.dataforseo-labs-google-domain-rank-overview-live",
  "/v3/dataforseo_labs/google/ranked_keywords/live": "dataforseo.google.domain.ranked_keywords",
  "/v3/dataforseo_labs/google/relevant_pages/live": "dataforseo.x.dataforseo-labs-google-relevant-pages-live",
  "/v3/dataforseo_labs/google/keyword_overview/live": "dataforseo.x.dataforseo-labs-google-keyword-overview-live",
  "/v3/dataforseo_labs/google/serp_competitors/live": "dataforseo.x.dataforseo-labs-google-serp-competitors-live",
  "/v3/keywords_data/google_ads/search_volume/live": "dataforseo.google.keywords.volume",
  "/v3/keywords_data/google_ads/keywords_for_keywords/live": "dataforseo.x.keywords-data-google-ads-keywords-for-keywords-live",
  "/v3/backlinks/summary/live": "dataforseo.web.backlinks.summary",
  "/v3/backlinks/backlinks/live": "dataforseo.web.backlinks.list",
  "/v3/backlinks/referring_domains/live": "dataforseo.web.linking_domains.list",
  "/v3/backlinks/domain_pages_summary/live": "dataforseo.x.backlinks-domain-pages-summary-live",
  "/v3/backlinks/history/live": "dataforseo.x.backlinks-history-live",
  "/v3/business_data/business_listings/search/live": "dataforseo.x.business-data-business-listings-search-live",
  "/v3/business_data/google/questions_and_answers/live": "dataforseo.x.business-data-google-questions-and-answers-live",
  "/v3/business_data/google/my_business_info/live": "dataforseo.x.business-data-google-my-business-info-live",
  "/v3/business_data/google/extended_reviews/task_post": "dataforseo.x.business-data-google-extended-reviews-task-post",
  "/v3/business_data/google/reviews/task_post": "dataforseo.x.business-data-google-reviews-task-post",
  "/v3/business_data/google/my_business_updates/task_post": "dataforseo.x.business-data-google-my-business-updates-task-post",
  "/v3/serp/google/organic/live/advanced": "dataforseo.x.serp-google-organic-live-advanced",
  "/v3/serp/google/maps/live/advanced": "dataforseo.x.serp-google-maps-live-advanced",
  "/v3/serp/google/local_finder/live/advanced": "dataforseo.x.serp-google-local-finder-live-advanced",
  "/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced": "dataforseo.x.ai-optimization-chat-gpt-llm-scraper-live-advanced",
  "/v3/ai_optimization/gemini/llm_scraper/live/advanced": "dataforseo.x.ai-optimization-gemini-llm-scraper-live-advanced",
  "/v3/ai_optimization/chat_gpt/llm_responses/live": "dataforseo.x.ai-optimization-chat-gpt-llm-responses-live",
  "/v3/ai_optimization/claude/llm_responses/live": "dataforseo.x.ai-optimization-claude-llm-responses-live",
  "/v3/ai_optimization/gemini/llm_responses/live": "dataforseo.x.ai-optimization-gemini-llm-responses-live",
  "/v3/ai_optimization/perplexity/llm_responses/live": "dataforseo.x.ai-optimization-perplexity-llm-responses-live",
  // Treg requires a team-owned DataForSEO key for Lighthouse.
  "/v3/on_page/lighthouse/live/json": "dataforseo.x.on-page-lighthouse-live-json",
};

export function resolveTregEndpoint(upstream: URL, method: string): URL {
  let id = method === "POST" ? POST_ENDPOINTS[upstream.pathname] : undefined;
  const params = new URLSearchParams(upstream.search);
  if (method === "GET") {
    const task = /^\/v3\/business_data\/google\/(reviews|extended_reviews|my_business_updates)\/task_get\/([^/]+)$/.exec(upstream.pathname);
    const location = /^\/v3\/serp\/google\/locations\/([a-z]{2})$/.exec(upstream.pathname);
    if (task) {
      id = `dataforseo.x.business-data-google-${task[1].replaceAll("_", "-")}-task-get`;
      params.set("id", decodeURIComponent(task[2]));
    } else if (location) {
      id = "dataforseo.x.serp-google-locations-country";
      params.set("country", location[1]);
    }
  }
  if (!id) {
    throw new AppError(
      "TREG_ENDPOINT_UNAVAILABLE",
      "This DataForSEO endpoint is not available in Treg's catalog.",
      { provider: "treg", providerPath: upstream.pathname },
    );
  }
  const target = new URL(`https://treg.to/call/${id}`);
  target.search = params.toString();
  return target;
}
