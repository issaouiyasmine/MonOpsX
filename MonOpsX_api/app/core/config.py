from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    APP_NAME: str = "MonOpsX"

    MONGO_HOST: str = "localhost"
    MONGO_PORT: int = 27017

    MONGO_USERNAME: str
    MONGO_PASSWORD: str

    MONGO_APP_DATABASE: str = "monopsx_app"

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    METRICS_CPU_ALERT_PERCENT: float = 85
    METRICS_MEMORY_ALERT_PERCENT: float = 85
    METRICS_DISK_ALERT_PERCENT: float = 90

    @property
    def mongo_connection_uri(self) -> str:
        username = quote_plus(self.MONGO_USERNAME)
        password = quote_plus(self.MONGO_PASSWORD)

        return (
            f"mongodb://{username}:{password}"
            f"@{self.MONGO_HOST}:{self.MONGO_PORT}"
            f"/{self.MONGO_APP_DATABASE}?authSource=admin"
        )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


@lru_cache
def get_settings():
    return Settings()
