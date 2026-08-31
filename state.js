const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
const KEYS = { restaurants: 'whattoeat:restaurants', votes: 'whattoeat:votes', history: 'whattoeat:history' }
function send(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)) }
async function redis(...command) {
  if (!REST_URL || !REST_TOKEN) throw new Error('尚未設定 Upstash Redis 環境變數')
  const response = await fetch(`${REST_URL}/${command.map((part) => encodeURIComponent(String(part))).join('/')}`, { headers: { Authorization: `Bearer ${REST_TOKEN}` } })
  const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || 'Upstash request failed'); return payload.result
}
function pairs(values) { const result = {}; for (let i = 0; i < (values || []).length; i += 2) result[values[i]] = values[i + 1]; return result }
async function getState() {
  const [rawRestaurants, rawVotes, rawHistory] = await Promise.all([redis('HGETALL', KEYS.restaurants), redis('HGETALL', KEYS.votes), redis('LRANGE', KEYS.history, 0, 49)])
  const votes = pairs(rawVotes)
  const restaurants = Object.values(pairs(rawRestaurants)).map(JSON.parse).map((item) => ({ ...item, votes: Number(votes[item.id] || 0) })).sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'zh-Hant'))
  return { restaurants, history: (rawHistory || []).map(JSON.parse) }
}
function cleanRestaurant(body) {
  const name = String(body.name || '').trim().slice(0, 80), category = String(body.category || '').trim().slice(0, 30), area = String(body.area || '').trim().slice(0, 30), price = Number(body.price), mapUrl = String(body.mapUrl || '').trim().slice(0, 500)
  const meal = [...new Set((Array.isArray(body.meal) ? body.meal : []).map(String).filter(Boolean))]
  if (!name || !category || !area || !Number.isFinite(price) || price < 0 || !meal.length) throw new Error('餐廳資料不完整')
  if (mapUrl) { let url; try { url = new URL(mapUrl) } catch { throw new Error('Google Maps 連結格式不正確') }; const host = url.hostname.toLowerCase(); if (url.protocol !== 'https:' || !(host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'google.com' || host.endsWith('.google.com'))) throw new Error('請使用 Google Maps 的 HTTPS 連結') }
  return { id: crypto.randomUUID(), name, category, area, price: Math.round(price), meal, mapUrl, createdAt: new Date().toISOString() }
}
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return send(res, 200, await getState())
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
    const body = req.body || {}
    if (body.action === 'batchAdd') {
      const input = Array.isArray(body.restaurants) ? body.restaurants.slice(0, 100) : []
      if (!input.length) return send(res, 400, { error: '沒有可匯入的餐廳' })
      const restaurants = input.map((item) => cleanRestaurant({ category: '未分類', area: '未設定', price: 0, meal: ['早餐', '午餐', '晚餐', '宵夜'], ...item }))
      await redis('HSET', KEYS.restaurants, ...restaurants.flatMap((item) => [item.id, JSON.stringify(item)]))
      return send(res, 201, { count: restaurants.length })
    }
    if (body.action === 'add') { const restaurant = cleanRestaurant(body.restaurant || {}); await redis('HSET', KEYS.restaurants, restaurant.id, JSON.stringify(restaurant)); return send(res, 201, { restaurant }) }
    const id = String(body.id || ''); if (!id) return send(res, 400, { error: '缺少餐廳 ID' })
    const raw = await redis('HGET', KEYS.restaurants, id); if (!raw) return send(res, 404, { error: '找不到這間餐廳' }); const restaurant = JSON.parse(raw)
    if (body.action === 'delete') { await Promise.all([redis('HDEL', KEYS.restaurants, id), redis('HDEL', KEYS.votes, id)]); return send(res, 200, { ok: true }) }
    if (body.action === 'vote') { const votes = Number(await redis('HINCRBY', KEYS.votes, id, 1)); const record = { id: crypto.randomUUID(), restaurantId: id, name: restaurant.name, createdAt: new Date().toISOString() }; await redis('LPUSH', KEYS.history, JSON.stringify(record)); await redis('LTRIM', KEYS.history, 0, 49); return send(res, 200, { votes, record }) }
    return send(res, 400, { error: '不支援的操作' })
  } catch (error) { console.error(error); return send(res, error.message.includes('環境變數') ? 503 : 400, { error: error.message || '伺服器發生錯誤' }) }
}
