from app.database.mongodb import (
    get_app_database
)
from app.models.global_models.session_model import SessionModel


class SessionRepository:

    @staticmethod
    async def create(
        session: SessionModel
    ) -> str:

        db = get_app_database()

        result = await db.sessions.insert_one(
            session.model_dump(by_alias=True)
        )

        return str(
            result.inserted_id
        )
    
    @staticmethod
    async def find_by_id(
        session_id: str
    ) -> SessionModel | None:

        db = get_app_database()

        session_data = await db.sessions.find_one(
            {
                "_id": session_id
            }
        )

        if session_data:
            return SessionModel.model_validate(session_data)

        return None
    

    @staticmethod
    async def find_by_user_id(  
        user_id: str
    ) -> list[SessionModel]:

        db = get_app_database()

        sessions = await db.sessions.find(
            {
                "user_id": user_id
            }
        ).to_list(length=None)

        return [
            SessionModel.model_validate(session)
            for session in sessions
        ]

    @staticmethod
    async def find_by_refresh_token(
        refresh_token: str
    ) -> SessionModel | None:
        db = get_app_database()

        session_data = await db.sessions.find_one(
            {
                "refresh_token": refresh_token
            }
        )

        if session_data:
            return SessionModel.model_validate(session_data)

        return None

    @staticmethod
    async def rotate_refresh_token(
        session_id: str,
        refresh_token: str,
        expires_at
    ) -> None:
        db = get_app_database()

        await db.sessions.update_one(
            {
                "_id": session_id
            },
            {
                "$set": {
                    "refresh_token": refresh_token,
                    "expires_at": expires_at
                }
            }
        )
    
    @staticmethod
    async def delete_by_id(
        session_id: str
    ):

        db = get_app_database()

        result = await db.sessions.delete_one(
            {
                "_id": session_id
            }
        )

        return str(
            result.deleted_count
        )

    @staticmethod
    async def delete_by_refresh_token(
        refresh_token: str
    ) -> str:
        db = get_app_database()

        result = await db.sessions.delete_one(
            {
                "refresh_token": refresh_token
            }
        )

        return str(result.deleted_count)

    @staticmethod
    async def delete_by_user_id(user_id: str) -> str:
        db = get_app_database()
        result = await db.sessions.delete_many({"user_id": user_id})
        return str(result.deleted_count)

    @staticmethod
    async def delete_by_user_ids(user_ids: list[str]) -> str:
        if not user_ids:
            return "0"

        db = get_app_database()
        result = await db.sessions.delete_many(
            {"user_id": {"$in": user_ids}}
        )
        return str(result.deleted_count)
