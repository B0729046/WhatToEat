import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Heart,
  History,
  MapPin,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Utensils,
} from "lucide-react";
const USERS = ["威威", "小蘇蘇"],
  ALL = "不限";
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
function Ranking({ restaurants, remove, vote, busy }) {
  return (
    <div className="panel">
      <h2>
        <Trophy size={20} />
        共享排名
      </h2>
      <div className="restaurant-list">
        {restaurants.length ? (
          restaurants.map((x) => (
            <div className="restaurant-row" key={x.id}>
              <div>
                <strong>{x.name}</strong>
                <small>
                  {x.category} · {x.area} · {x.votes} 票
                </small>
                <VoteButtons restaurant={x} {...{ vote, busy }} />
              </div>
              <div className="row-actions">
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
function Result({ result, rolling, restaurants, vote, busy }) {
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
          {result.category}
        </span>
        <span>
          <MapPin size={15} />
          {result.area}
        </span>
        <span>
          {result.price == null ? "價位未提供" : `約 NT$ ${result.price}`}
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
    [filters, setFilters] = useState({
      budget: ALL,
      category: ALL,
      area: ALL,
    }),
    [mapLink, setMapLink] = useState(""),
    [result, setResult] = useState(null),
    [rolling, setRolling] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("把選擇困難交給宇宙。");
  const load = async () => {
    try {
      const d = await api();
      setRestaurants(d.restaurants);
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
      category: [...new Set(restaurants.map((x) => x.category))],
      area: [...new Set(restaurants.map((x) => x.area))],
    }),
    [restaurants],
  );
  const matches = useMemo(
    () =>
      restaurants.filter(
        (x) =>
          (filters.category === ALL || x.category === filters.category) &&
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
          <Result {...{ result, rolling, restaurants, vote, busy }} />
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
        <Ranking {...{ restaurants, remove, vote, busy }} />
        <TodayVotes restaurants={restaurants} />
      </section>
      <footer>WHAT TO EAT · 所有人共享同一份名單與票數</footer>
    </main>
  );
}
