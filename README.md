# ⚡ PULSE — Social Network (Final Project)

เว็บไซต์ Social Media แบบ Full-stack ธีม **cyberpunk / dark neon**
Stack: **Vue 3 (Vite) + Express 5 + Drizzle ORM + Turso (libSQL) + Vercel**

> UI/UX ถูกออกแบบใหม่ทั้งหมด — กริดนีออนเคลื่อนไหว พาเนลตัดมุม แถบนำทางข้าง
> และแท็บบาร์ล่างบนมือถือ ต่างจากเวอร์ชันต้นฉบับโดยสิ้นเชิง แต่ฟังก์ชันเหมือนกันครบ

---

## ฟีเจอร์

| ฟีเจอร์ | รายละเอียด |
| --- | --- |
| สมัครสมาชิก / เข้าสู่ระบบ | อีเมล + รหัสผ่าน, hash ด้วย bcrypt |
| Authentication | JWT อายุ 7 วัน, ส่งผ่าน `Authorization: Bearer <token>` |
| โปรไฟล์ส่วนตัว | แก้ชื่อผู้ใช้, bio, สีโปรไฟล์ + สถิติโพสต์ / ไลก์ / ความคิดเห็น |
| โปรไฟล์สาธารณะ | ดูโปรไฟล์และโพสต์ของผู้ใช้คนอื่นได้ (ไม่เปิดเผยอีเมล) |
| โพสต์ | สร้าง / แก้ไข / ลบ (แก้ไข–ลบได้เฉพาะเจ้าของ) |
| Like | กดถูกใจ / ยกเลิก (idempotent — กดซ้ำไม่พัง) |
| Comment | แสดงความคิดเห็นและลบความคิดเห็นของตัวเอง |
| ค้นหา | ค้นหาโพสต์จากเนื้อหา และค้นหาผู้ใช้จากชื่อ/bio |
| Responsive | Sidebar บนจอใหญ่, แท็บบาร์ล่างบนมือถือ |
| UX | Toast แจ้งเตือน, สถานะกำลังโหลด (skeleton), ยืนยันก่อนลบ, นับตัวอักษรสด |

---

## 1. รันบนเครื่อง

```bash
cd social-app
npm install
cp .env.example .env
```

สร้าง `JWT_SECRET` แบบสุ่ม:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

ค่าเริ่มต้นใน `.env` ใช้ `TURSO_DATABASE_URL=file:./local.db` (SQLite ในเครื่อง
สร้างไฟล์ให้อัตโนมัติ) จึงรันได้ทันทีโดยไม่ต้องมีบัญชี Turso

```bash
npm run dev
```

- หน้าเว็บ → http://localhost:5173
- API → http://localhost:3000/api/health

คำสั่งอื่น: `npm run dev:api` (เปิดแค่ backend), `npm run dev:web` (เปิดแค่ frontend),
`npm run build && npm start` (รัน production build ผ่าน Express)

---

## 2. เชื่อมต่อ Turso

1. สมัครที่ https://turso.tech แล้วสร้างฐานข้อมูล (เช่น `pulse-social`)
2. คัดลอก **Database URL** และกด **Create Token**
3. แก้ `.env`:

```env
TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
TURSO_AUTH_TOKEN=your-turso-token
JWT_SECRET=your-random-secret-at-least-32-chars
```

ตาราง `users`, `posts`, `likes`, `comments` และ index จะถูกสร้างอัตโนมัติ
(`CREATE TABLE IF NOT EXISTS`) เมื่อมีการเรียก API ครั้งแรก

---

## 3. Deploy ขึ้น Vercel

1. Push โฟลเดอร์นี้ขึ้น GitHub (อย่า commit `.env`, `*.db`, `node_modules`)
2. https://vercel.com/new → Import repository → Framework Preset **Vite**
3. Build Command `npm run build`, Output Directory `dist`
4. เพิ่ม Environment Variables (Production + Preview)

   | Key | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | `libsql://...` จาก Turso |
   | `TURSO_AUTH_TOKEN` | token จาก Turso |
   | `JWT_SECRET` | สุ่มอย่างน้อย 32 ตัวอักษร |

5. Deploy แล้วตรวจ `https://<project>.vercel.app/api/health` → `{"status":"ok","database":"connected"}`

`vercel.json` ส่ง `/api/*` ไปที่ serverless function `api/index.js` และเส้นทางอื่น
ทั้งหมดกลับไปที่ Vue SPA

> ⚠️ ห้ามใช้ `file:./local.db` บน Vercel — ระบบไฟล์ของ serverless ไม่ถาวร
> และห้าม commit token หรือ `JWT_SECRET` ลง repository

---

## 4. API Endpoints

ทุกเส้นที่ต้อง Login ให้ส่ง header `Authorization: Bearer <JWT>`

| Method | Path | Login | คำอธิบาย |
| --- | :---: | :---: | --- |
| GET | `/api/health` | – | ตรวจ API และฐานข้อมูล |
| GET | `/api/stats` | – | สถิติรวมทั้งระบบ |
| POST | `/api/auth/register` | – | สมัครสมาชิก |
| POST | `/api/auth/login` | – | เข้าสู่ระบบ |
| GET | `/api/me` | ✓ | ข้อมูลโปรไฟล์ตัวเอง + สถิติ |
| PATCH | `/api/me` | ✓ | แก้ชื่อผู้ใช้ / bio / สีโปรไฟล์ |
| GET | `/api/users?q=` | ✓ | ค้นหาผู้ใช้ |
| GET | `/api/users/:id` | ✓ | โปรไฟล์สาธารณะ + โพสต์ของผู้ใช้นั้น |
| GET | `/api/posts?scope=all\|mine&q=` | ✓ | ฟีดรวม / โพสต์ของฉัน / ค้นหา |
| POST | `/api/posts` | ✓ | สร้างโพสต์ `{ "content": "..." }` |
| PATCH | `/api/posts/:id` | ✓ | แก้ไขโพสต์ของตัวเอง |
| DELETE | `/api/posts/:id` | ✓ | ลบโพสต์ของตัวเอง |
| POST | `/api/posts/:id/like` | ✓ | กด Like |
| DELETE | `/api/posts/:id/like` | ✓ | ยกเลิก Like |
| POST | `/api/posts/:id/comments` | ✓ | แสดงความคิดเห็น |
| DELETE | `/api/comments/:id` | ✓ | ลบความคิดเห็นของตัวเอง |

---

## 5. โครงสร้างไฟล์

```
social-app/
├── api/index.js          # serverless entry สำหรับ Vercel
├── server/
│   ├── app.js            # REST API + สิทธิ์การเข้าถึง
│   ├── auth.js           # ออก / ตรวจ JWT + middleware
│   ├── bootstrap.js      # โหลด .env โดยไม่ใช้ dependency
│   ├── db.js             # Turso client + Drizzle + สร้างตาราง
│   ├── local.js          # dev/production server
│   └── schema.js         # ตาราง Drizzle (users, posts, likes, comments)
├── src/
│   ├── components/       # AppShell, PostCard, PostComposer, UserAvatar, ToastHost
│   ├── views/            # AuthView, FeedView, ExploreView, ProfileView
│   ├── api.js            # fetch wrapper
│   ├── store.js          # สถานะ auth + session
│   ├── toast.js          # คิวแจ้งเตือน
│   ├── router.js         # Vue Router + auth guard
│   └── style.css         # ระบบดีไซน์ cyberpunk
├── scripts/
│   ├── check.js          # ตรวจ syntax
│   └── smoke.js          # ทดสอบ API แบบ end-to-end
├── output/               # ภาพหน้าจอจากการทดสอบ UI
├── .env.example
└── vercel.json
```

---

## 6. ตรวจงานก่อนส่ง

```bash
npm run check     # ตรวจ syntax ฝั่ง server
npm run build     # build frontend
npm run dev:api   # เปิด API (อีก terminal)
npm run test:smoke
```

`npm run test:smoke` จะสร้างบัญชีทดสอบ 2 บัญชี และตรวจสอบ
สมัคร/เข้าสู่ระบบ/สิทธิ์การแก้ไข–ลบ/Like/Comment/ค้นหา/โปรไฟล์ รวมทั้งหมด

```
✅ 29 passed, 0 failed
```

⚠️ Smoke test เขียนข้อมูลลงฐานข้อมูลจริงที่จะรัน จึงควรใช้ฐานข้อมูลทดสอบ
(ค่าเริ่มต้น `file:./local.db` ปลอดภัยสำหรับใช้ฝึก)

---

## 7. หมายเหตุด้านความปลอดภัย

โปรเจกต์นี้เก็บ JWT ใน `localStorage` เพื่อให้เรียนรู้ได้ง่าย ระบบ production
ที่มีผู้ใช้จริงควรย้ายไปใช้ HttpOnly + Secure + SameSite cookie พร้อม CSRF
protection และเพิ่ม rate limiting, reset password, email verification,
content moderation, audit logging และ automated integration tests

ข้อมูลจำลองทั้งหมดถูกแยกตาม `userId` ในฐานข้อมูลจริง — ผู้ใช้แต่ละคน
เห็นและแก้ไขได้เฉพาะข้อมูลของตัวเอง
