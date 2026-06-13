from enum import Enum


class RolesPermissions(int, Enum):
    ACCESS = 5
    CREATE = 6
    UPDATE = 7
    DELETE = 8   
    
    @classmethod
    def all(cls):
        return [permission.value for permission in cls]
