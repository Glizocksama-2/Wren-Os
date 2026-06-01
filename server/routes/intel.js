import { authenticate } from "../middleware/authenticate.js";
import { createIntelService } from "../services/intel.service.js";

export function createIntelRouter({ express, service = createIntelService(), authService }) {
  const router = express.Router();
  const requireAuth = authenticate({ authService });

  router.get("/news", async (request, response) => {
    setPublicCache(response, 600, 1800);
    const payload = await service.fetchNews();
    const category = getOptionalQuery(request.query.category);
    const region = getOptionalQuery(request.query.region);
    const page = Math.max(1, Number(request.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(request.query.limit ?? 10)));
    const filtered = payload.items.filter((item) => (!category || item.category === category) && (!region || item.region === region));
    response.json({
      ...payload,
      page,
      limit,
      total: filtered.length,
      items: filtered.slice((page - 1) * limit, page * limit)
    });
  });

  router.get("/crypto", async (_request, response) => {
    setPublicCache(response, 60, 300);
    response.json(await service.fetchCrypto());
  });
  router.get("/stocks/kenya", async (_request, response) => {
    setPublicCache(response, 300, 900);
    response.json(await service.fetchNSEStocks());
  });
  router.get("/stocks/global", async (_request, response) => {
    setPublicCache(response, 300, 900);
    response.json(await service.fetchGlobalStocks());
  });
  router.get("/forex", async (_request, response) => {
    setPublicCache(response, 900, 1800);
    response.json(await service.fetchForex());
  });
  router.get("/indicators", async (_request, response) => {
    setPublicCache(response, 3600, 7200);
    response.json(await service.fetchIndicators());
  });
  router.get("/all", async (_request, response) => {
    setPublicCache(response, 60, 300);
    response.json(await service.fetchAll());
  });

  router.post("/refresh/:type", requireAuth, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const method = getRefreshMethod(service, request.params.type);
    if (!method) {
      response.status(404).json({ error: "Unknown intel refresh type." });
      return;
    }
    response.json(await method({ force: true }));
  });

  return router;
}

function getRefreshMethod(service, type) {
  const methods = {
    news: service.fetchNews,
    crypto: service.fetchCrypto,
    "stocks-kenya": service.fetchNSEStocks,
    stocksKenya: service.fetchNSEStocks,
    "stocks-global": service.fetchGlobalStocks,
    stocksGlobal: service.fetchGlobalStocks,
    forex: service.fetchForex,
    indicators: service.fetchIndicators
  };
  return methods[type]?.bind(service) ?? null;
}

function getOptionalQuery(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function setPublicCache(response, sMaxAgeSeconds, staleWhileRevalidateSeconds) {
  response.set("Cache-Control", `public, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`);
}
