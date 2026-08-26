import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, MapPin, RotateCcw, Sparkles, Utensils } from 'lucide-react'
import { foods } from './data/foods'

const ALL = '不限'

function Filter({ label, value, options, onChange }) {
  return <label className="filter-group"><span>{label}</span><div className="select-wrap">
    <select value={value} onChange={(e) => onChange(e.target.value)}><option>{ALL}</option>{options.map((item) => <option key={item}>{item}</option>)}</select>
    <ChevronDown size={16} aria-hidden="true" />
  </div></label>
}

export default function App() {
  const [filters, setFilters] = useState({ meal: ALL, budget: ALL, category: ALL, area: ALL })
  const [result, setResult] = useState(null)
  const [isRolling, setIsRolling] = useState(false)
  const [message, setMessage] = useState('把選擇困難交給宇宙。')
  const options = useMemo(() => ({ meal: [...new Set(foods.flatMap((f) => f.meal))], category: [...new Set(foods.map((f) => f.category))], area: [...new Set(foods.map((f) => f.area))] }), [])
  const matches = useMemo(() => foods.filter((food) => (filters.meal === ALL || food.meal.includes(filters.meal)) && (filters.category === ALL || food.category === filters.category) && (filters.area === ALL || food.area === filters.area) && food.price <= (filters.budget === ALL ? Infinity : Number(filters.budget))), [filters])
  const update = (key, value) => setFilters((old) => ({ ...old, [key]: value }))

  const decide = () => {
    if (isRolling) return
    if (!matches.length) { setResult(null); setMessage('這條件太挑了，宇宙也想不到。放寬一點吧！'); return }
    setIsRolling(true); setMessage('命運轉動中…')
    let ticks = 0
    const timer = window.setInterval(() => {
      setResult(matches[Math.floor(Math.random() * matches.length)])
      if (++ticks >= 13) { window.clearInterval(timer); setResult(matches[Math.floor(Math.random() * matches.length)]); setIsRolling(false); setMessage('命運已經決定。就它了！') }
    }, 100)
  }

  return <main className="app-shell">
    <div className="orb orb-one" /><div className="orb orb-two" />
    <motion.section className="hero" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
      <div className="eyebrow"><Sparkles size={15} /> DAILY FOOD ORACLE</div><h1>今天<br className="mobile-break" />吃什麼？</h1><p>別再滑了。設定條件，讓命運替你選一餐。</p>
    </motion.section>
    <motion.section className="glass-card" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12 }}>
      <div className="filters">
        <Filter label="餐別" value={filters.meal} options={options.meal} onChange={(v) => update('meal', v)} />
        <Filter label="預算" value={filters.budget} options={['150', '250', '350', '500']} onChange={(v) => update('budget', v)} />
        <Filter label="料理" value={filters.category} options={options.category} onChange={(v) => update('category', v)} />
        <Filter label="地區" value={filters.area} options={options.area} onChange={(v) => update('area', v)} />
      </div>
      <div className="match-count">目前有 <strong>{matches.length}</strong> 個命運候選</div>
      <div className="result-stage" aria-live="polite"><AnimatePresence mode="wait">
        {result ? <motion.div key={`${result.name}-${isRolling}`} className={`result-card ${isRolling ? '' : 'revealed'}`} initial={{ opacity: 0, y: 16, scale: .9 }} animate={{ opacity: 1, y: 0, scale: isRolling ? .96 : 1 }} exit={{ opacity: 0, y: -12 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
          <span className="result-label">{isRolling ? '搜尋美味中' : 'THE ONE'}</span><h2>{result.name}</h2>
          <div className="result-meta"><span><Utensils size={15} />{result.category}</span><span><MapPin size={15} />{result.area}</span><span>約 NT$ {result.price}</span></div>
        </motion.div> : <motion.div className="empty-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Utensils size={34} /><span>你的下一餐，正在平行宇宙等你</span></motion.div>}
      </AnimatePresence></div>
      <p className="message">{message}</p>
      <motion.button className="decide-button" onClick={decide} disabled={isRolling} whileHover={{ scale: 1.025 }} whileTap={{ scale: .96 }}>
        {result && !isRolling ? <RotateCcw size={21} /> : <Sparkles size={21} />}{isRolling ? '正在召喚命運…' : result ? '又反悔？再抽一次' : '幫我決定'}
      </motion.button>
    </motion.section>
    <footer>WHAT TO EAT · 吃飽才有力氣煩惱</footer>
  </main>
}
