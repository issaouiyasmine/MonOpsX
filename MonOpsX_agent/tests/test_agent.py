import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import agent


class AgentTests(unittest.TestCase):
    @patch.object(agent, "psutil")
    def test_collect_system_metrics(self, psutil):
        psutil.boot_time.return_value = 100
        psutil.cpu_percent.return_value = 12.5
        psutil.virtual_memory.return_value = SimpleNamespace(percent=55.5)
        psutil.disk_usage.return_value = SimpleNamespace(percent=71.2)

        with patch.object(agent.time, "time", return_value=200):
            result = agent.collect_system_metrics()

        self.assertEqual(result["cpu_percent"], 12.5)
        self.assertEqual(result["memory_percent"], 55.5)
        self.assertEqual(result["disk_percent"], 71.2)
        self.assertEqual(result["uptime_seconds"], 100)

    def test_collect_docker_state_when_docker_unavailable(self):
        with patch.object(agent, "docker", None):
            docker_state, events, next_state = agent.collect_docker_state()

        self.assertFalse(docker_state["available"])
        self.assertEqual(events, [])
        self.assertEqual(next_state, {})

    @patch.object(agent, "requests")
    def test_post_payload_retries_then_succeeds(self, requests):
        failed_response = Mock()
        failed_response.raise_for_status.side_effect = RuntimeError("temporary")
        ok_response = Mock()
        ok_response.raise_for_status.return_value = None
        requests.post.side_effect = [failed_response, ok_response]

        with patch.object(agent.time, "sleep"):
            agent.post_payload("http://api", "token", {"metrics": {}}, retries=2)

        self.assertEqual(requests.post.call_count, 2)


if __name__ == "__main__":
    unittest.main()
