import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Apple,
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  History,
  Info,
  MapPin,
  Menu,
  Pencil,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
  Utensils,
  X,
} from "lucide-react";
import {
  DRAW_SCOPES,
  getDailyItalianLesson,
  isZhongheRestaurant,
  rankRestaurants,
  selectableRestaurants,
} from "./selection.js";
const USERS = ["威威", "小蘇蘇"],
  ALL = "不限",
  CACHE_KEY = "whattoeat:last-state",
  CATEGORY_OPTIONS = ["台式", "日式", "韓式", "義式", "東南亞", "鍋物", "其他"];
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
function VoteButtons({ restaurant, vote, busy, currentVoter, chooseVoter }) {
  const voters = restaurant.voters || [];
  const selected = currentVoter ? voters.includes(currentVoter) : false;
  return (
    <div className="vote-buttons">
      <button
        aria-pressed={selected}
        className={
          selected ? `selected ${currentVoter === "威威" ? "wei" : "su"}` : ""
        }
        onClick={() =>
          currentVoter
            ? vote(restaurant, currentVoter)
            : chooseVoter(restaurant)
        }
        disabled={busy}
      >
        <strong>{selected ? "已投票" : "投票"}</strong>
        <span className="vote-mark">{selected ? "✓" : "+"}</span>
      </button>
    </div>
  );
}
function lastEatenText(x) {
  if (x.daysSinceEaten == null) return "還沒吃過";
  if (x.daysSinceEaten === 0) return "今天吃過";
  return `距離上次吃 ${x.daysSinceEaten} 天`;
}
function visitText(visit, now) {
  if (!visit?.visitedAt) return "尚無稽查紀錄";
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(visit.visitedAt).getTime()) / 60000),
  );
  const ago =
    minutes < 1
      ? "剛剛"
      : minutes < 60
        ? `${minutes} 分鐘前`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)} 小時前`
          : `${Math.floor(minutes / 1440)} 天前`;
  return `${visit.voter} ${ago}稽查過投票結果`;
}
function LastVisit({ visit, now }) {
  return (
    <div className="last-visit">
      <Eye size={15} />
      {visitText(visit, now)}
    </div>
  );
}
function Ranking({
  restaurants,
  vote,
  edit,
  showDetail,
  busy,
  currentVoter,
  chooseVoter,
  expanded,
  setExpanded,
}) {
  const ranks = rankRestaurants(restaurants);
  const visibleRestaurants = expanded ? restaurants : restaurants.slice(0, 5);
  return (
    <div className="panel ranking-panel">
      <div className="ranking-heading">
        <div>
          <span className="ranking-kicker">TODAY'S LEADERBOARD</span>
          <h2>
            <Trophy size={24} /> 今天想吃排行榜
          </h2>
        </div>
        <div className="ranking-summary">
          <span className="ranking-total">{restaurants.length} 間候選</span>
          <small>長按或點資訊查看詳細</small>
        </div>
      </div>
      <div className="restaurant-list">
        {restaurants.length ? (
          visibleRestaurants.map((x) => {
            const index = restaurants.findIndex((item) => item.id === x.id);
            return (
              <div
                className="restaurant-row"
                key={x.id}
                onPointerDown={(e) => {
                  if (e.target.closest("button, a")) return;
                  const card = e.currentTarget;
                  card.dataset.held = "false";
                  card.dataset.startX = e.clientX;
                  card.dataset.startY = e.clientY;
                  card.dataset.timer = setTimeout(() => {
                    card.dataset.held = "true";
                    showDetail(x);
                  }, 500);
                }}
                onPointerMove={(e) => {
                  const card = e.currentTarget;
                  if (
                    Math.abs(e.clientX - Number(card.dataset.startX)) > 10 ||
                    Math.abs(e.clientY - Number(card.dataset.startY)) > 10
                  )
                    clearTimeout(Number(card.dataset.timer));
                }}
                onPointerUp={(e) =>
                  clearTimeout(Number(e.currentTarget.dataset.timer))
                }
                onPointerCancel={(e) =>
                  clearTimeout(Number(e.currentTarget.dataset.timer))
                }
                onPointerLeave={(e) =>
                  clearTimeout(Number(e.currentTarget.dataset.timer))
                }
                onClickCapture={(e) => {
                  if (e.currentTarget.dataset.held === "true") {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.dataset.held = "false";
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span
                  className={`rank-number ${ranks[index] ? `rank-${ranks[index]}` : "rank-empty"}`}
                  aria-label={
                    ranks[index] ? `第 ${ranks[index]} 名` : "尚無排名"
                  }
                >
                  {ranks[index] || "·"}
                </span>
                <div className="restaurant-main">
                  <strong>{x.name}</strong>
                  <small>{x.votes} 票</small>
                  <div className="restaurant-status-row">
                    <span
                      className={`last-eaten ${x.daysSinceEaten === 0 ? "today" : ""}`}
                    >
                      <History size={13} /> {lastEatenText(x)}
                    </span>
                    <VoteButtons
                      restaurant={x}
                      {...{ vote, busy, currentVoter, chooseVoter }}
                    />
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      showDetail(x);
                    }}
                    aria-label={`查看 ${x.name} 的詳細資訊`}
                  >
                    <Info size={17} />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      edit(x);
                    }}
                    disabled={busy}
                    aria-label={`編輯 ${x.name}`}
                  >
                    <Settings size={17} />
                  </button>
                  {x.mapUrl && (
                    <a
                      href={x.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${x.name} Google Maps`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MapPin size={17} />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted">清單是空的，新增第一間餐廳吧。</p>
        )}
      </div>
      {restaurants.length > 5 && (
        <button
          className="ranking-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "收起" : `查看全部 ${restaurants.length} 間`}
        </button>
      )}
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
function ZhongheFood({ restaurants, edit, showDetail, busy }) {
  return (
    <div className="panel zhonghe-panel">
      <div className="zhonghe-heading">
        <div>
          <span className="ranking-kicker">ZHONGHE FAVORITES</span>
          <h2>
            <MapPin size={22} /> 中窩美食
          </h2>
        </div>
        <span>{restaurants.length} 間</span>
      </div>
      <p className="panel-help">
        地區包含中和的餐廳會自動收進這裡，也會繼續保留在原本排行榜。
      </p>
      <div className="zhonghe-list">
        {restaurants.length ? (
          restaurants.map((restaurant) => (
            <article className="zhonghe-row" key={restaurant.id}>
              <div>
                <strong>{restaurant.name}</strong>
                <small>{restaurant.area || "中和區"}</small>
              </div>
              <div className="zhonghe-actions">
                <button
                  type="button"
                  onClick={() => showDetail(restaurant)}
                  aria-label={`查看 ${restaurant.name} 的詳細資訊`}
                >
                  <Info size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => edit(restaurant)}
                  disabled={busy}
                  aria-label={`編輯 ${restaurant.name}`}
                >
                  <Settings size={17} />
                </button>
                {restaurant.mapUrl && (
                  <a
                    href={restaurant.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${restaurant.name} Google Maps`}
                  >
                    <MapPin size={17} />
                  </a>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="muted">目前還沒有地區標示為中和的餐廳。</p>
        )}
      </div>
    </div>
  );
}
function DiningHistory({ diningHistory, editMeal, addMeal, busy }) {
  return (
    <div className="panel dining-history-panel">
      <div className="history-heading">
        <h2>
          <CalendarDays size={20} /> 用餐歷史
        </h2>
        <button
          className="history-add-button"
          onClick={addMeal}
          disabled={busy}
        >
          ＋ 新增紀錄
        </button>
      </div>
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
              <button onClick={() => editMeal(item)} disabled={busy}>
                <Pencil size={15} /> 更正
              </button>
            </div>
          ))
        ) : (
          <p className="muted">還沒有用餐紀錄，請用右上方按鈕手動新增。</p>
        )}
      </div>
    </div>
  );
}
function AddMealEditor({ restaurants, save, close, busy }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [date, setDate] = useState(today);
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id || "");
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <form
        className="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-label="新增用餐紀錄"
        onSubmit={(e) => {
          e.preventDefault();
          save(date, restaurantId);
        }}
      >
        <span className="ranking-kicker">ADD DINING HISTORY</span>
        <h2>新增用餐紀錄</h2>
        <label className="edit-label" htmlFor="new-meal-date">
          日期
        </label>
        <input
          className="modal-input"
          id="new-meal-date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <label className="edit-label" htmlFor="new-meal-restaurant">
          餐廳
        </label>
        <select
          className="modal-input"
          id="new-meal-restaurant"
          required
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
        >
          {restaurants.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="meal-modal-actions add-meal-actions">
          <button type="button" onClick={close}>
            取消
          </button>
          <button className="secondary-button" disabled={busy || !restaurantId}>
            新增紀錄
          </button>
        </div>
      </form>
    </div>
  );
}
function MealEditor({ meal, restaurants, save, remove, close, busy }) {
  const [date, setDate] = useState(meal.date);
  const [restaurantId, setRestaurantId] = useState(meal.restaurantId);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <form
        className="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-label="更正用餐紀錄"
        onSubmit={(e) => {
          e.preventDefault();
          save(meal, date, restaurantId);
        }}
      >
        <span className="ranking-kicker">EDIT DINING HISTORY</span>
        <h2>更正用餐紀錄</h2>
        <label className="edit-label" htmlFor="meal-date">
          日期
        </label>
        <input
          className="modal-input"
          id="meal-date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <label className="edit-label" htmlFor="meal-restaurant">
          餐廳
        </label>
        <select
          className="modal-input"
          id="meal-restaurant"
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
        >
          {restaurants.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="meal-modal-actions">
          <button
            type="button"
            className="danger-button"
            onClick={() => remove(meal)}
            disabled={busy}
          >
            <Trash2 size={15} /> 刪除紀錄
          </button>
          <button type="button" onClick={close}>
            取消
          </button>
          <button className="secondary-button" disabled={busy}>
            儲存更正
          </button>
        </div>
      </form>
    </div>
  );
}
function DetailModal({ restaurant, close }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        className="edit-modal detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restaurant-detail-title"
        tabIndex="-1"
      >
        <span className="ranking-kicker">RESTAURANT DETAILS</span>
        <h2 id="restaurant-detail-title">{restaurant.name}</h2>
        <dl>
          <div>
            <dt>料理</dt>
            <dd>
              {(restaurant.categories || [restaurant.category]).join("、")}
            </dd>
          </div>
          <div>
            <dt>地區</dt>
            <dd>{restaurant.area}</dd>
          </div>
          <div>
            <dt>價錢</dt>
            <dd>
              {restaurant.price == null
                ? "尚未設定"
                : `${restaurant.priceEstimated ? "預估 " : ""}NT$ ${restaurant.price} / 人`}
            </dd>
          </div>
          <div>
            <dt>上次吃</dt>
            <dd>{lastEatenText(restaurant)}</dd>
          </div>
          <div>
            <dt>關門時間</dt>
            <dd>{restaurant.closingTime || "尚未設定"}</dd>
          </div>
        </dl>
        <button className="secondary-button" onClick={close}>
          關閉
        </button>
      </div>
    </div>
  );
}
function EditRestaurant({ restaurant, save, remove, close, busy }) {
  const [name, setName] = useState(restaurant.name);
  const [categories, setCategories] = useState(
    (() => {
      const available = (
        restaurant.categories?.length
          ? restaurant.categories
          : [restaurant.category]
      ).filter((category) => CATEGORY_OPTIONS.includes(category));
      return available.length ? available : ["其他"];
    })(),
  );
  const [price, setPrice] = useState(restaurant.price ?? "");
  const [area, setArea] = useState(restaurant.area || "");
  const [closingTime, setClosingTime] = useState(restaurant.closingTime || "");
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
        role="dialog"
        aria-modal="true"
        aria-label="餐廳更多設定"
        onSubmit={(e) => {
          e.preventDefault();
          save(restaurant, name, categories, area, price, closingTime);
        }}
      >
        <span className="ranking-kicker">MORE SETTINGS</span>
        <label className="edit-label" htmlFor="edit-restaurant-name">
          餐廳名稱
        </label>
        <input
          className="modal-input"
          id="edit-restaurant-name"
          required
          maxLength="80"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="edit-label" htmlFor="edit-restaurant-area">
          地區
        </label>
        <input
          className="modal-input"
          id="edit-restaurant-area"
          required
          maxLength="30"
          value={area}
          onChange={(event) => setArea(event.target.value)}
          placeholder="例如：中山區"
        />
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
        <label className="edit-label" htmlFor="edit-closing-time">
          關門時間（可留空）
        </label>
        <input
          className="modal-input"
          id="edit-closing-time"
          type="time"
          value={closingTime}
          onChange={(event) => setClosingTime(event.target.value)}
        />
        <label className="edit-label" htmlFor="edit-price">
          每人價錢{restaurant.priceEstimated ? "（目前為預估）" : ""}
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
          <button
            type="button"
            className="danger-button"
            onClick={() => remove(restaurant)}
            disabled={busy}
          >
            <Trash2 size={15} /> 移除餐廳
          </button>
          <button type="button" onClick={close}>
            取消
          </button>
          <button
            className="secondary-button"
            disabled={
              busy || !name.trim() || !area.trim() || !categories.length
            }
          >
            儲存修改
          </button>
        </div>
      </form>
    </div>
  );
}
function IdentityPicker({ select, close }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="edit-modal identity-modal"
        role="dialog"
        aria-modal="true"
        aria-label="選擇投票使用者"
      >
        <span className="ranking-kicker">WHO ARE YOU</span>
        <h2>這次是誰投票？</h2>
        <p>只要選一次，這台裝置之後會自動記住。</p>
        <div className="identity-options">
          {USERS.map((user) => (
            <button key={user} onClick={() => select(user)}>
              {user}
            </button>
          ))}
        </div>
        <button className="identity-cancel" onClick={close}>
          取消
        </button>
      </div>
    </div>
  );
}
function Result({
  result,
  rolling,
  restaurants,
  vote,
  busy,
  currentVoter,
  chooseVoter,
}) {
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
            {...{ vote, busy, currentVoter, chooseVoter }}
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
  const toastTimer = useRef(null);
  const lastVisitTimer = useRef(null);
  const [restaurants, setRestaurants] = useState([]),
    [diningHistory, setDiningHistory] = useState([]),
    [lastVisit, setLastVisit] = useState(null),
    [showLastVisit, setShowLastVisit] = useState(false),
    [now, setNow] = useState(Date.now()),
    [filters, setFilters] = useState({
      category: ALL,
      area: ALL,
    }),
    [mapLink, setMapLink] = useState(""),
    [result, setResult] = useState(null),
    [rolling, setRolling] = useState(false),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(null),
    [editingMeal, setEditingMeal] = useState(null),
    [addingMeal, setAddingMeal] = useState(false),
    [currentVoter, setCurrentVoter] = useState(null),
    [identityPickerOpen, setIdentityPickerOpen] = useState(false),
    [pendingVote, setPendingVote] = useState(null),
    [page, setPage] = useState("home"),
    [menuOpen, setMenuOpen] = useState(false),
    [rankingExpanded, setRankingExpanded] = useState(false),
    [drawScope, setDrawScope] = useState("all"),
    [offline, setOffline] = useState(false),
    [detail, setDetail] = useState(null),
    [toast, setToast] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("把選擇困難交給宇宙。");
  const showToast = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const applyState = useCallback((data) => {
    setRestaurants(data.restaurants || []);
    setDiningHistory(data.diningHistory || []);
    setLastVisit(data.lastVisit || null);
  }, []);
  const load = useCallback(async () => {
    try {
      const d = await api();
      applyState(d);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(d));
      } catch {
        // Storage can be unavailable in private browsing.
      }
      setOffline(false);
      setError("");
      return true;
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached?.restaurants) {
          applyState(cached);
          setOffline(true);
          setError("");
          return false;
        }
      } catch {
        // Fall through to the network error.
      }
      setOffline(true);
      setError(e.message);
      return false;
    }
  }, [applyState]);
  // Initial fetch synchronizes this client with the shared Redis state.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void (async () => {
      const online = await load();
      setShowLastVisit(true);
      clearTimeout(lastVisitTimer.current);
      lastVisitTimer.current = setTimeout(() => setShowLastVisit(false), 2000);
      try {
        const voter = localStorage.getItem("whattoeat:voter");
        if (USERS.includes(voter)) {
          setCurrentVoter(voter);
          if (online)
            await api({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "visit", voter }),
            });
        }
      } catch {
        // Browsers may disable local storage; voting still works normally.
      }
    })();
    const clock = setInterval(() => setNow(Date.now()), 60000);
    const refresh = () => void load();
    const sharedStateTimer = setInterval(refresh, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(clock);
      clearInterval(sharedStateTimer);
      clearTimeout(toastTimer.current);
      clearTimeout(lastVisitTimer.current);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);
  const modalOpen = Boolean(
    editing || editingMeal || addingMeal || identityPickerOpen || detail,
  );
  useEffect(() => {
    if (!modalOpen) return;
    const scrollY = window.scrollY;
    const previousFocus = document.activeElement;
    const previous = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    queueMicrotask(() => {
      document
        .querySelector(
          '.edit-modal input, .edit-modal select, .edit-modal button, .edit-modal[tabindex="-1"]',
        )
        ?.focus();
    });
    const closeModal = (event) => {
      if (event.key !== "Escape") return;
      setEditing(null);
      setEditingMeal(null);
      setAddingMeal(false);
      setIdentityPickerOpen(false);
      setPendingVote(null);
      setDetail(null);
    };
    document.addEventListener("keydown", closeModal);
    return () => {
      document.removeEventListener("keydown", closeModal);
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
      previousFocus?.focus?.();
    };
  }, [modalOpen]);
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
    () => selectableRestaurants(restaurants, filters, drawScope, ALL),
    [restaurants, filters, drawScope],
  );
  const zhongheRestaurants = useMemo(
    () => restaurants.filter(isZhongheRestaurant),
    [restaurants],
  );
  const italianLesson = useMemo(
    () => getDailyItalianLesson(new Date(now)),
    [now],
  );
  const update = (key, value) =>
    setFilters((old) => ({ ...old, [key]: value }));
  const decide = () => {
    if (rolling) return;
    if (!matches.length) {
      setResult(null);
      setMessage(
        restaurants.length
          ? "目前沒有符合篩選與抽選範圍的餐廳，請調整條件。"
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
  const mutate = async (payload, errorToastPrefix = "") => {
    if (offline) {
      showToast("目前為離線資料，連線恢復後才能儲存", "error");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await load();
      return response;
    } catch (e) {
      setError(e.message);
      if (errorToastPrefix)
        showToast(`${errorToastPrefix}：${e.message}`, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const addFromMap = async (e) => {
    e.preventDefault();
    if (
      await mutate({ action: "addFromMapUrl", mapUrl: mapLink }, "新增餐廳失敗")
    ) {
      setMapLink("");
      setMessage("已從 Google Maps 連結新增餐廳。");
      showToast("餐廳新增成功");
    }
  };
  const remove = async (x) => {
    if (!confirm(`確定刪除「${x.name}」？票數也會一起刪除。`)) return;
    if (await mutate({ action: "delete", id: x.id })) {
      if (result?.id === x.id) setResult(null);
      setEditing(null);
    }
  };
  const vote = async (restaurant, voter) => {
    if (offline) {
      showToast("目前為離線資料，暫時無法投票", "error");
      return;
    }
    const wasSelected = restaurant.voters?.includes(voter);
    const before = restaurants;
    if (!wasSelected) {
      showToast("還真會犒賞自己");
    } else {
      clearTimeout(toastTimer.current);
      setToast(null);
    }
    try {
      localStorage.setItem("whattoeat:voter", voter);
    } catch {
      // Identity memory is optional.
    }
    setRestaurants((current) =>
      current
        .map((item) => {
          if (item.id !== restaurant.id) return item;
          const voters = wasSelected
            ? (item.voters || []).filter((name) => name !== voter)
            : [...(item.voters || []), voter];
          return { ...item, voters, votes: voters.length };
        })
        .sort(
          (a, b) =>
            b.votes - a.votes || a.name.localeCompare(b.name, "zh-Hant"),
        ),
    );
    const response = await mutate({
      action: "vote",
      id: restaurant.id,
      voter,
    });
    if (response)
      setMessage(
        `${voter}${wasSelected ? "取消投給" : "投給"} ${restaurant.name}。`,
      );
    else setRestaurants(before);
  };
  const chooseIdentity = (user) => {
    try {
      localStorage.setItem("whattoeat:voter", user);
    } catch {
      // Identity still works for this browser session.
    }
    setCurrentVoter(user);
    setIdentityPickerOpen(false);
    const restaurant = pendingVote;
    setPendingVote(null);
    if (restaurant) void vote(restaurant, user);
  };
  const requestIdentity = (restaurant = null) => {
    setPendingVote(restaurant);
    setIdentityPickerOpen(true);
  };
  const saveEdit = async (
    restaurant,
    name,
    categories,
    area,
    price,
    closingTime,
  ) => {
    if (
      await mutate({
        action: "update",
        id: restaurant.id,
        name,
        categories,
        area,
        price: price === "" ? null : Number(price),
        closingTime,
      })
    ) {
      setEditing(null);
      setMessage(`已更新 ${name.trim()} 的餐廳資料。`);
    }
  };
  const saveMeal = async (meal, newDate, restaurantId) => {
    if (
      await mutate({
        action: "updateMeal",
        date: meal.date,
        newDate,
        restaurantId,
      })
    ) {
      setEditingMeal(null);
      setMessage("用餐紀錄已更正。");
    }
  };
  const addMeal = async (date, restaurantId) => {
    if (await mutate({ action: "addMeal", date, restaurantId })) {
      setAddingMeal(false);
      setMessage("用餐紀錄已新增。");
    }
  };
  const removeMeal = async (meal) => {
    if (!confirm(`確定刪除 ${meal.date} 的「${meal.name}」用餐紀錄？`)) return;
    if (await mutate({ action: "deleteMeal", date: meal.date })) {
      setEditingMeal(null);
      setMessage("用餐紀錄已刪除。");
    }
  };
  return (
    <main className="app-shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <nav className="app-nav" aria-label="主要選單">
        <button
          className="home-button"
          type="button"
          onClick={() => {
            setPage("home");
            setMenuOpen(false);
          }}
          aria-label="回到今日投票首頁"
        >
          <Apple size={21} />
        </button>
        <div className="menu-cluster">
          <button
            className="menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
            選單
          </button>
          {menuOpen && (
            <div className="app-menu">
              <button
                className={page === "home" ? "active" : ""}
                onClick={() => {
                  setPage("home");
                  setMenuOpen(false);
                }}
              >
                <Trophy size={18} /> 今日投票
              </button>
              <button
                className={page === "zhonghe" ? "active" : ""}
                onClick={() => {
                  setPage("zhonghe");
                  setMenuOpen(false);
                }}
              >
                <MapPin size={18} /> 中窩美食
              </button>
              <button
                className={page === "history" ? "active" : ""}
                onClick={() => {
                  setPage("history");
                  setMenuOpen(false);
                }}
              >
                <CalendarDays size={18} /> 用餐歷史
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  requestIdentity();
                }}
              >
                <Settings size={18} /> 切換使用者
              </button>
            </div>
          )}
        </div>
      </nav>
      <section className={`hero ${page !== "home" ? "history-hero" : ""}`}>
        <h1>
          {page !== "home" ? (
            page === "history" ? (
              "用餐歷史"
            ) : (
              "中窩美食"
            )
          ) : (
            <>
              今天吃什麼？
              <span className="hero-italian">Cosa mangiamo oggi?</span>
              <small className="hero-pronunciation">摳薩・曼賈莫・歐吉</small>
            </>
          )}
        </h1>
        {page === "home" && (
          <div className="italian-lesson" aria-label="每日一句義大利文">
            <span>每日一句義大利文</span>
            <strong>
              {italianLesson.chinese}（{italianLesson.italian}）
            </strong>
            <small>發音：{italianLesson.pronunciation}</small>
            <small>
              {italianLesson.example}（{italianLesson.examplePronunciation}）—{" "}
              {italianLesson.meaning}
            </small>
          </div>
        )}
      </section>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {offline && (
        <div className="offline-banner" role="status">
          目前為離線資料，尚未同步；連線恢復前無法修改。
        </div>
      )}
      {page === "home" && showLastVisit && lastVisit && (
        <LastVisit visit={lastVisit} now={now} />
      )}
      {toast && (
        <div
          className={`vote-toast ${toast.type === "error" ? "error" : ""}`}
          role="status"
        >
          {toast.message}
        </div>
      )}
      {page === "home" ? (
        <>
          <section className="ranking-spotlight">
            <Ranking
              restaurants={restaurants}
              vote={vote}
              edit={setEditing}
              showDetail={setDetail}
              busy={busy || offline}
              currentVoter={currentVoter}
              chooseVoter={requestIdentity}
              expanded={rankingExpanded}
              setExpanded={setRankingExpanded}
            />
          </section>
          <section className="glass-card">
            <div className="filters">
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
            <fieldset className="draw-scope">
              <legend>抽選範圍</legend>
              <div>
                {Object.entries(DRAW_SCOPES).map(([value, label]) => (
                  <label
                    key={value}
                    className={drawScope === value ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="draw-scope"
                      value={value}
                      checked={drawScope === value}
                      onChange={(event) => setDrawScope(event.target.value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="match-count">
              目前實際可抽 <strong>{matches.length}</strong> 間
            </div>
            <div className="result-stage" aria-live="polite">
              <Result
                result={result}
                rolling={rolling}
                restaurants={restaurants}
                vote={vote}
                busy={busy || offline}
                currentVoter={currentVoter}
                chooseVoter={requestIdentity}
              />
            </div>
            <p className="message">{message}</p>
            <button
              className="decide-button"
              onClick={decide}
              disabled={rolling || busy || !matches.length}
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
            <QuickAdd
              {...{ mapLink, setMapLink, addFromMap }}
              busy={busy || offline}
            />
            <TodayVotes restaurants={restaurants} />
          </section>
        </>
      ) : page === "history" ? (
        <section className="history-page">
          <DiningHistory
            diningHistory={diningHistory}
            editMeal={setEditingMeal}
            addMeal={() => setAddingMeal(true)}
            busy={busy || offline}
          />
        </section>
      ) : (
        <section className="zhonghe-page">
          <ZhongheFood
            restaurants={zhongheRestaurants}
            edit={setEditing}
            showDetail={setDetail}
            busy={busy || offline}
          />
        </section>
      )}
      {editing && (
        <EditRestaurant
          key={editing.id}
          restaurant={editing}
          save={saveEdit}
          remove={remove}
          close={() => setEditing(null)}
          busy={busy || offline}
        />
      )}
      {editingMeal && (
        <MealEditor
          key={editingMeal.date}
          meal={editingMeal}
          restaurants={restaurants}
          save={saveMeal}
          remove={removeMeal}
          close={() => setEditingMeal(null)}
          busy={busy || offline}
        />
      )}
      {addingMeal && (
        <AddMealEditor
          restaurants={restaurants}
          save={addMeal}
          close={() => setAddingMeal(false)}
          busy={busy || offline}
        />
      )}
      {identityPickerOpen && (
        <IdentityPicker
          select={chooseIdentity}
          close={() => {
            setIdentityPickerOpen(false);
            setPendingVote(null);
          }}
        />
      )}
      {detail && (
        <DetailModal restaurant={detail} close={() => setDetail(null)} />
      )}
      <footer>WHAT TO EAT · 所有人共享同一份名單與票數</footer>
    </main>
  );
}
