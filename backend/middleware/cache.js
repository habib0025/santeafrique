// backend/middleware/cache.js
const redis = require('redis');
const client = redis.createClient();

async function cacheStockData(req, res, next) {
  const cacheKey = `bloodStocks:${req.params.centerId}`;
  const cached = await client.get(cacheKey);
  
  if (cached) return res.json(JSON.parse(cached));
  
  const data = await fetchFreshData();
  client.setEx(cacheKey, 3600, JSON.stringify(data)); // Cache 1h
  res.json(data);
}