import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.models.account.server_model import ServerMetric
from app.repositories.accounts.server_metric_repository import ServerMetricRepository


class FakeCursor:
    def __init__(self, data):
        self.data = list(data)

    def sort(self, key, direction):
        reverse = direction == -1
        self.data.sort(key=lambda item: item.get(key), reverse=reverse)
        return self

    def limit(self, value):
        self.data = self.data[:value]
        return self

    async def to_list(self, length=None):
        return self.data if length is None else self.data[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = documents or []
        self.update_calls = []

    async def update_one(self, query, update, upsert=False):
        self.update_calls.append({
            "query": query,
            "update": update,
            "upsert": upsert
        })

    async def create_index(self, *_args, **_kwargs):
        return None

    def find(self, _query):
        return FakeCursor(self.documents)


class FakeDatabase:
    def __init__(self, collections=None):
        self.collections = collections or {}

    def __getitem__(self, name):
        self.collections.setdefault(name, FakeCollection())
        return self.collections[name]

    async def list_collection_names(self):
        return list(self.collections.keys())


class ServerMetricRepositoryTests(unittest.IsolatedAsyncioTestCase):
    def build_metric(self, collected_at):
        return ServerMetric(
            _id=ObjectId(),
            server_id=ObjectId("507f1f77bcf86cd799439011"),
            agent_version="1.0.0",
            collected_at=collected_at,
            hostname="server-01",
            ip="127.0.0.1",
            metrics={
                "cpu_percent": 12,
                "memory_percent": 34,
                "disk_percent": 56,
                "uptime_seconds": 120
            },
            docker={"available": False, "containers": []},
            events=[],
            status="online"
        )

    @patch("app.repositories.accounts.server_metric_repository.create_server_indexes", new_callable=AsyncMock)
    @patch("app.repositories.accounts.server_metric_repository.get_server_database")
    async def test_create_writes_sample_to_server_month_day_document(
        self,
        get_server_database,
        create_indexes
    ):
        database = FakeDatabase()
        get_server_database.return_value = database
        metric = self.build_metric(datetime(2026, 6, 27, 10, 30, tzinfo=timezone.utc))

        result = await ServerMetricRepository.create("account-1", metric)

        self.assertEqual(result, str(metric.id))
        self.assertIn("0626", database.collections)
        create_indexes.assert_awaited_once_with(str(metric.server_id), "0626")

        update_call = database["0626"].update_calls[0]
        self.assertEqual(update_call["query"]["_id"], "2026-06-27")
        self.assertEqual(update_call["query"]["server_id"], metric.server_id)
        self.assertTrue(update_call["upsert"])
        self.assertEqual(update_call["update"]["$setOnInsert"]["day"], "2026-06-27")
        self.assertEqual(update_call["update"]["$push"]["samples"]["_id"], metric.id)
        self.assertNotIn("server_id", update_call["update"]["$push"]["samples"])

    @patch("app.repositories.accounts.server_metric_repository.get_account_database")
    @patch("app.repositories.accounts.server_metric_repository.get_server_database")
    async def test_get_recent_flattens_daily_samples_before_legacy_fallback(
        self,
        get_server_database,
        get_account_database
    ):
        server_id = "507f1f77bcf86cd799439011"
        first = self.build_metric(datetime(2026, 6, 27, 10, 30, tzinfo=timezone.utc))
        second = self.build_metric(datetime(2026, 6, 27, 10, 45, tzinfo=timezone.utc))
        legacy = self.build_metric(datetime(2026, 6, 26, 9, 0, tzinfo=timezone.utc))

        server_database = FakeDatabase({
            "0626": FakeCollection([{
                "_id": "2026-06-27",
                "server_id": ObjectId(server_id),
                "day": "2026-06-27",
                "samples": [
                    first.model_dump(by_alias=True, exclude={"server_id"}),
                    second.model_dump(by_alias=True, exclude={"server_id"})
                ],
                "created_at": first.created_at,
                "updated_at": second.created_at
            }])
        })
        legacy_database = FakeDatabase({
            "server_metrics_0626": FakeCollection([
                legacy.model_dump(by_alias=True)
            ])
        })
        get_server_database.return_value = server_database
        get_account_database.return_value = legacy_database

        metrics = await ServerMetricRepository.get_recent("account-1", server_id, 3)

        self.assertEqual([metric.id for metric in metrics], [second.id, first.id, legacy.id])
        self.assertEqual([str(metric.server_id) for metric in metrics], [server_id, server_id, server_id])


if __name__ == "__main__":
    unittest.main()
