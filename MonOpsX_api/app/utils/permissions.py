from app.enums.permissions.administration_permissions import AdministrationPermissions
from app.enums.permissions.account_permissions import AccountPermissions
from app.enums.permissions.dashboard_permissions import DashboardPermissions
from app.enums.permissions.notification_permissions import NotificationPermissions
from app.enums.permissions.roles_permissions import RolesPermissions
from app.enums.permissions.server_permissions import ServerPermissions
from app.enums.permissions.settings_permissions import SettingsPermissions
from app.enums.permissions.users_permissions import UsersPermissions


class PermissionHelper:
    @staticmethod
    def has_permission(user, permission):
        return permission in user.permissions
    
    @staticmethod
    def getall_permissions():

        return (
            list(DashboardPermissions.all()) +
            list(ServerPermissions.all()) +
            list(AdministrationPermissions.all()) +
            list(UsersPermissions.all()) +
            list(RolesPermissions.all()) +
            list(SettingsPermissions.all()) +
            list(NotificationPermissions.all()) +
            list(AccountPermissions.all())
        )
