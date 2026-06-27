from enum import Enum


class SettingsPermissions(int, Enum):
    ACCESS = 23

    @classmethod
    def all(cls):
        return [permission.value for permission in cls]
