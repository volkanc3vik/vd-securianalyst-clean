# THEME SYSTEM REFACTOR — Audit Raporu & Phase A Teslimi

**Sürüm:** v62 · **Tarih:** 31.05.2026 · **Kapsam:** sadece tema/CSS (JS mantığına dokunulmadı)

---

## 1) THEME AUDIT — Bulgular

### 1.1 Dosya başına renk yoğunluğu (hardcode = sorun kaynağı)

En çok hardcode + mor içerenler (yeni temaya geçmeyen bölümler tam bunlar):

| Dosya | hex | rgba | **mor** | var() | Durum |
|---|---:|---:|---:|---:|---|
| archive.css | 113 | 93 | **12** | 268 | Ağır hardcode + mor |
| mobile.css | 22 | 195 | **13** | 196 | Çok arka plan + mor |
| theme-v2.css | 29 | 192 | **13** | 175 | Kısmen tokenli, mor kalmış |
| premium-funnel.css | 41 | 38 | 6 | 36 | Hardcode ağırlıklı |
| premium-lock.css | 35 | 45 | 0 | 13 | Hardcode ağırlıklı |
| admin-codes.css | 31 | 42 | 3 | 0 | **Hiç token yok** |
| teaser.css | 28 | 14 | 3 | 26 | Orta |
| login.css | 27 | 74 | 4 | 22 | Orta |
| intelligence.css | 1 | 69 | 8 | 110 | İyi tokenli (mor var) |

İyi tokenli (dokunmaya gerek az): `terminal.css`, `telegram-ui.css`, `futures.css`,
`notifications.css`, `ai-engine.css`.

### 1.2 Token isim uzayı parçalanması (asıl kök sebep)

Sitede **4 ayrı** renk değişken ailesi paralel kullanılıyor:

- **legacy:** `--cyan`(94×) `--purple`(56×) `--green`(277×) `--red`(219×) `--yellow`(108×) `--orange`(103×) `--text/2/3`(87/90/356×) `--border`(70×) `--glass`(21×)
- **theme-v2:** `--v4-cyan`(48×) `--v4-text/border/...`
- **access:** `--ac-cyan`(17×)
- **neural (benim):** `--nx-*`

Tek tema yokmuş gibi davranıyor çünkü bu aileler birbirinden habersiz.

### 1.3 `:root` çoklu tanımı (load-order kırılganlığı)

`:root` **7 yerde** tanımlı: `academy.css`, `archive.css`, `main.css`, `theme-v2.css`,
`track-record.css`, `theme-neural.css`, **index.html inline**. Hangisi sonra yüklenirse
o kazanıyordu → "bazısı değişiyor bazısı kalıyor"un teknik sebebi.

### 1.4 Hardcode mor değerleri (toplam 23 örnek → Phase B)

`#9d7dfa`(8) · `#a78bfa`(5) · `#627eea`(4, ETH) · `#b39dfa`(3) · `#8b5cf6`(2) · `#833ab4`(1)

### 1.5 JS inline-style üretimi (az, yönetilebilir)

`ai-narrator.js`(1) · `futures-panel.js`(2) · `archive-admin.js`(2) + premium lock dosyaları.
Çoğu durum class ile çözülebilir; Phase D'de ele alınacak.

---

## 2) PHASE A — Yapılanlar (bu teslim)

### 2.1 Yeni merkezi dosya: `styles/theme.css`
Senin istediğin semantik token seti: `--bg-main --bg-panel --bg-card --text-main
--text-muted --accent --accent-2 --border --success --warning --danger --glow --shadow
--radius-card` (+ `--nx-*` ailesi buradan besleniyor).

### 2.2 Tüm eski isim uzayları merkeze bağlandı
`theme.css` içinde `html:root { --cyan/--purple/--green/--v4-cyan/--ac-cyan ... → semantik
token }`. **`html:root` seçicisi (specificity 0,1,1)** dağınık `:root` (0,1,0) tanımlarını
**yükleme sırasından bağımsız EZER.** Yani:
- `var(--purple)` kullanan 56 yer → artık cyan (mor merkezi olarak öldü)
- `var(--cyan)` 94, `var(--green)` 277, `var(--v4-cyan)` 48 … hepsi tek dosyadan.

**Kanıt:** `v62_token_proof.png` — `var(--purple)` cyan döndü, `var(--v4-cyan)` bağlı,
yalnızca **hardcode `#9d7dfa` hâlâ mor** (Phase B hedefi olduğunu kanıtlıyor).

### 2.3 Load order düzeltmesi
`theme.css` 7 sayfanın tümünde **en önce** yüklenecek şekilde eklendi
(index, archive, timeline, academy, premium, translator, track-record).
Component skin (`theme-neural.css` — scanline, kart yapıları) **en sonda** kalıyor.
`theme-neural.css`'in kendi `:root` bloğu kaldırıldı (artık tek kaynak `theme.css`).

### 2.4 Önceki tur düzeltmeleri de pakette
- **Parlak çubuk** (`.regime-bar`) onarıldı — ilerleme çubuğu değil satır; çocuklarına blok arka plan verme hatası giderildi.
- `.opp` yön kartları + `.ti-*` istihbarat terminali temalandı.
- `.mkt-card` (ETH moru dahil) düzeltmesi.

---

## 3) HÂLÂ KALAN ESKİ STİLLER (Phase B–E hedefleri)

| Öncelik | Dosya/alan | İş |
|---|---|---|
| B | archive.css (113 hex, 12 mor) | hardcode → token, mor temizliği |
| B | premium-funnel.css, premium-lock.css | hardcode → token, gate/modal |
| B | admin-codes.css (0 token) | sıfırdan token'a bağla |
| C | timeline / academy / teaser | kart + badge token'a |
| D | inline `style=""` + JS `element.style` | class/token'a çevir |
| E | mobile.css (13 mor, 195 rgba) | mobil cila |

> Bunlar **variable kullanmadığı** için merkezi remap yakalayamıyor; dosya bazında dönüştürülmeli.

---

## 4) RİSK ANALİZİ

- **Düşük risk (Phase A):** Sadece token tanımı + remap + load-order. Layout DOM'a dokunulmadı. `html:root` remap'i değişken *değerini* değiştirir, yapıyı değil. Geri alma: `theme.css` linkini kaldırmak yeterli.
- **Orta risk (Phase B–C):** Hardcode hex → token çevirirken bazı dosyalarda renk dışında (gradient yön, opacity) ince farklar çıkabilir; her dosya sonrası görsel test şart.
- **Yüksek dikkat (Phase D):** JS `element.style` çevirirken iş mantığına dokunmamak kritik — sadece renk satırları.
- **Dokunulmayanlar:** Scanner, Telegram, Archive/Outcome, Access Layer, doLogin — hiçbiri değişmedi.

---

## 5) ÖNERİLEN FAZ PLANI (onayınla devam)

- **Phase A ✅ (bu teslim):** theme.css + token sistemi + load order + merkezi remap.
- **Phase B:** archive + premium-funnel + premium-lock + admin-codes hardcode→token.
- **Phase C:** timeline + academy + teaser kartları.
- **Phase D:** inline style + JS element.style temizliği + modal/gate.
- **Phase E:** mobil cila (mobile.css).

Her faz sonunda görsel test. "Phase B başla" dersen archive.css'ten devam ederim.
