// 用 Node.js 內建模組產生 PNG 圖示，不需要任何 npm 套件
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

// ─── PNG 工具 ──────────────────────────────────────────────
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const t   = Buffer.from(type)
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length, 0)
  const crcSrc = Buffer.concat([t, data])
  const crc = Buffer.allocUnsafe(4)
  crc.writeUInt32BE(crc32(crcSrc), 0)
  return Buffer.concat([len, t, data, crc])
}

function makePNG(size, pixel) {
  // pixel(x, y, size) → [r, g, b, a]
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6   // RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0

  const rows = []
  for (let y = 0; y < size; y++) {
    rows.push(0) // filter None
    for (let x = 0; x < size; x++) rows.push(...pixel(x, y, size))
  }

  const raw  = Buffer.from(rows)
  const idat = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ─── 圖示設計：黑底白色遮罩臉 ────────────────────────────
function iconPixel(x, y, size) {
  const cx = size / 2, cy = size / 2
  const r  = size * 0.42
  const dx = x - cx, dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // 圓形外 → 透明
  if (dist > r) return [0, 0, 0, 0]

  // 細邊框
  if (dist > r - 1.5) return [80, 80, 80, 200]

  // 正規化座標
  const nx = dx / r, ny = dy / r

  // 眼孔（橢圓）
  const eyeY = ny + 0.08
  const eye1 = Math.sqrt(((nx + 0.28) / 0.18) ** 2 + (eyeY / 0.22) ** 2)
  const eye2 = Math.sqrt(((nx - 0.28) / 0.18) ** 2 + (eyeY / 0.22) ** 2)
  if (eye1 < 1 || eye2 < 1) return [20, 20, 20, 255]

  // 嘴巴弧線
  if (ny > 0.35 && ny < 0.52 && Math.abs(nx) < 0.35) {
    const mouthDist = Math.abs(ny - (0.38 + nx * nx * 0.4))
    if (mouthDist < 0.06 * (size > 32 ? 1 : 1.5)) return [20, 20, 20, 255]
  }

  // 遮罩主體：上半白、下半略暗（帶層次感）
  const brightness = Math.round(220 + ny * 25)
  return [brightness, brightness, brightness, 255]
}

// ─── 輸出 ─────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [16, 32, 48, 128]) {
  const buf  = makePNG(size, iconPixel)
  const file = path.join(outDir, `icon${size}.png`)
  fs.writeFileSync(file, buf)
  console.log(`✓ icon${size}.png`)
}

console.log('\n完成！圖示已儲存至 icons/')
