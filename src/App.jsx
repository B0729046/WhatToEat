import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  Heart,
  History,
  MapPin,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Utensils,
} from "lucide-react";
const USERS = ["威威", "小蘇蘇"],
  ALL = "不限",
  CATEGORY_OPTIONS = [
    "台式",
    "日式",
    "韓式",
    "義式",
    "東南亞",
    "鍋物",
    "燒肉",
    "咖啡廳",
    "早餐",
    "甜點",
    "素食",
    "其他",
  ];
function Filter({ label, value, options, onChange }) {
  return (
    <label className="filter-group">
      <span>{label}</span>
      <div className="select-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option>{ALL}</option>
          {options.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </div>
    </label>
  );
}
async function api(options) {
  const r = await fetch("/api/state", options),
    text = await r.text();
  let d = {};
  try {
    d = JSON.parse(text);
  } catch {
    d = {};
  }
  if (!r.ok) throw Error(d.error || `共享資料 API 錯誤（HTTP ${r.status}）`);
  return d;
}
function QuickAdd({ mapLink, setMapLink, addFromMap, busy }) {
  return (
    <div className="panel quick-add-panel">
      <h2>
        <MapPin size={20} />
        新增餐廳
      </h2>
      <p className="panel-help">
        貼上 Google Maps 餐廳連結，自動取得名稱並加入共享清單。
      </p>
      <form className="quick-add-form" onSubmit={addFromMap}>
        <input
          required
          type="url"
          value={mapLink}
          onChange={(e) => setMapLink(e.target.value)}
          placeholder="貼上 Google Map 網址"
        />
        <button className="secondary-button" disabled={busy || !mapLink.trim()}>
          解析連結並新增
        </button>
      </form>
    </div>
  );
}
function VoteButtons({ restaurant, vote, busy }) {
  const voters = restaurant.voters || [];
  return (
    <div className={`vote-box ${voters.length === 2 ? "unanimous" : ""}`}>
      <div className="vote-caption">
        <Heart size={14} fill={voters.length ? "currentColor" : "none"} />
        {voters.length === 2
          ? "兩個人都想吃！"
          : voters.length === 1
            ? `${voters[0]}想吃`
            : "今天誰想吃？"}
      </div>
      <div className="vote-buttons">
        {USERS.map((user) => {
          const selected = voters.includes(user);
          return (
            <button
              key={user}
              aria-pressed={selected}
              className={
                selected ? `selected ${user === "威威" ? "wei" : "su"}` : ""
              }
              onClick={() => vote(restaurant, user)}
              disabled={busy}
            >
              <span className="voter-avatar">
                {user === "威威" ? "威" : "蘇"}
              </span>
              <span>
                <strong>{user}</strong>
                <small>{selected ? "已選這間" : "我想吃"}</small>
              </span>
              <span className="vote-mark">{selected ? "✓" : "+"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function lastEatenText(x) {
  if (x.daysSinceEaten == null) return "還沒吃過";
  if (x.daysSinceEaten === 0) return "今天吃過";
  return `距離上次吃 ${x.daysSinceEaten} 天`;
}
function Ranking({ restaurants, remove, vote, eat, edit, busy }) {
  return (
    <div className="panel ranking-panel">
      <div className="ranking-heading">
        <div>
          <span className="ranking-kicker">TODAY'S LEADERBOARD</span>
          <h2>
            <Trophy size={24} /> 今天想吃排行榜
          </h2>
        </div>
        <span className="ranking-total">{restaurants.length} 間候選</span>
      </div>
      <div className="restaurant-list">
        {restaurants.length ? (
          restaurants.map((x, index) => (
            <div className="restaurant-row" key={x.id}>
              <span className={`rank-number rank-${index + 1}`}>
                {index + 1}
              </span>
              <div className="restaurant-main">
                <strong>{x.name}</strong>
                <small>
                  {(x.categories || [x.category]).join("、")} · {x.area} ·{" "}
                  {x.price == null ? "價位未定" : `NT$ ${x.price}`}
                </small>
                <span
                  className={`last-eaten ${x.daysSinceEaten === 0 ? "today" : ""}`}
                >
                  <History size={13} /> {lastEatenText(x)}
                </span>
                <VoteButtons restaurant={x} {...{ vote, busy }} />
                <button
                  className="eat-button"
                  onClick={() => eat(x)}
                  disabled={busy}
                >
                  <Check size={16} /> 今天吃這間
                </button>
              </div>
              <div className="row-actions">
                <button
                  onClick={() => edit(x)}
                  disabled={busy}
                  aria-label={`編輯 ${x.name}`}
                >
                  <Pencil size={17} />
                </button>
                {x.mapUrl && (
                  <a
                    href={x.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${x.name} Google Maps`}
                  >
                    <MapPin size={17} />
                  </a>
                )}
                <button
                  onClick={() => remove(x)}
                  disabled={busy}
                  aria-label={`刪除 ${x.name}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">清單是空的，新增第一間餐廳吧。</p>
        )}
      </div>
    </div>
  );
}
function TodayVotes({ restaurants }) {
  return (
    <div className="panel history-panel">
      <h2>
        <History size={20} />
        今天誰投了什麼
      </h2>
      <div className="today-votes">
        {USERS.map((user) => {
          const picks = restaurants.filter((item) =>
            item.voters?.includes(user),
          );
          return (
            <section
              key={user}
              className={`today-voter ${user === "威威" ? "wei" : "su"}`}
            >
              <header>
                <span className="voter-avatar">
                  {user === "威威" ? "威" : "蘇"}
                </span>
                <div>
                  <strong>{user}</strong>
                  <small>
                    {picks.length
                      ? `今天選了 ${picks.length} 間`
                      : "今天還沒投票"}
                  </small>
                </div>
              </header>
              <div className="today-picks">
                {picks.length ? (
                  picks.map((item) => <span key={item.id}>{item.name}</span>)
                ) : (
                  <em>等待選擇中</em>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
function DiningHistory({ diningHistory }) {
  return (
    <div className="panel dining-history-panel">
      <h2>
        <CalendarDays size={20} /> 用餐歷史
      </h2>
      <div className="dining-history-list">
        {diningHistory.length ? (
          diningHistory.map((item) => (
            <div className="dining-history-row" key={item.date}>
              <time>
                {new Date(`${item.date}T00:00:00+08:00`).toLocaleDateString(
                  "zh-TW",
                  { month: "short", day: "numeric", weekday: "short" },
                )}
              </time>
              <strong>{item.name}</strong>
            </div>
          ))
        ) : (
          <p className="muted">還沒有紀錄，選定餐廳後按「今天吃這間」。</p>
        )}
      </div>
    </div>
  );
}
function EditRestaurant({ restaurant, save, close, busy }) {
  const [categories, setCategories] = useState(
    restaurant.categories?.length
      ? restaurant.categories
      : [restaurant.category],
  );
  const [price, setPrice] = useState(restaurant.price ?? "");
  const toggle = (category) =>
    setCategories((old) =>
      old.includes(category)
        ? old.filter((x) => x !== category)
        : [...old, category],
    );
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <form
        className="edit-modal"
        onSubmit={(e) => {
          e.preventDefault();
          save(restaurant, categories, price);
        }}
      >
        <span className="ranking-kicker">EDIT RESTAURANT</span>
        <h2>編輯 {restaurant.name}</h2>
        <label className="edit-label">料理分類（可複選）</label>
        <div className="category-picker">
          {CATEGORY_OPTIONS.map((category) => (
            <button
              type="button"
              key={category}
              className={categories.includes(category) ? "selected" : ""}
              onClick={() => toggle(category)}
            >
              <Check size={14} />
              {category}
            </button>
          ))}
        </div>
        <label className="edit-label" htmlFor="edit-price">
          每人價錢
        </label>
        <div className="price-input">
          <span>NT$</span>
          <input
            id="edit-price"
            type="number"
            required
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="例如 350"
          />
        </div>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            取消
          </button>
          <button
            className="secondary-button"
            disabled={busy || !categories.length}
          >
            儲存修改
          </button>
        </div>
      </form>
    </div>
  );
}
function Result({ result, rolling, restaurants, vote, eat, busy }) {
  if (!result)
    return (
      <div className="empty-result">
        <Utensils size={34} />
        <span>
          {restaurants.length
            ? "你的下一餐，正在平行宇宙等你"
            : "目前還沒有餐廳，請先新增"}
        </span>
      </div>
    );
  return (
    <div className={`result-card ${rolling ? "" : "revealed"}`}>
      <span className="result-label">{rolling ? "搜尋美味中" : "THE ONE"}</span>
      <h2>{result.name}</h2>
      <div className="result-meta">
        <span>
          <Utensils size={15} />
          {(result.categories || [result.category]).join("、")}
        </span>
        <span>
          <MapPin size={15} />
          {result.area}
        </span>
        <span>
          {result.price == null
            ? "價位未提供"
            : `${result.priceEstimated ? "預估" : "約"} NT$ ${result.price}`}
        </span>
        <span>
          <Trophy size={15} />
          {restaurants.find((x) => x.id === result.id)?.votes || 0} 票
        </span>
      </div>
      {!rolling && (
        <div className="result-actions">
          <VoteButtons
            restaurant={restaurants.find((x) => x.id === result.id) || result}
            {...{ vote, busy }}
          />
          <button
            className="eat-button"
            onClick={() => eat(result)}
            disabled={busy}
          >
            <Check size={16} /> 今天吃這間
          </button>
          {result.mapUrl && (
            <a href={result.mapUrl} target="_blank" rel="noreferrer">
              Google Maps <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
export default function App() {
  const [restaurants, setRestaurants] = useState([]),
    [diningHistory, setDiningHistory] = useState([]),
    [filters, setFilters] = useState({
      budget: ALL,
      category: ALL,
      area: ALL,
    }),
    [mapLink, setMapLink] = useState(""),
    [result, setResult] = useState(null),
    [rolling, setRolling] = useState(false),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("把選擇困難交給宇宙。");
  const load = async () => {
    try {
      const d = await api();
      setRestaurants(d.restaurants);
      setDiningHistory(d.diningHistory || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  // Initial fetch synchronizes this client with the shared Redis state.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, []);
  const options = useMemo(
    () => ({
      category: [
        ...new Set(restaurants.flatMap((x) => x.categories || [x.category])),
      ],
      area: [...new Set(restaurants.map((x) => x.area))],
    }),
    [restaurants],
  );
  const matches = useMemo(
    () =>
      restaurants.filter(
        (x) =>
          (filters.category === ALL ||
            (x.categories || [x.category]).includes(filters.category)) &&
          (filters.area === ALL || x.area === filters.area) &&
          (filters.budget === ALL ||
            (x.price != null && x.price <= Number(filters.budget))),
      ),
    [restaurants, filters],
  );
  const update = (key, value) =>
    setFilters((old) => ({ ...old, [key]: value }));
  const decide = () => {
    if (rolling) return;
    if (!matches.length) {
      setResult(null);
      setMessage(
        restaurants.length
          ? "這條件太挑了，放寬一點吧！"
          : "先在下方新增餐廳，就可以開始抽籤。",
      );
      return;
    }
    setRolling(true);
    setMessage("命運轉動中…");
    let ticks = 0;
    const timer = setInterval(() => {
      setResult(matches[Math.floor(Math.random() * matches.length)]);
      if (++ticks >= 13) {
        clearInterval(timer);
        setResult(matches[Math.floor(Math.random() * matches.length)]);
        setRolling(false);
        setMessage("命運已決定。喜歡就投它一票！");
      }
    }, 100);
  };
  const mutate = async (payload) => {
    setBusy(true);
    setError("");
    try {
      await api({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const addFromMap = async (e) => {
    e.preventDefault();
    if (await mutate({ action: "addFromMapUrl", mapUrl: mapLink })) {
      setMapLink("");
      setMessage("已從 Google Maps 連結新增餐廳。");
    }
  };
  const remove = async (x) => {
    if (
      confirm(`確定刪除「${x.name}」？票數也會一起刪除。`) &&
      (await mutate({ action: "delete", id: x.id })) &&
      result?.id === x.id
    )
      setResult(null);
  };
  const vote = async (restaurant, voter) => {
    const wasSelected = restaurant.voters?.includes(voter);
    if (await mutate({ action: "vote", id: restaurant.id, voter }))
      setMessage(
        `${voter}${wasSelected ? "取消投給" : "投給"} ${restaurant.name}。`,
      );
  };
  const eat = async (restaurant) => {
    if (
      !confirm(`確定今天吃「${restaurant.name}」？今天若已有紀錄會改成這間。`)
    )
      return;
    if (await mutate({ action: "eat", id: restaurant.id }))
      setMessage(`已記下今天吃 ${restaurant.name}。`);
  };
  const saveEdit = async (restaurant, categories, price) => {
    if (
      await mutate({
        action: "update",
        id: restaurant.id,
        categories,
        price: price === "" ? null : Number(price),
      })
    ) {
      setEditing(null);
      setMessage(`已更新 ${restaurant.name} 的分類與價錢。`);
    }
  };
  return (
    <main className="app-shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <section className="hero">
        <div className="eyebrow">
          <Sparkles size={15} /> SHARED FOOD ORACLE
        </div>
        <h1>
          今天
          <br className="mobile-break" />
          吃什麼？
        </h1>
        <p>新增口袋名單、一起投票，讓命運替大家選一餐。</p>
      </section>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <section className="ranking-spotlight">
        <Ranking
          restaurants={restaurants}
          remove={remove}
          vote={vote}
          eat={eat}
          edit={setEditing}
          busy={busy}
        />
      </section>
      <section className="glass-card">
        <div className="filters">
          <Filter
            label="預算"
            value={filters.budget}
            options={["150", "250", "350", "500"]}
            onChange={(v) => update("budget", v)}
          />
          <Filter
            label="料理"
            value={filters.category}
            options={options.category}
            onChange={(v) => update("category", v)}
          />
          <Filter
            label="地區"
            value={filters.area}
            options={options.area}
            onChange={(v) => update("area", v)}
          />
        </div>
        <div className="match-count">
          目前有 <strong>{matches.length}</strong> 個命運候選
        </div>
        <div className="result-stage" aria-live="polite">
          <Result {...{ result, rolling, restaurants, vote, eat, busy }} />
        </div>
        <p className="message">{message}</p>
        <button
          className="decide-button"
          onClick={decide}
          disabled={rolling || busy}
        >
          {result && !rolling ? (
            <RotateCcw size={21} />
          ) : (
            <Sparkles size={21} />
          )}{" "}
          {rolling ? "正在召喚命運…" : result ? "再抽一次" : "幫我決定"}
        </button>
      </section>
      <section className="community-grid">
        <QuickAdd {...{ mapLink, setMapLink, addFromMap, busy }} />
        <TodayVotes restaurants={restaurants} />
        <DiningHistory diningHistory={diningHistory} />
      </section>
      {editing && (
        <EditRestaurant
          key={editing.id}
          restaurant={editing}
          save={saveEdit}
          close={() => setEditing(null)}
          busy={busy}
        />
      )}
      <footer>WHAT TO EAT · 所有人共享同一份名單與票數</footer>
    </main>
  );
}
