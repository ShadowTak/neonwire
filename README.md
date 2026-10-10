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
