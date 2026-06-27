from enum import Enum


class AdministrationPermissions(int, Enum):
    ACCESS = 22

    @classmethod
    def all(cls):
        return [permission.value for permission in cls]
