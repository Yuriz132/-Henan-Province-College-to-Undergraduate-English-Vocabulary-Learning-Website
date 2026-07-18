import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import 'express-async-errors'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { httpLogger } from './middleware/logger'
import { systemRouter } from './modules/system'
import { authRouter } from './modules/auth'
// ============================================
// Add your domain module imports here
// ============================================
// Example: Product Module
// import { productRouter } from './modules/product.js'

export const createApp = (): Application => {
  const app = express()

  // HTTP request logging
  app.use(httpLogger)

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN,
      credentials: env.CORS_ORIGIN !== '*',
    })
  )

  // Body parsing and compression
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(compression())

  // API routes - System & Health
  app.use(env.API_PREFIX, systemRouter)

  // 账户 + 云端学习进度
  app.use(env.API_PREFIX, authRouter)

  // ============================================
  // Add your domain module routes here
  // ============================================
  // Example: Product Module
  // app.use(`${env.API_PREFIX}/products`, productRouter)

  // Error handling
  app.use(errorHandler)

  return app
}
