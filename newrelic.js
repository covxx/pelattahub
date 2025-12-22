'use strict'

/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'PalettaHub WMS'],
  /**
   * Your New Relic license key.
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  /**
   * This setting controls distributed tracing.
   * Distributed tracing lets you see the path that a request takes through your
   * distributed system. Enabling distributed tracing changes the behavior of some
   * New Relic features, so carefully consult the transition guide before you enable
   * this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing
   * Default is true.
   */
  distributed_tracing: {
    /**
     * Enables/disables distributed tracing.
     *
     * @env NEW_RELIC_DISTRIBUTED_TRACING_ENABLED
     */
    enabled: true
  },
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude lists.
   */
  allow_all_headers: true,
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildcard
     * at end, and ; as a separator.  Defaults to an empty string.
     */
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  },
  /**
   * Allow list of names to be used for custom metrics and custom events.
   * This is a security feature to prevent injection of arbitrary metric names.
   */
  allow_names: ['Next.js'],
  /**
   * Controls whether the agent should capture and report errors.
   */
  error_collector: {
    enabled: true
  },
  /**
   * Controls whether the agent should capture and report transaction traces.
   */
  transaction_tracer: {
    enabled: true
  },
  /**
   * Controls whether the agent should capture and report slow queries.
   */
  slow_sql: {
    enabled: true
  },
  /**
   * Controls whether the agent should capture and report application log events.
   */
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true
    }
  }
}
