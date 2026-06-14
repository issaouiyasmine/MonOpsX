import datetime

from bson import ObjectId
from app.database.mongodb import get_account_database
from app.models.account.role_model import Role
from app.utils.permissions import PermissionHelper


class RoleRepository:
    @staticmethod
    async def create_default_admin_role(
        account_id: str
    ) -> ObjectId:

        db = get_account_database(account_id)

        role = Role(
            _id=ObjectId(),
            name="Admin",
            normalized_name="ADMIN",
            permissions=PermissionHelper.getall_permissions(),
            is_default=True
        )

        await db.roles.insert_one(role.model_dump(by_alias=True))


        return role.id
    
    @staticmethod
    async def create(
        account_id: str,
        role_data: Role
    ) -> ObjectId:
        db = get_account_database(account_id)

        role_data.id = ObjectId()

        await db.roles.insert_one(role_data.model_dump(by_alias=True))

        return role_data.id
    
    @staticmethod
    async def update( 
         account_id: str,
         role_data: Role
    ) -> None:
        db = get_account_database(account_id)

        role_data.updated_on = datetime.datetime.now(datetime.UTC)

        await db.roles.update_one(
            {"_id": role_data.id},
            {"$set": {
                "name": role_data.name,
                "normalized_name": role_data.normalized_name,
                "permissions": role_data.permissions,
                "updated_on": role_data.updated_on
            }}
        )  
        
    @staticmethod
    async def delete(
        account_id: str,
        role_id: str
    ) -> None:
        db = get_account_database(account_id)

        await db.roles.update_one(
            {"_id": ObjectId(role_id)},
            {"$set": {
                "is_deleted": True,
                "deleted_on": datetime.datetime.now(datetime.UTC)
            }}
        )
    
    @staticmethod
    async def find_by_id(
        account_id: str,
        role_id: str
    ) -> Role | None:
        db = get_account_database(account_id)

        role_data = await db.roles.find_one(
            {
                "_id": ObjectId(role_id),
                "is_deleted": False
            }
        )

        if role_data:
            return Role.model_validate(role_data)

        return None
    
    @staticmethod
    async def get_all(
        account_id: str
    ) -> list[Role]:

        db = get_account_database(account_id)

        roles_data = await db.roles.find(
            {
                "is_deleted": False
            }
        ).to_list(length=None)

        return [Role.model_validate(role) for role in roles_data]
    
    @staticmethod 
    async def find_by_name(
        account_id: str,
        role_name: str
    ) -> Role | None:
        db = get_account_database(account_id)

        role_data = await db.roles.find_one(
            {
                "normalized_name": role_name.strip().upper(),
                "is_deleted": False
            }
        )

        if role_data:
            return Role.model_validate(role_data)

        return None          
