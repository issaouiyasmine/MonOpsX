from enum import Enum


class ServerPermissions(int, Enum):
    ACCESS = 16
    INFORMATION_ACCESS = 17
    INFORMATION_CREATE = 18
    INFORMATION_UPDATE = 19
    INFORMATION_DELETE = 20
    DASHBOARDS_ACCESS = 21

    @classmethod
    def all(cls):
        return [permission.value for permission in cls]
