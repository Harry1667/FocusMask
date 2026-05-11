const DAYS = ['日', '一', '二', '三', '四', '五', '六']
const MODES = ['focus', 'sleep', 'immersion', 'pomodoro']

let settings = {}

// ─── 初始化 ───────────────────────────────────────────────
async function init() {
  const sync = await chrome.storage.sync.get(['modes', 'notifications'])
  settings = {
    modes: sync.modes || {},
    notifications: sync.notifications !== false
  }

  loadFocusTab()
  loadSleepTab()
  loadImmersionTab()
  loadPomodoroTab()
  loadGeneralTab()
  buildDayPicker()
  bindNav()
  bindSave()
}

// ─── Tab 導航 ─────────────────────────────────────────────
function bindNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      item.classList.add('active')
      document.getElementById(`tab-${item.dataset.tab}`)?.classList.add('active')
    })
  })
}

// ─── 各 tab 資料載入 ──────────────────────────────────────
function loadFocusTab() {
  const m = settings.modes.focus || {}
  setValue('focus-duration', m.defaultDuration ?? 60)
  renderSiteList('focus', m.allowedSites || [])
}

function loadSleepTab() {
  const m = settings.modes.sleep || {}
  setValue('sleep-enabled', m.enabled ?? false, 'checked')
  setValue('sleep-start', m.schedule?.start ?? '23:00')
  setValue('sleep-end', m.schedule?.end ?? '06:00')
  setValue('sleep-password', m.lockPassword ?? '')
  renderSiteList('sleep', m.allowedSites || [])
  // days 由 buildDayPicker 處理
}

function loadImmersionTab() {
  const m = settings.modes.immersion || {}
  renderSiteList('immersion', m.allowedSites || [])
}

function loadPomodoroTab() {
  const m = settings.modes.pomodoro || {}
  setValue('pomo-work',   m.workDuration     ?? 25)
  setValue('pomo-short',  m.shortBreak       ?? 5)
  setValue('pomo-long',   m.longBreak        ?? 15)
  setValue('pomo-cycles', m.cyclesBeforeLong ?? 4)
  renderSiteList('pomodoro', m.allowedSites || [])
}

function loadGeneralTab() {
  setValue('notif-enabled', settings.notifications !== false, 'checked')
}

// ─── 星期選擇器 ───────────────────────────────────────────
function buildDayPicker() {
  const container = document.getElementById('sleep-days')
  const activeDays = settings.modes.sleep?.schedule?.days ?? [0,1,2,3,4,5,6]
  container.innerHTML = ''
  DAYS.forEach((label, i) => {
    const btn = document.createElement('button')
    btn.className = 'day-btn' + (activeDays.includes(i) ? ' on' : '')
    btn.textContent = label
    btn.dataset.day = i
    btn.addEventListener('click', () => btn.classList.toggle('on'))
    container.appendChild(btn)
  })
}

function getSelectedDays() {
  return [...document.querySelectorAll('.day-btn.on')].map(b => Number(b.dataset.day))
}

// ─── 站台清單 ─────────────────────────────────────────────
function renderSiteList(mode, sites) {
  const ul = document.getElementById(`${mode}-site-list`)
  ul.innerHTML = ''
  sites.forEach(site => ul.appendChild(createSiteItem(mode, site)))

  document.getElementById(`${mode}-site-add`)?.addEventListener('click', () => {
    const input = document.getElementById(`${mode}-site-input`)
    const val = input.value.replace(/^https?:\/\//, '').split('/')[0].trim()
    if (!val) return
    if ([...ul.querySelectorAll('.site-domain')].some(el => el.textContent === val)) {
      input.classList.add('input-error')
      const prev = input.placeholder
      input.placeholder = `${val} 已在清單中`
      input.value = ''
      setTimeout(() => { input.classList.remove('input-error'); input.placeholder = prev }, 1800)
      return
    }
    ul.appendChild(createSiteItem(mode, val))
    input.value = ''
  })

  // Enter 新增
  document.getElementById(`${mode}-site-input`)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById(`${mode}-site-add`)?.click()
  })
}

function createSiteItem(mode, site) {
  const li = document.createElement('li')
  li.innerHTML = `<span class="site-domain">${site}</span><button title="刪除">×</button>`
  li.querySelector('button').addEventListener('click', () => li.remove())
  return li
}

function getSiteList(mode) {
  return [...document.querySelectorAll(`#${mode}-site-list .site-domain`)].map(el => el.textContent)
}

// ─── 儲存 ─────────────────────────────────────────────────
function bindSave() {
  document.getElementById('btn-save').addEventListener('click', save)
  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (!confirm('確定要重置所有設定？')) return
    await chrome.storage.sync.clear()
    await chrome.storage.local.set({ activeModes: [], activeModesData: {} })
    location.reload()
  })
}

async function save() {
  const btn = document.getElementById('btn-save')
  const msg = document.getElementById('save-msg')
  btn.disabled = true
  btn.textContent = '儲存中...'
  msg.textContent = ''

  const updated = {
    modes: {
      focus: {
        allowedSites: getSiteList('focus'),
        defaultDuration: parseInt(getValue('focus-duration')) || 0
      },
      sleep: {
        allowedSites: getSiteList('sleep'),
        enabled: getValue('sleep-enabled', 'checked'),
        schedule: {
          start: getValue('sleep-start') || '23:00',
          end:   getValue('sleep-end')   || '06:00',
          days:  getSelectedDays()
        },
        lockPassword: getValue('sleep-password') || ''
      },
      immersion: {
        allowedSites: getSiteList('immersion')
      },
      pomodoro: {
        allowedSites:    getSiteList('pomodoro'),
        workDuration:    parseInt(getValue('pomo-work'))   || 25,
        shortBreak:      parseInt(getValue('pomo-short'))  || 5,
        longBreak:       parseInt(getValue('pomo-long'))   || 15,
        cyclesBeforeLong:parseInt(getValue('pomo-cycles')) || 4
      }
    },
    notifications: getValue('notif-enabled', 'checked')
  }

  try {
    await chrome.storage.sync.set(updated)
    settings = updated
    msg.style.color = '#4a4'
    msg.textContent = '✓ 已儲存'
  } catch (e) {
    msg.style.color = '#f55'
    msg.textContent = '❌ 儲存失敗（可能超出配額）'
  } finally {
    btn.disabled = false
    btn.textContent = '儲存設定'
    setTimeout(() => { msg.textContent = '' }, 2500)
  }
}

// ─── 工具函式 ─────────────────────────────────────────────
function getValue(id, prop = 'value') {
  const el = document.getElementById(id)
  return el ? el[prop] : null
}

function setValue(id, val, prop = 'value') {
  const el = document.getElementById(id)
  if (el) el[prop] = val
}

init()
