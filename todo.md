# TODO — สถานะงานและขั้นที่เหลือ

อัปเดตล่าสุด: หลัง push ขึ้น GitHub แล้ว เหลือแค่ deploy Vercel

---

## ✅ เสร็จแล้ว

| # | งาน | หลักฐาน |
| - | --- | --- |
| 1 | เขียนเว็บ Full-stack (Vue 3 + Express 5 + Drizzle + Turso) ฟีเจอร์ครบ | `src/`, `server/` |
| 2 | UI/UX ใหม่ทั้งหมด ธีม cyberpunk | `src/style.css`, `src/views/` |
| 3 | `npm run check` / `npm run build` ผ่าน | syntax 9 ไฟล์ + vite build |
| 4 | `npm run test:smoke` ผ่าน **บน Turso จริง** | 29/29 passed |
| 5 | UI test บนเบราว์เซอร์จริง (dev + production build) | 21/21 และ 15/15 passed |
| 6 | commit + push ขึ้น GitHub | https://github.com/ShadowTak/pulse-social (`55f0e23`) |

---

## ⏳ เหลือ 1 ขั้น: Deploy ขึ้น Vercel

### ทำไมยังไม่ได้
`~/Library/Application Support/com.vercel.cli/auth.json` เป็นของ **`root`** โหมด `0600`
→ Vercel CLI อ่านไม่ได้ (`EACCES`) และ `sudo` ต้องใส่รหัสผ่าน

### ทางแก้ที่เลือก: ใช้ Token (ไม่ต้องแตะไฟล์ของ root)

**ขั้นที่คนต้องทำ (ครั้งเดียว)**

1. เปิด https://vercel.com/account/tokens
2. กด **Create Token** → ตั้งชื่อ `pulse-deploy`
3. เลือก scope เป็นบัญชี/ทีมของคุณ → ตั้งวันหมดอายุสั้น ๆ (เช่น 1 วัน)
4. กด **Create** แล้วคัดลอกค่ามา

**ขั้นอัตโนมัติ** — คำสั่งเดียวจบทุกอย่าง:

```bash
cd social-app
VERCEL_TOKEN=<วาง token ที่นี่> npm run deploy
```

สคริปต์ `scripts/deploy.mjs` จะทำ 8 ขั้นให้เองทั้งหมด:

| ขั้น | สิ่งที่ทำ |
| --- | --- |
| 1 | ตรวจ config: token, `.env` ครบ 3 ตัว, `JWT_SECRET` ≥ 32 ตัวอักษร, มี `vercel.json` / `api/index.js` / `dist/` |
| 2 | สร้าง global-config ชั่วคราวใน tmp → **ไม่แตะ auth.json ของ root** |
| 3 | `vercel project create` + `vercel link` (สร้างโปรเจกต์ถ้ายังไม่มี) |
| 4 | ตั้ง env 3 ตัวลง **production + preview** (`env add --value --force`) |
| 5 | `vercel deploy --prod` แล้วดึง URL ออกมา |
| 6 | ตรวจของจริง: `/api/health` = `connected`, `/` เป็น SPA, `/explore` deep link ใช้ได้, ไฟล์ใน `/assets` ไม่ถูก rewrite กลืน, API ที่ไม่มีจริงตอบ 404 |
| 7 | รัน smoke test 29 ข้อ **ยิงเข้า URL จริง** |
| 8 | ลบข้อมูลทดสอบ (`*@test.dev`) ออกจาก Turso ให้อัตโนมัติ |

ตัวเลือกเสริม:

```bash
npm run deploy -- --project my-app        # เปลี่ยนชื่อโปรเจกต์ (ค่าเริ่มต้น pulse-social)
npm run deploy -- --team team_xxxx        # ระบุทีม
npm run deploy -- --no-verify             # deploy อย่างเดียว ไม่ต้องตรวจ
npm run deploy -- --token xxxx            # ส่ง token ทาง flag แทน env
npm run cleanup:test                      # ลบข้อมูลทดสอบอย่างเดียว
```

---

## ✅ Checklist หลัง deploy เสร็จ

- [ ] `/api/health` ตอบ `{"status":"ok","database":"connected"}`
- [ ] เปิด `/` เห็นหน้า auth ธีม cyberpunk
- [ ] สมัครบัญชี 2 บัญชี แล้ว login ได้ทั้งคู่
- [ ] A โพสต์ → B เห็นโพสต์ A, กด Like ได้, คอมเมนต์ได้
- [ ] B แก้/ลบโพสต์ A **ไม่ได้** (ต้องขึ้นข้อความหวงสิทธิ์)
- [ ] refresh แล้วข้อมูลไม่หาย
- [ ] เปิดใน Incognito + บนมือถือ (จอ 390px) ได้
- [ ] **เพิกถอน token ทันทีหลัง deploy** → https://vercel.com/account/tokens
- [ ] ส่ง Public URL + GitHub repo ให้อาจารย์

---

## 🛡️ สิ่งที่ต้องไม่พลาด

- [ ] `.env` **ห้าม** ขึ้น GitHub — ตรวจแล้วว่าไม่ขึ้น (`.gitignore` กันไว้)
- [ ] อย่าตั้ง `TURSO_DATABASE_URL=file:./local.db` บน Vercel — ระบบไฟล์ serverless ไม่ถาวร
- [ ] `JWT_SECRET` ต้องเหมือนเดิมทุก deploy ไม่งั้นผู้ใช้เดิมจะถูก logout ทั้งหมด
- [ ] `TURSO_AUTH_TOKEN` และ `JWT_SECRET` ห้ามโผล่ในไฟล์ Vue หรือตัวแปร `VITE_*`
- [ ] revoke token ที่สร้างเพื่อ deploy เมื่อเสร็จ

---

## 📌 ทางสำรอง ถ้า token ใช้ไม่ได้

1. **คืนสิทธิ์ไฟล์ auth เดิม** (ต้องพิมพ์รหัสผ่านเครื่องเอง):
   ```bash
   sudo chown $(whoami) ~/Library/Application\ Support/com.vercel.cli/auth.json
   ```
   แล้วรัน `npx --yes vercel@latest whoami` — ถ้าผ่าน ให้ใช้ `npx vercel --prod` ได้ตามปกติ
   (ถ้า token ข้างในหมดอายุ ให้ `npx vercel login` ใหม่)

2. **Deploy ผ่านหน้าเว็บ**: https://vercel.com/new → Import `ShadowTak/pulse-social`
   → Framework Preset **Vite** → Build `npm run build` → Output `dist`
   → ใส่ env 3 ตัว (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`) → Deploy

---

## 🔢 ตัวเลขที่ควรได้

| คำสั่ง | ผลที่คาดหวัง |
| --- | --- |
| `npm run check` | `✅ syntax check passed` |
| `npm run build` | `✓ built in ~250ms` |
| `npm run test:smoke` | `✅ 29 passed, 0 failed` |
| `npm run deploy` | `Public URL: https://…` + `✅ 29 passed, 0 failed` |

⚠️ `test:smoke` และการตรวจหลัง deploy จะ **เขียนบัญชีทดสอบลง Turso จริง**
สคริปต์ `deploy` ล้างให้อัตโนมัติในขั้นที่ 8 ถ้ารัน smoke test แยกเอง
ให้รัน `npm run cleanup:test` ต่อ
