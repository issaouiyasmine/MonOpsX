from app.enums.permissions.account_permissions import AccountPermissions
from app.enums.permissions.roles_permissions import RolesPermissions
from app.enums.permissions.users_permissions import UsersPermissions


class PermissionHelper:
    @staticmethod
    def has_permission(user, permission):
        return permission in user.permissions
    
    @staticmethod
    def getall_permissions():

        return (
            list(UsersPermissions.all()) +
            list(RolesPermissions.all()) +
            list(AccountPermissions.all())
        )
