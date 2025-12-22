export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Loading New Relic agent...')
    // Load New Relic agent for server-side instrumentation
    require('newrelic')
    console.log('[Instrumentation] New Relic agent loaded successfully')
  }
}
