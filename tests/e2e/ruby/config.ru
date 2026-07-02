# Rack app used by the TS<->Ruby end-to-end test.
#
# It mounts the *real* `M2mKeygen::RackValidator` from the `m2m_keygen` Ruby gem
# and answers 200 when a request's HMAC signature + expiry validate, 401 otherwise.
# The TS client (this package's `generateFetcher`) signs requests and hits this
# server, proving cross-language (TS -> Ruby) signature parity over real HTTP.
#
# Env:
#   M2M_SECRET    - shared HMAC secret (default: 'e2e-test-secret')
#   M2M_ALGORITHM - digest algorithm (default: 'sha256')

require 'm2m_keygen'

secret = ENV.fetch('M2M_SECRET', 'e2e-test-secret')
algorithm = ENV.fetch('M2M_ALGORITHM', 'sha256')

validator = M2mKeygen::RackValidator.new(secret, algorithm: algorithm)

run(lambda do |env|
  valid = validator.validate(Rack::Request.new(env))
  status = valid ? 200 : 401
  [status, { 'content-type' => 'text/plain' }, [valid ? 'ok' : 'invalid']]
end)
