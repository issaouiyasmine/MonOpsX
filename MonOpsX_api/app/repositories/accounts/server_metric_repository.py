from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.errors import PyMongoError

from app.database.mongodb import (
    create_server_indexes,
    get_account_database,
    get_server_database
)
from app.models.account.server_model import ServerMetric


class ServerMetricRepository:
    LEGACY_COLLECTION_NAME = "server_metrics"
    LEGACY_MONTHLY_COLLECTION_PREFIX = "server_metrics_"
    DEDUP_METRIC_FIELDS = (
        "cpu_percent",
        "memory_percent",
        "disk_percent",
        "load_average_1m"
    )

    @staticmethod
    def _monthly_collection_name(date: datetime) -> str:
        return date.strftime("%m%y")

    @staticmethod
    def _day_document_id(date: datetime) -> str:
        return date.strftime("%Y-%m-%d")

    @staticmethod
    def _legacy_collection_sort_key(name: str) -> datetime:
        if name == ServerMetricRepository.LEGACY_COLLECTION_NAME:
            return datetime.min

        suffix = name.replace(
            ServerMetricRepository.LEGACY_MONTHLY_COLLECTION_PREFIX,
            "",
            1
        )
        try:
            return datetime.strptime(suffix, "%m%y")
        except ValueError:
            return datetime.min

    @staticmethod
    def _server_collection_sort_key(name: str) -> datetime:
        try:
            return datetime.strptime(name, "%m%y")
        except ValueError:
            return datetime.min

    @staticmethod
    def _sample_from_metric(metric: ServerMetric) -> dict[str, Any]:
        data = metric.model_dump(by_alias=True)
        data.pop("server_id", None)
        return data

    @staticmethod
    def _metric_from_sample(
        sample: dict[str, Any],
        server_id: ObjectId
    ) -> ServerMetric:
        return ServerMetric.model_validate({
            **sample,
            "server_id": server_id
        })

    @staticmethod
    def _sample_collected_at(sample: dict[str, Any]) -> datetime:
        value = sample.get("collected_at")
        return value if isinstance(value, datetime) else datetime.min

    @staticmethod
    def _simple_metrics_are_equal(
        previous: dict[str, Any] | None,
        current: dict[str, Any]
    ) -> bool:
        if previous is None:
            return False

        previous_metrics = previous.get("metrics") or {}
        return all(
            previous_metrics.get(field) == current.get(field)
            for field in ServerMetricRepository.DEDUP_METRIC_FIELDS
        )

    @staticmethod
    async def _latest_sample_from_server_database(
        metric: ServerMetric
    ) -> dict[str, Any] | None:
        server_id = str(metric.server_id)
        db = get_server_database(server_id)
        collection_names = [
            name
            for name in await db.list_collection_names()
            if ServerMetricRepository._server_collection_sort_key(name) != datetime.min
        ]
        collection_names.sort(
            key=ServerMetricRepository._server_collection_sort_key,
            reverse=True
        )

        for collection_name in collection_names:
            documents = await db[collection_name].find(
                {"server_id": metric.server_id}
            ).sort("day", -1).limit(1).to_list(length=1)

            for document in documents:
                samples = list(document.get("samples", []))
                if samples:
                    samples.sort(
                        key=ServerMetricRepository._sample_collected_at,
                        reverse=True
                    )
                    return samples[0]

        return None

    @staticmethod
    async def create(account_id: str, metric: ServerMetric) -> str:
        try:
            await ServerMetricRepository._create_in_server_database(metric)
        except PyMongoError:
            await ServerMetricRepository._create_in_legacy_account_database(
                account_id,
                metric
            )
        return str(metric.id)

    @staticmethod
    async def _create_in_server_database(metric: ServerMetric) -> None:
        server_id = str(metric.server_id)
        collection_name = ServerMetricRepository._monthly_collection_name(
            metric.collected_at
        )
        day_id = ServerMetricRepository._day_document_id(metric.collected_at)
        db = get_server_database(server_id)
        collection = db[collection_name]
        latest_sample = await ServerMetricRepository._latest_sample_from_server_database(
            metric
        )

        if ServerMetricRepository._simple_metrics_are_equal(
            latest_sample,
            metric.metrics
        ):
            return

        await create_server_indexes(server_id, collection_name)
        await collection.update_one(
            {
                "_id": day_id,
                "server_id": metric.server_id
            },
            {
                "$setOnInsert": {
                    "_id": day_id,
                    "server_id": metric.server_id,
                    "day": day_id,
                    "created_at": datetime.utcnow()
                },
                "$set": {
                    "updated_at": datetime.utcnow()
                },
                "$push": {
                    "samples": ServerMetricRepository._sample_from_metric(metric)
                }
            },
            upsert=True
        )

    @staticmethod
    async def _create_in_legacy_account_database(
        account_id: str,
        metric: ServerMetric
    ) -> None:
        db = get_account_database(account_id)
        collection_name = (
            f"{ServerMetricRepository.LEGACY_MONTHLY_COLLECTION_PREFIX}"
            f"{ServerMetricRepository._monthly_collection_name(metric.collected_at)}"
        )
        await db[collection_name].insert_one(metric.model_dump(by_alias=True))

    @staticmethod
    async def get_recent(
        account_id: str,
        server_id: str,
        limit: int
    ) -> list[ServerMetric]:
        server_metrics = await ServerMetricRepository._get_recent_from_server_database(
            server_id,
            limit
        )

        if len(server_metrics) < limit:
            legacy_metrics = await ServerMetricRepository._get_recent_from_legacy_account_database(
                account_id,
                server_id,
                limit - len(server_metrics)
            )
            server_metrics.extend(legacy_metrics)

        server_metrics.sort(
            key=lambda metric: metric.collected_at,
            reverse=True
        )
        return server_metrics[:limit]

    @staticmethod
    async def _get_recent_from_server_database(
        server_id: str,
        limit: int
    ) -> list[ServerMetric]:
        db = get_server_database(server_id)
        collection_names = [
            name
            for name in await db.list_collection_names()
            if ServerMetricRepository._server_collection_sort_key(name) != datetime.min
        ]
        collection_names.sort(
            key=ServerMetricRepository._server_collection_sort_key,
            reverse=True
        )

        metrics: list[ServerMetric] = []
        server_object_id = ObjectId(server_id)

        for collection_name in collection_names:
            if len(metrics) >= limit:
                break

            documents = await db[collection_name].find(
                {"server_id": server_object_id}
            ).sort("day", -1).to_list(length=None)

            for document in documents:
                samples = document.get("samples", [])
                month_metrics = [
                    ServerMetricRepository._metric_from_sample(
                        sample,
                        server_object_id
                    )
                    for sample in samples
                ]
                month_metrics.sort(
                    key=lambda metric: metric.collected_at,
                    reverse=True
                )
                metrics.extend(month_metrics)

                if len(metrics) >= limit:
                    break

        metrics.sort(
            key=lambda metric: metric.collected_at,
            reverse=True
        )
        return metrics[:limit]

    @staticmethod
    async def _get_recent_from_legacy_account_database(
        account_id: str,
        server_id: str,
        limit: int
    ) -> list[ServerMetric]:
        db = get_account_database(account_id)
        collection_names = await db.list_collection_names()
        metric_collection_names = [
            name
            for name in collection_names
            if name == ServerMetricRepository.LEGACY_COLLECTION_NAME
            or name.startswith(ServerMetricRepository.LEGACY_MONTHLY_COLLECTION_PREFIX)
        ]
        metric_collection_names.sort(
            key=ServerMetricRepository._legacy_collection_sort_key,
            reverse=True
        )

        metrics: list[ServerMetric] = []
        server_object_id = ObjectId(server_id)

        for collection_name in metric_collection_names:
            if len(metrics) >= limit:
                break

            remaining = limit - len(metrics)
            data = await db[collection_name].find(
                {"server_id": server_object_id}
            ).sort("created_at", -1).limit(remaining).to_list(length=remaining)
            metrics.extend(
                ServerMetric.model_validate(metric)
                for metric in data
            )

        metrics.sort(
            key=lambda metric: metric.collected_at,
            reverse=True
        )
        return metrics[:limit]
