## API Endpoints

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
