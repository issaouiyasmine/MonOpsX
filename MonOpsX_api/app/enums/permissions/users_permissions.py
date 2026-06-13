from enum import Enum


class UsersPermissions(int, Enum):
    ACCESS = 1
    CREATE = 2
    UPDATE = 3
    DELETE = 4
    
    @classmethod
    def all(cls):
        return [permission.value for permission in cls]