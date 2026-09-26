import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // SQLite database file. Uses Node's built-in driver, so there is nothing to
  // install and no server to run. Set DB_PATH to relocate it.
  dbPath: process.env.DB_PATH || null,

  // Return the OTP in the response so the reset flow can be demonstrated.
  // Forced off when NODE_ENV=production.
  echoOtp: process.env.ECHO_OTP !== 'false',

  // Optional. Without a key the parser falls back to deterministic rules.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',

  // Supabase. Read by src/config/supabaseClient.js, which previously referenced
  // these two names without them ever being defined here, so importing it threw
  // "Missing SUPABASE_URL" unconditionally. They are optional: the app runs on
  // the pg driver or SQLite alone and only uses these for the /api/db-test
  // PostgREST probe.
  supabaseUrl: process.env.SUPABASE_URL || null,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,

  sessionSecret: process.env.SESSION_SECRET || 'stocksense-dev-secret',
};

export default config;
