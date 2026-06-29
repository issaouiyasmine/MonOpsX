from pydantic import BaseModel, Field


class NotificationThresholds(BaseModel):
    cpu_percent: int = Field(ge=1, le=100)
    memory_percent: int = Field(ge=1, le=100)
    disk_percent: int = Field(ge=1, le=100)


class NotificationMetricSetting(BaseModel):
    threshold: int = Field(ge=1, le=100)
    in_app_enabled: bool
    push_enabled: bool


class NotificationMetricSettings(BaseModel):
    cpu_percent: NotificationMetricSetting
    memory_percent: NotificationMetricSetting
    disk_percent: NotificationMetricSetting


class NotificationSettingsResponse(BaseModel):
    enabled: bool
    metrics: NotificationMetricSettings


class UpdateNotificationSettingsRequest(NotificationSettingsResponse):
    pass
