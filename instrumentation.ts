export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Load New Relic agent for server-side instrumentation
    require('newrelic')
  }
}
