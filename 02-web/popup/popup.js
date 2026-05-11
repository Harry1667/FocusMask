let state = { activeModes: [], activeModesData: {}, modes: {} }
let selectedMode = null
let timerInterval = null

const $ = id => document.getElementById(id)

// ─── 初始化 ───────────────────────────────────────────────
async function init() {
  await loadState()
  render()
  bindEvents()
  startPolling()
}

async function loadState() {
  const [local, sync] = await Promise.all([
    chrome.storage.local.get(['activeModes', 'activeModesData']),
    chrome.storage.sync.get('modes')
  ])
  state = {
    activeModes:     local.activeModes     || [],
    activeModesData: local.activeModesData || {},
    modes:           sync.modes            || {}
  }
}

function startPolling() {
  clearInterval(timerInterval)
  timerInterval = setInterval(updateTimers, 1000)
}

// ─── 渲染 ─────────────────────────────────────────────────
function render() {
  renderActiveList()
  renderModeGrid()
}

function renderActiveList() {
  const list = $('active-list')
  const { activeModes, activeModesData } = state

  if (activeModes.length === 0) {
    list.classList.add('hidden')
    list.innerHTML = ''
    $('badge').textContent = '閒置'
    $('badge').classList.remove('active')
    return
  }

  $('badge').textContent = `${activeModes.length} 個模式運行中`
  $('badge').classList.add('active')
  list.classList.remove('hidden')

  list.innerHTML = activeModes.map(mode => {
    const data = activeModesData[mode] || {}
    return `
      <div class="active-card" data-mode="${mode}">
        <div class="active-card-left">
          <div class="active-card-label">${LABELS[mode]}</div>
          <div class="active-card-sub">${subText(mode, data)}</div>
        </div>
        <div class="active-card-timer" id="timer-${mode}">${timerText(data)}</div>
        <button class="active-card-stop" data-mode="${mode}">停止</button>
      </div>
    `
  }).join('')

  list.querySelectorAll('.active-card-stop').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode
      if (mode === 'sleep') {
        const { modes } = await chrome.storage.sync.get('modes')
        const pwd = modes?.sleep?.lockPassword
        if (pwd) { showPasswordPrompt(btn, mode, pwd); return }
      }
      await chrome.runtime.sendMessage({ type: 'STOP_MODE', mode })
      await loadState()
      render()
    })
  })
}

function renderModeGrid() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const mode = btn.dataset.mode
    const isRunning = state.activeModes.includes(mode)
    btn.classList.toggle('running', isRunning)
    btn.title = isRunning ? '點擊停止' : ''
  })
}

function updateTimers() {
  state.activeModes.forEach(mode => {
    const el = $(`timer-${mode}`)
    if (el) el.textContent = timerText(state.activeModesData[mode] || {})
  })
}

// ─── 事件 ─────────────────────────────────────────────────
function bindEvents() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => onModeClick(btn.dataset.mode))
  })

  $('btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage())

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && (changes.activeModes || changes.activeModesData)) {
      await loadState()
      render()
    }
  })
}

function onModeClick(mode) {
  // 已啟動 → 停止
  if (state.activeModes.includes(mode)) {
    chrome.runtime.sendMessage({ type: 'STOP_MODE', mode }).then(async () => {
      await loadState()
      render()
    })
    closeQuickPanel()
    return
  }

  // 切換快速設定面板
  if (selectedMode === mode) {
    closeQuickPanel()
    return
  }
  selectedMode = mode
  renderQuickPanel(mode)
}

function closeQuickPanel() {
  selectedMode = null
  $('quick-panel').classList.add('hidden')
}

function renderQuickPanel(mode) {
  const panel = $('quick-panel')
  // 用 cloneNode 替換 panel 確保舊 listener 完全移除
  const fresh = panel.cloneNode(false)
  panel.parentNode.replaceChild(fresh, panel)
  fresh.id = 'quick-panel'
  fresh.classList.remove('hidden')
  fresh.innerHTML = quickHTML(mode)
  fresh.querySelector('#qs-start')?.addEventListener('click', () => startMode(mode))
  fresh.querySelector('input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') startMode(mode)
    if (e.key === 'Escape') closeQuickPanel()
  })
}

function quickHTML(mode) {
  const m = state.modes
  if (mode === 'focus') {
    const def = m.focus?.defaultDuration || 60
    return `
      <div class="qs-row">
        <label>時長（0 = 無限）</label>
        <input type="number" id="qs-duration" value="${def}" min="0" max="480">
        <span>分</span>
      </div>
      <button class="btn-start" id="qs-start">開始專注</button>
    `
  }
  if (mode === 'sleep') {
    const s = m.sleep?.schedule || {}
    return `
      <div class="qs-note">排程：${s.start || '--:--'} ～ ${s.end || '--:--'}<br>詳細設定請至設定頁面</div>
      <button class="btn-start" id="qs-start">立即啟動睡眠遮罩</button>
    `
  }
  if (mode === 'immersion') {
    return `
      <div class="qs-row">
        <label>沉浸網域</label>
        <input type="text" id="qs-domain" placeholder="例：notion.so">
      </div>
      <button class="btn-start" id="qs-start">開始沉浸</button>
    `
  }
  if (mode === 'pomodoro') {
    const s = m.pomodoro || {}
    return `
      <div class="qs-note">工作 ${s.workDuration || 25} 分 ／ 短休 ${s.shortBreak || 5} 分 ／ 長休 ${s.longBreak || 15} 分</div>
      <button class="btn-start" id="qs-start">開始番茄鐘</button>
    `
  }
  return ''
}

async function startMode(mode) {
  const data = {}
  if (mode === 'focus') {
    data.duration = parseInt($('qs-duration')?.value || 0)
  }
  if (mode === 'immersion') {
    const domain = $('qs-domain')?.value?.trim()
    if (!domain) { $('qs-domain')?.focus(); return }
    data.targetDomain = domain.replace(/^https?:\/\//, '').split('/')[0]
  }

  await chrome.runtime.sendMessage({ type: 'START_MODE', mode, data })
  closeQuickPanel()
  await loadState()
  render()
}

// ─── 睡眠密碼驗證 ────────────────────────────────────────
function showPasswordPrompt(stopBtn, mode, correctPwd) {
  // 避免重複插入
  if (stopBtn.closest('.active-card').querySelector('.pwd-row')) return

  const card = stopBtn.closest('.active-card')
  const row = document.createElement('div')
  row.className = 'pwd-row'
  row.innerHTML = `
    <input class="pwd-input" type="password" placeholder="輸入解鎖密碼">
    <button class="pwd-ok">確認</button>
    <button class="pwd-cancel">取消</button>
  `
  card.appendChild(row)

  const input = row.querySelector('.pwd-input')
  input.focus()

  async function tryStop() {
    if (input.value === correctPwd) {
      await chrome.runtime.sendMessage({ type: 'STOP_MODE', mode })
      await loadState()
      render()
    } else {
      input.value = ''
      input.placeholder = '密碼錯誤，請重試'
      input.classList.add('error')
      setTimeout(() => { input.classList.remove('error'); input.placeholder = '輸入解鎖密碼' }, 1500)
    }
  }

  row.querySelector('.pwd-ok').addEventListener('click', tryStop)
  row.querySelector('.pwd-cancel').addEventListener('click', () => row.remove())
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryStop() })
}

// ─── 工具 ─────────────────────────────────────────────────
const LABELS = {
  focus:     '🎯 專注模式',
  sleep:     '🌙 睡眠模式',
  immersion: '🔒 沉浸模式',
  pomodoro:  '🍅 番茄鐘'
}

function subText(mode, data) {
  if (mode === 'immersion') return data.targetDomain ? `鎖定：${data.targetDomain}` : ''
  if (mode === 'pomodoro')  return data.phase === 'work' ? '工作中' : '休息中'
  if (mode === 'sleep')     return '排程中'
  return ''
}

function timerText(data) {
  if (data?.endTime) {
    const s = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000))
    return fmt(s)
  }
  if (data?.startTime) {
    const s = Math.floor((Date.now() - data.startTime) / 1000)
    return fmt(s)
  }
  return ''
}

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

init()
