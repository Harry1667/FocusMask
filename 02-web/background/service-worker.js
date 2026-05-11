const DEFAULT_SETTINGS = {
  modes: {
    focus:     { allowedSites: [], defaultDuration: 0 },
    sleep:     { allowedSites: [], schedule: { start: '23:00', end: '06:00', days: [0,1,2,3,4,5,6] }, enabled: false, lockPassword: '' },
    immersion: { allowedSites: [] },
    pomodoro:  { allowedSites: [], workDuration: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLong: 4 }
  },
  notifications: true
}

// ─── 初始化 ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get('modes')
  if (!existing.modes) await chrome.storage.sync.set(DEFAULT_SETTINGS)
  await chrome.storage.local.set({ activeModes: [], activeModesData: {} })
  chrome.alarms.create('sleepCheck', { periodInMinutes: 1 })
})

chrome.runtime.onStartup.addListener(async () => {
  await recoverActiveSessions()
  await checkSleepMode()
  chrome.alarms.create('sleepCheck', { periodInMinutes: 1 })
})

// 瀏覽器重啟後恢復 focus / pomodoro session
async function recoverActiveSessions() {
  const { activeModes = [], activeModesData = {} } = await chrome.storage.local.get(['activeModes', 'activeModesData'])
  const now = Date.now()

  for (const mode of [...activeModes]) {
    const data = activeModesData[mode] || {}

    if (mode === 'focus') {
      if (data.endTime && data.endTime <= now) {
        await stopMode('focus')
        notify('專注結束', '瀏覽器關閉期間，本次專注時間已結束')
      } else if (data.endTime) {
        const remaining = (data.endTime - now) / 60000
        chrome.alarms.create('focusEnd', { delayInMinutes: remaining })
      }
    }

    if (mode === 'pomodoro') {
      if (data.endTime && data.endTime <= now) {
        // 離線期間番茄鐘已結束，直接推進到下一階段
        await handlePomodoroTick()
      } else if (data.endTime) {
        const remaining = (data.endTime - now) / 60000
        chrome.alarms.create('pomodoroTick', { delayInMinutes: remaining })
      }
    }
  }
}

// ─── 鬧鐘 ────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sleepCheck')   await checkSleepMode()
  if (alarm.name === 'focusEnd')     { await stopMode('focus'); notify('專注結束', '你已完成本次專注時間！') }
  if (alarm.name === 'pomodoroTick') await handlePomodoroTick()
})

// ─── 睡眠排程 ─────────────────────────────────────────────
async function checkSleepMode() {
  const { modes } = await chrome.storage.sync.get('modes')
  const sleep = modes?.sleep
  if (!sleep?.enabled) return

  const { activeModes = [] } = await chrome.storage.local.get('activeModes')
  const shouldSleep = isInSleepTime(sleep.schedule)

  if (shouldSleep && !activeModes.includes('sleep')) await startMode('sleep', {})
  else if (!shouldSleep && activeModes.includes('sleep'))  await stopMode('sleep')
}

function isInSleepTime({ start, end, days }) {
  const now = new Date()
  if (!days.includes(now.getDay())) return false
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const cur = now.getHours() * 60 + now.getMinutes()
  const s = sh * 60 + sm, e = eh * 60 + em
  return s > e ? (cur >= s || cur < e) : (cur >= s && cur < e)
}

// ─── 啟動模式（可並行） ───────────────────────────────────
async function startMode(mode, data = {}) {
  const [local, sync] = await Promise.all([
    chrome.storage.local.get(['activeModes', 'activeModesData']),
    chrome.storage.sync.get('modes')
  ])
  let { activeModes = [], activeModesData = {} } = local
  const { modes } = sync

  // 同模式不重複啟動
  if (activeModes.includes(mode)) return

  const modeData = { startTime: Date.now(), ...data }

  if (mode === 'focus') {
    const duration = data.duration ?? modes?.focus?.defaultDuration ?? 0
    if (duration > 0) {
      chrome.alarms.create('focusEnd', { delayInMinutes: duration })
      modeData.duration = duration
      modeData.endTime = Date.now() + duration * 60000
    }
  }

  if (mode === 'pomodoro') {
    const s = modes?.pomodoro || {}
    modeData.phase = 'work'
    modeData.cycleCount = 0
    modeData.workDuration = s.workDuration ?? 25
    modeData.shortBreak   = s.shortBreak   ?? 5
    modeData.longBreak    = s.longBreak    ?? 15
    modeData.cyclesBeforeLong = s.cyclesBeforeLong ?? 4
    modeData.endTime = Date.now() + modeData.workDuration * 60000
    chrome.alarms.create('pomodoroTick', { delayInMinutes: modeData.workDuration })
  }

  await chrome.storage.local.set({
    activeModes: [...activeModes, mode],
    activeModesData: { ...activeModesData, [mode]: modeData }
  })
}

// ─── 停止單一模式 ─────────────────────────────────────────
async function stopMode(mode) {
  const { activeModes = [], activeModesData = {} } = await chrome.storage.local.get(['activeModes', 'activeModesData'])

  if (mode === 'focus')    await chrome.alarms.clear('focusEnd')
  if (mode === 'pomodoro') await chrome.alarms.clear('pomodoroTick')

  const newData = { ...activeModesData }
  delete newData[mode]

  await chrome.storage.local.set({
    activeModes: activeModes.filter(m => m !== mode),
    activeModesData: newData
  })
}

// ─── 番茄鐘切換 ───────────────────────────────────────────
async function handlePomodoroTick() {
  const { activeModes = [], activeModesData = {} } = await chrome.storage.local.get(['activeModes', 'activeModesData'])
  if (!activeModes.includes('pomodoro')) return

  const data = { ...activeModesData.pomodoro }

  if (data.phase === 'work') {
    data.cycleCount = (data.cycleCount || 0) + 1
    const isLong = data.cycleCount % data.cyclesBeforeLong === 0
    data.phase = isLong ? 'longBreak' : 'shortBreak'
    const dur = isLong ? data.longBreak : data.shortBreak
    data.endTime = Date.now() + dur * 60000
    chrome.alarms.create('pomodoroTick', { delayInMinutes: dur })
    notify('番茄鐘', isLong ? `完成 ${data.cycleCount} 個番茄！長休息 ${data.longBreak} 分鐘` : '休息一下！☕')
  } else {
    data.phase = 'work'
    data.endTime = Date.now() + data.workDuration * 60000
    chrome.alarms.create('pomodoroTick', { delayInMinutes: data.workDuration })
    notify('番茄鐘', '休息結束，開始下一個番茄！🍅')
  }

  await chrome.storage.local.set({ activeModesData: { ...activeModesData, pomodoro: data } })
}

// ─── 通知 ─────────────────────────────────────────────────
async function notify(title, message) {
  const { notifications } = await chrome.storage.sync.get('notifications')
  if (notifications === false) return
  chrome.notifications.create(`fm_${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message
  })
}

// ─── 訊息處理 ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }))
  return true
})

async function handle(msg) {
  switch (msg.type) {
    case 'START_MODE': await startMode(msg.mode, msg.data || {}); return { ok: true }
    case 'STOP_MODE':  await stopMode(msg.mode);                  return { ok: true }
    default:           return { error: 'unknown' }
  }
}
