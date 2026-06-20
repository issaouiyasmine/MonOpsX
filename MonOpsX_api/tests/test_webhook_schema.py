import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from app.schemas.webhook import ServerMetricsWebhookRequest


class WebhookSchemaTests(unittest.TestCase):
    def build_payload(self, **overrides):
        payload = {
            "agent_version": "1.0.0",
            "collected_at": datetime.now(timezone.utc),
            "hostname": "server-01",
            "ip": "192.168.1.50",
            "metrics": {
                "cpu_percent": 42.5,
                "memory_percent": 68.2,
                "disk_percent": 74.1,
                "uptime_seconds": 93820
            },
            "docker": {
                "available": True,
                "containers": [
                    {
                        "name": "api",
                        "image": "monopsx-api:1.0.0",
                        "status": "running",
                        "restart_count": 0
                    }
                ]
            },
            "events": [
                {
                    "type": "deployment",
                    "severity": "info",
                    "message": "Container api image changed"
                }
            ]
        }
        payload.update(overrides)
        return payload

    def test_accepts_valid_payload(self):
        request = ServerMetricsWebhookRequest.model_validate(self.build_payload())
        self.assertEqual(request.metrics.cpu_percent, 42.5)
        self.assertEqual(request.events[0].type, "deployment")

    def test_rejects_metric_outside_percent_range(self):
        payload = self.build_payload(metrics={
            "cpu_percent": 101,
            "memory_percent": 68.2,
            "disk_percent": 74.1,
            "uptime_seconds": 93820
        })
        with self.assertRaises(ValidationError):
            ServerMetricsWebhookRequest.model_validate(payload)

    def test_rejects_unknown_event_type(self):
        payload = self.build_payload(events=[{
            "type": "unknown",
            "severity": "info",
            "message": "Nope"
        }])
        with self.assertRaises(ValidationError):
            ServerMetricsWebhookRequest.model_validate(payload)


if __name__ == "__main__":
    unittest.main()
