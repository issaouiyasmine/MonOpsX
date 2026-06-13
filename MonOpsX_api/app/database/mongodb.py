from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase
)

from app.core.config import get_settings


settings = get_settings()

client: AsyncIOMotorClient | None = None


# ==========================================================
# CLIENT
# ==========================================================

def get_mongo_client() -> AsyncIOMotorClient:
    if client is None:
        raise RuntimeError(
            "MongoDB client is not initialized"
        )

    return client


# ==========================================================
# GLOBAL DATABASE
# ==========================================================

def get_app_database() -> AsyncIOMotorDatabase:
    """
    Global database

    Collections:
    - accounts
    - admins
    - sessions
    """

    return get_mongo_client()[
        settings.MONGO_APP_DATABASE
    ]


# ==========================================================
# ACCOUNT DATABASE
# ==========================================================

def build_account_database_name(
    account_id: str
) -> str:
    """
    account_6845ab12
    """

    safe_account_id = "".join(
        c
        for c in account_id
        if c.isalnum() or c == "_"
    )

    return f"account_{safe_account_id}"


def build_account_database_username(
    account_id: str
) -> str:
    return f"{build_account_database_name(account_id)}_user"


def get_account_database(
    account_id: str
) -> AsyncIOMotorDatabase:

    return get_mongo_client()[
        build_account_database_name(account_id)
    ]


async def create_account_database_user(
    account_id: str,
    password: str
) -> str:
    database_name = build_account_database_name(account_id)
    username = build_account_database_username(account_id)
    db = get_account_database(account_id)

    await db.command(
        "createUser",
        username,
        pwd=password,
        roles=[
            {
                "role": "readWrite",
                "db": database_name
            }
        ]
    )

    return username


# ==========================================================
# CONNECTION
# ==========================================================

async def connect_to_mongo():

    global client

    client = AsyncIOMotorClient(
        settings.mongo_connection_uri
    )
    
    print(settings.mongo_connection_uri)

    await client.admin.command("ping")

    print("✅ MongoDB Connected")

    await create_global_indexes()


async def close_mongo_connection():

    global client

    if client:
        client.close()
        client = None

        print("❌ MongoDB Disconnected")


# ==========================================================
# GLOBAL INDEXES
# ==========================================================

async def create_global_indexes():

    db = get_app_database()

    # Accounts

    await db.accounts.create_index(
        [
            ("is_deleted", 1),
            ("email", 1)
        ]
    )

    await db.accounts.create_index(
        "name"
    )

    # Login users

    await db.users.create_index(
        "normalized_email",
        unique=True,
        partialFilterExpression={
            "is_deleted": False
        }
    )

    # Sessions

    await db.sessions.create_index(
        "refresh_token",
        unique=True
    )

    await db.sessions.create_index(
        "expires_at"
    )

# ==========================================================
# ACCOUNT INDEXES
# ==========================================================

async def create_account_indexes(
    account_id: str
):

    db = get_account_database(
        account_id
    )

    # Users

    await db.users.create_index(
        "email",
        unique=True
    )

    # Roles

    await db.roles.create_index(
        "name",
        unique=True
    )

    # Servers

    await db.servers.create_index(
        "ip",
        unique=True
    )

    await db.servers.create_index(
        "name"
    )

    # Metrics

    await db.server_metrics.create_index(
        [
            ("server_id", 1),
            ("created_at", -1)
        ]
    )

    # Alerts

    await db.alerts.create_index(
        [
            ("server_id", 1),
            ("created_at", -1)
        ]
    )

# ==========================================================
# HELPERS
# ==========================================================

async def database_exists(
    account_id: str
) -> bool:

    database_name = build_account_database_name(
        account_id
    )

    databases = await get_mongo_client().list_database_names()

    return database_name in databases


async def drop_account_database(account_id: str) -> None:
    database_name = build_account_database_name(account_id)
    await get_mongo_client().drop_database(database_name)
