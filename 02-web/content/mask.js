// FocusMask content script

let maskHost = null
let shadowRoot = null
let timerInterval = null

// ─── 白名單判斷 ───────────────────────────────────────────
function isAllowed(hostname, mode, modeData, modes) {
  if (mode === 'immersion') {
    const target = modeData?.targetDomain || ''
    if (target && (hostname === target || hostname.endsWith('.' + target))) return true
  }
  const allowed = modes?.[mode]?.allowedSites || []
  return allowed.some(site => {
    const d = site.replace(/^https?:\/\//, '').split('/')[0].trim()
    return hostname === d || hostname.endsWith('.' + d)
  })
}

// ─── 主要檢查邏輯 ─────────────────────────────────────────
async function checkMask() {
  try {
    const url = location.href
    if (!url.startsWith('http')) return

    const [local, sync] = await Promise.all([
      chrome.storage.local.get(['activeModes', 'activeModesData']),
      chrome.storage.sync.get('modes')
    ])

    const { activeModes = [], activeModesData = {} } = local
    const { modes } = sync

    if (activeModes.length === 0) { hideMask(); return }

    const hostname = new URL(url).hostname

    // 被任一模式封鎖就顯示遮罩
    const blockedBy = activeModes.filter(m => !isAllowed(hostname, m, activeModesData[m], modes))
    if (blockedBy.length === 0) { hideMask(); return }

    // 非睡眠模式優先顯示（睡眠是背景模式）
    const primary = blockedBy.find(m => m !== 'sleep') || blockedBy[0]
    showMask(primary, activeModesData[primary] || {}, blockedBy)
  } catch (_) {}
}

// ─── 遮罩 DOM ─────────────────────────────────────────────
function showMask(primaryMode, data, allBlockingModes) {
  if (!maskHost) {
    maskHost = document.createElement('div')
    maskHost.id = '__focusmask__'
    Object.assign(maskHost.style, {
      all: 'initial', position: 'fixed', inset: '0',
      zIndex: '2147483647', display: 'block'
    })
    ;(document.documentElement || document.body).appendChild(maskHost)

    shadowRoot = maskHost.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = CSS
    shadowRoot.appendChild(style)
    const container = document.createElement('div')
    container.className = 'mask'
    shadowRoot.appendChild(container)
  }

  maskHost.style.display = 'block'
  updateContent(primaryMode, data, allBlockingModes)
}

function hideMask() {
  clearInterval(timerInterval)
  timerInterval = null
  if (maskHost) maskHost.style.display = 'none'
}

function updateContent(primary, data, allModes) {
  if (!shadowRoot) return
  const container = shadowRoot.querySelector('.mask')
  if (!container) return

  container.innerHTML = buildHTML(primary, data, allModes)

  // 停止按鈕：只停止主要模式（睡眠模式不顯示停止鈕）
  container.querySelector('#fm-stop')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_MODE', mode: primary })
  })

  clearInterval(timerInterval)
  if (data?.endTime || data?.startTime) {
    timerInterval = setInterval(() => {
      const el = shadowRoot?.querySelector('#fm-timer')
      if (el) el.textContent = timerText(data)
    }, 1000)
  }
}

// ─── HTML ─────────────────────────────────────────────────
const LABELS = {
  focus:     '🎯 專注模式',
  sleep:     '🌙 睡眠模式',
  immersion: '🔒 沉浸模式',
  pomodoro:  '🍅 番茄鐘'
}

const MSGS = {
  focus:     '保持專注，你做得到',
  sleep:     '好好休息，明天再戰',
  immersion: '深度沉浸，保持專注',
  pomodoro:  (d) => d?.phase === 'work' ? '專注工作中' : '☕ 休息時間'
}

function buildHTML(primary, data, allModes) {
  const label = LABELS[primary] || primary
  const msg   = typeof MSGS[primary] === 'function' ? MSGS[primary](data) : (MSGS[primary] || '')
  const timer = timerText(data)
  const showStop = primary !== 'sleep'

  // 若同時有其他模式（如睡眠並行），顯示小標籤
  const others = allModes.filter(m => m !== primary)
  const otherTags = others.map(m => `<span class="tag">${LABELS[m]}</span>`).join('')

  return `
    <p class="label">${label}</p>
    <p class="msg">${msg}</p>
    ${timer ? `<p class="timer" id="fm-timer">${timer}</p>` : ''}
    ${otherTags ? `<div class="tags">${otherTags}</div>` : ''}
    ${showStop ? `<button id="fm-stop">停止模式</button>` : ''}
  `
}

function timerText(data) {
  if (!data) return ''
  if (data.endTime) {
    const s = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000))
    return fmt(s) + ' 剩餘'
  }
  if (data.startTime) {
    const s = Math.floor((Date.now() - data.startTime) / 1000)
    return fmt(s) + ' 已過'
  }
  return ''
}

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ─── CSS ──────────────────────────────────────────────────
const CSS = `
  :host { all: initial; }
  .mask {
    position: fixed; inset: 0; background: #000;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #fff; animation: fm-in .3s ease;
  }
  @keyframes fm-in { from { opacity: 0 } to { opacity: 1 } }
  .label { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px; }
  .msg   { margin: 0; font-size: 15px; color: #555; }
  .timer { margin: 8px 0 0; font-size: 56px; font-weight: 200;
           font-variant-numeric: tabular-nums; letter-spacing: 6px; }
  .tags  { display: flex; gap: 8px; margin-top: 4px; }
  .tag   { font-size: 11px; padding: 3px 10px; border: 1px solid #222;
           border-radius: 20px; color: #444; }
  #fm-stop {
    margin-top: 20px; padding: 10px 28px;
    background: transparent; border: 1px solid #333; border-radius: 8px;
    color: #555; font-size: 13px; cursor: pointer; transition: all .2s;
  }
  #fm-stop:hover { border-color: #fff; color: #fff; }
`

// ─── 監聽 ─────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.activeModes || changes.activeModesData)) checkMask()
})

// debounce：避免 React/Vue 頁面大量 DOM mutation 造成重複呼叫
let lastUrl = location.href
let urlDebounce = null
new MutationObserver(() => {
  if (location.href === lastUrl) return
  lastUrl = location.href
  clearTimeout(urlDebounce)
  urlDebounce = setTimeout(checkMask, 80)
}).observe(document, { subtree: true, childList: true })

window.addEventListener('popstate', checkMask)

checkMask()
