from enum import Enum


class NotificationPermissions(int, Enum):
    ACCESS = 24
    UPDATE = 25

    @classmethod
    def all(cls):
        return [permission.value for permission in cls]
