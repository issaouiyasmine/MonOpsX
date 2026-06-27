from enum import Enum


class DashboardPermissions(int, Enum):
    ACCESS = 12
    CREATE = 13
    UPDATE = 14
    DELETE = 15

    @classmethod
    def all(cls):
        return [permission.value for permission in cls]
