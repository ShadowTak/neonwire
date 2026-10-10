import jwt from 'jsonwebtoken'
import { loadEnv } from './bootstrap.js'

loadEnv()

const DEV_SECRET = 'dev-only-insecure-secret-change-me-0000000000'
const TOKEN_TTL = '7d'

function secret() {
  const value = process.env.JWT_SECRET
  if (value && value.length >= 32) return value
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production')
  }
  return value || DEV_SECRET
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, secret(), { expiresIn: TOKEN_TTL })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, secret())
  } catch {
    return null
  }
}

/** Express middleware: requires a valid `Authorization: Bearer <token>` header. */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'ต้องเข้าสู่ระบบก่อน' })
  }

  const payload = verifyToken(token)
  if (!payload?.sub) {
    return res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' })
  }

  req.userId = Number(payload.sub)
  next()
}
