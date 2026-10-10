import app from './app.js'
import { databaseUrl, ensureSchema, isRemote } from './db.js'

const port = Number(process.env.PORT || 3000)

await ensureSchema()

app.listen(port, () => {
  const target = isRemote ? 'Turso (remote)' : databaseUrl
  console.log(`⚡ Pulse API listening on http://localhost:${port}  →  db: ${target}`)
})
