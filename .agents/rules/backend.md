# Her Circle Backend Rules

## Tech Stack
- Runtime: Node.js 20+ (installed: v26.13.0)
- Framework: Express (ES Modules)
- Database: MongoDB + Mongoose
- Auth: JWT + bcryptjs
- Validation: zod
- OTP: 6-digit numeric, expires in 10 minutes

## Code Style
- ES Modules (`import`/`export`), NOT CommonJS
- All route handlers wrapped in async error handling
- Never store plain passwords  always bcrypt hash
- OTP must be hashed with bcrypt before storing (`otpHash`), never plaintext

## Directory Structure
- src/models/      Mongoose schemas
- src/routes/      Express routers
- src/middleware/  auth, rate limiting
- src/utils/       otp.js, notify.js
- src/server.js    entry point

## Security (non-negotiable)
- Rate-limit `/api/auth/signup` and `/api/auth/verify-otp` (max 5 / IP / 10 min)
- JWT secret from `process.env.JWT_SECRET`
- Admin routes must verify `req.user.role === "admin"` server-side
- `.env` never committed
