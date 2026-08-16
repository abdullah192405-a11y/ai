"""Circuit Breaker implementation for LLM provider resilience."""

import os
import time
import structlog

logger = structlog.get_logger()

FAILURE_THRESHOLD = int(os.getenv("CB_FAILURE_THRESHOLD", "5"))
RECOVERY_TIMEOUT = int(os.getenv("CB_RECOVERY_TIMEOUT", "30"))
HALF_OPEN_REQUESTS = int(os.getenv("CB_HALF_OPEN_REQUESTS", "1"))


class CircuitBreaker:
    """
    Three-state circuit breaker: CLOSED → OPEN → HALF_OPEN → CLOSED
    
    CLOSED: Normal operation, requests flow through.
    OPEN: All requests fail immediately after threshold breached.
    HALF_OPEN: Limited requests allowed to test recovery.
    """

    def __init__(self, name: str):
        self.name = name
        self.state = "CLOSED"
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0
        self.half_open_attempts = 0

    def is_available(self) -> bool:
        """Checks if the circuit breaker allows requests."""
        if self.state == "CLOSED":
            return True

        if self.state == "OPEN":
            elapsed = time.time() - self.last_failure_time
            if elapsed >= RECOVERY_TIMEOUT:
                self.state = "HALF_OPEN"
                self.half_open_attempts = 0
                logger.info("circuit_breaker_half_open", provider=self.name)
                return True
            return False

        if self.state == "HALF_OPEN":
            return self.half_open_attempts < HALF_OPEN_REQUESTS

        return False

    def record_success(self):
        """Records a successful request."""
        if self.state == "HALF_OPEN":
            self.success_count += 1
            if self.success_count >= HALF_OPEN_REQUESTS:
                self.state = "CLOSED"
                self.failure_count = 0
                self.success_count = 0
                logger.info("circuit_breaker_closed", provider=self.name)
        elif self.state == "CLOSED":
            self.failure_count = 0

    def record_failure(self):
        """Records a failed request."""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == "HALF_OPEN":
            self.state = "OPEN"
            logger.warning("circuit_breaker_reopened", provider=self.name)
        elif self.state == "CLOSED" and self.failure_count >= FAILURE_THRESHOLD:
            self.state = "OPEN"
            logger.warning("circuit_breaker_opened", provider=self.name, failures=self.failure_count)

    def reset(self):
        """Forces the circuit breaker to closed state."""
        self.state = "CLOSED"
        self.failure_count = 0
        self.success_count = 0
