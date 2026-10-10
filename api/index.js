import app from '../server/app.js'

// Vercel runs this module as an HTTP handler; an Express app is a (req, res)
// function, so it can be exported directly.
export default app
