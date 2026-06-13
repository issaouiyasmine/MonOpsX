from enum import Enum


class AccountPermissions(int, Enum):
    ACCESS = 9
    UPDATE = 10
    DELETE = 11
    
    @classmethod
    def all(cls):
        return [permission.value for permission in cls]