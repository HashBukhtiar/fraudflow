"""
FraudFlow — central constants.

Single source of truth for every tunable risk parameter, threshold, weight,
and operational limit in the system.  No other module should hard-code any of
these values; import from here instead.

Sections
--------
  1. App age
  2. Profiler thresholds
  3. Composite risk-score weights
  4. Verdict score thresholds
  5. AI / decision engine
  6. Memory store
  7. Pipeline
  8. API route defaults
"""

# ---------------------------------------------------------------------------
# 1. App age
# ---------------------------------------------------------------------------

# Apps registered within this many hours are considered "new" and carry
# elevated risk.  Used by: profiler.py, scope_rules.py, decision_engine.py,
# memory_store.py.
NEW_APP_AGE_HOURS: float = 72.0

# ---------------------------------------------------------------------------
# 2. Profiler thresholds
# ---------------------------------------------------------------------------

# Call rate (calls per minute) at which the high-frequency signal saturates
# to 1.0.  Bursts at or above this value score the maximum contribution.
HIGH_FREQ_CALLS_PER_MIN: float = 3.0

# Number of declared permission scopes above which an app is considered to
# have requested excessive permissions.
MAX_PERMISSIONS_BEFORE_FLAG: int = 3

# Grace buffer: an app may have up to (category_baseline + buffer) scopes
# before triggering the excessive-permissions flag.
EXCESSIVE_PERMISSIONS_BUFFER: int = 1

# Payment-structuring detection band — amounts that cluster just below the
# $10,000 mandatory reporting threshold are considered suspicious.
STRUCTURING_BAND_LOW: float = 8_000.0
STRUCTURING_BAND_HIGH: float = 9_999.0

# Minimum number of transactions that must fall in the structuring band
# before the signal fires.
STRUCTURING_MIN_COUNT: int = 3

# Benford's Law normalisation: the theoretical maximum mean absolute
# deviation across 9 first-digit buckets (~0.3).  Used to scale the raw
# deviation into a 0–1 score.
BENFORD_NORMALISATION_DIVISOR: float = 0.3

# Minimum number of transaction amounts required before running Benford
# analysis.  Fewer samples produce statistically unreliable results.
BENFORD_MIN_SAMPLE_SIZE: int = 5

# Off-hours window: calls made between OFF_HOURS_START:00 and OFF_HOURS_END:59
# (wall-clock hour, inclusive on both ends) are counted as overnight access.
OFF_HOURS_START: int = 0   # midnight
OFF_HOURS_END: int = 5     # 05:59 AM

# ---------------------------------------------------------------------------
# 3. Composite risk-score weights
# ---------------------------------------------------------------------------
# These weights are the single canonical set used by the profiler pipeline.
# The old parallel weight table in scope_rules.py is removed in Task 4.
#
# Signal weights — their relative importance in the composite score:
WEIGHT_UNUSUAL_ENDPOINT: float = 6.0   # non-payment app calling payment endpoint
WEIGHT_OFF_HOURS: float = 4.0          # sustained overnight access
WEIGHT_HIGH_FREQUENCY: float = 4.0     # burst call rate
WEIGHT_BENFORD: float = 2.0            # numeric anomaly / structuring
WEIGHT_NEW_APP: float = 2.0            # recently registered app
WEIGHT_EXCESSIVE_PERMS: float = 1.5    # more scopes than category warrants
WEIGHT_LOW_TRUST: float = 2.0          # inverted trust score contribution

# The raw weighted sum is divided by the sum of all weights then multiplied
# by this factor to produce a final score on a 0–10 scale.
COMPOSITE_SCORE_SCALE: float = 10.0

# ---------------------------------------------------------------------------
# 4. Verdict score thresholds
# ---------------------------------------------------------------------------
# These thresholds drive Claude's verdict AND are interpolated directly into
# the system prompt so the prompt is always in sync with the code.
#
#   score >= SCORE_BLOCK_THRESHOLD              → BLOCK
#   SCORE_FLAG_MIN <= score < SCORE_BLOCK_THRESHOLD  → FLAG
#   score < SCORE_FLAG_MIN                      → ALLOW
SCORE_BLOCK_THRESHOLD: float = 4.0
SCORE_FLAG_MIN: float = 3.0

# ---------------------------------------------------------------------------
# 5. AI / decision engine
# ---------------------------------------------------------------------------

AI_MODEL: str = "claude-haiku-4-5-20251001"
AI_MAX_TOKENS: int = 512

# Values used when the Claude API call or JSON parse fails entirely.
FALLBACK_VERDICT: str = "FLAG"
FALLBACK_CONFIDENCE: float = 0.5

# ---------------------------------------------------------------------------
# 6. Memory store
# ---------------------------------------------------------------------------

# Minimum keyword-overlap fraction for a stored incident to be considered
# a match for the current query.
MEMORY_MATCH_THRESHOLD: float = 0.30

# Maximum number of past incidents returned per query.
MEMORY_TOP_K: int = 3

# Signal thresholds used when building the natural-language query string
# that drives the keyword-overlap search.
MEMORY_OFF_HOURS_QUERY_THRESHOLD: float = 0.3
MEMORY_HIGH_FREQ_QUERY_THRESHOLD: float = 2.0
MEMORY_BENFORD_QUERY_THRESHOLD: float = 0.5

# ---------------------------------------------------------------------------
# 7. Pipeline
# ---------------------------------------------------------------------------

# Number of most-recent API call logs fed to the profiler per pipeline run.
PIPELINE_RECENT_CALLS_LIMIT: int = 20

# Trust-score points deducted from an app after a BLOCK or FLAG verdict.
# Trust scores are on a 0–10 scale; penalties are clamped at 0.0.
TRUST_SCORE_PENALTY_BLOCK: float = 3.0
TRUST_SCORE_PENALTY_FLAG: float = 1.5

# ---------------------------------------------------------------------------
# 8. API route defaults
# ---------------------------------------------------------------------------

# Default number of rows returned by list endpoints (alerts, decisions, etc.)
API_DEFAULT_LIST_LIMIT: int = 20

# Default call-history window used by the standalone profiler route.
PROFILER_ROUTE_CALL_WINDOW: int = 50

# Default limit for the /api/calls endpoint.
API_DEFAULT_CALLS_LIMIT: int = 50
