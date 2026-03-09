#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# AutoFlow Test Runner
# ──────────────────────────────────────────────────────────────────────────────
# Run all offline tests (unit + integration) by default.
#
# Usage:
#   ./scripts/run-tests.sh              # unit + integration (fast)
#   ./scripts/run-tests.sh --full       # includes e2e tests (needs live services)
#   ./scripts/run-tests.sh --report     # generates HTML report
#   ./scripts/run-tests.sh --full --report
#   ./scripts/run-tests.sh --perf       # performance benchmarks only
#   ./scripts/run-tests.sh --unit       # unit tests only
#   ./scripts/run-tests.sh --integration # integration tests only
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Parse arguments ──────────────────────────────────────────────────────────

FULL=false
REPORT=false
PERF=false
UNIT_ONLY=false
INTEGRATION_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --full)         FULL=true ;;
        --report)       REPORT=true ;;
        --perf)         PERF=true ;;
        --unit)         UNIT_ONLY=true ;;
        --integration)  INTEGRATION_ONLY=true ;;
        -h|--help)
            echo "Usage: $0 [--full] [--report] [--perf] [--unit] [--integration]"
            echo ""
            echo "  --full          Include e2e tests (requires live services)"
            echo "  --report        Generate HTML report in test-results/"
            echo "  --perf          Run performance benchmarks only"
            echo "  --unit          Run unit tests only"
            echo "  --integration   Run integration tests only"
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Run '$0 --help' for usage."
            exit 1
            ;;
    esac
done

# ── Detect Python ────────────────────────────────────────────────────────────

if [ -f "$PROJECT_ROOT/.venv-connectivity/bin/python3" ]; then
    PYTHON="$PROJECT_ROOT/.venv-connectivity/bin/python3"
    echo "Using venv Python: $PYTHON"
elif command -v python3 &>/dev/null; then
    PYTHON="python3"
    echo "Using system Python: $(python3 --version)"
else
    echo "ERROR: No Python 3 found. Install Python or create .venv-connectivity."
    exit 1
fi

PYTEST="$PYTHON -m pytest"

# ── Ensure test-results directory ────────────────────────────────────────────

mkdir -p "$PROJECT_ROOT/test-results"

# ── Build pytest arguments ───────────────────────────────────────────────────

PYTEST_ARGS=(-v --tb=short)

if [ "$REPORT" = true ]; then
    PYTEST_ARGS+=(
        --html="$PROJECT_ROOT/test-results/report.html"
        --self-contained-html
    )
fi

# ── Run tests ────────────────────────────────────────────────────────────────

EXIT_CODE=0

if [ "$PERF" = true ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Performance Benchmarks"
    echo "════════════════════════════════════════════════════════════════"
    $PYTEST tests/e2e/test_performance.py "${PYTEST_ARGS[@]}" \
        --junitxml="$PROJECT_ROOT/test-results/performance.xml" || EXIT_CODE=$?

elif [ "$UNIT_ONLY" = true ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Unit Tests"
    echo "════════════════════════════════════════════════════════════════"
    $PYTEST tests/unit/ "${PYTEST_ARGS[@]}" \
        -m "not slow and not gpu" \
        --junitxml="$PROJECT_ROOT/test-results/unit.xml" || EXIT_CODE=$?

elif [ "$INTEGRATION_ONLY" = true ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Integration Tests"
    echo "════════════════════════════════════════════════════════════════"
    $PYTEST tests/integration/ "${PYTEST_ARGS[@]}" \
        -m "not slow and not gpu" \
        --junitxml="$PROJECT_ROOT/test-results/integration.xml" || EXIT_CODE=$?

else
    # Default: unit + integration
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Unit Tests"
    echo "════════════════════════════════════════════════════════════════"
    $PYTEST tests/unit/ "${PYTEST_ARGS[@]}" \
        -m "not slow and not gpu" \
        --junitxml="$PROJECT_ROOT/test-results/unit.xml" || EXIT_CODE=$?

    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Integration Tests"
    echo "════════════════════════════════════════════════════════════════"
    $PYTEST tests/integration/ "${PYTEST_ARGS[@]}" \
        -m "not slow and not gpu" \
        --junitxml="$PROJECT_ROOT/test-results/integration.xml" || EXIT_CODE=$?

    if [ "$FULL" = true ]; then
        echo ""
        echo "════════════════════════════════════════════════════════════════"
        echo "  E2E Tests (including performance)"
        echo "════════════════════════════════════════════════════════════════"
        $PYTEST tests/e2e/ "${PYTEST_ARGS[@]}" \
            --junitxml="$PROJECT_ROOT/test-results/e2e.xml" || EXIT_CODE=$?
    fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════════"
if [ "$EXIT_CODE" -eq 0 ]; then
    echo "  All tests PASSED"
else
    echo "  Some tests FAILED (exit code: $EXIT_CODE)"
fi
echo "  Results: $PROJECT_ROOT/test-results/"
echo "════════════════════════════════════════════════════════════════"

exit $EXIT_CODE
