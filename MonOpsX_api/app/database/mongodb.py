from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase
)
from pymongo.errors import PyMongoError

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


# ==========================================================
# SERVER DATABASE
# ==========================================================

def build_server_database_name(
    server_id: str
) -> str:
    safe_server_id = "".join(
        c
        for c in server_id
        if c.isalnum() or c == "_"
    )

    return f"server_{safe_server_id}"


def get_server_database(
    server_id: str
) -> AsyncIOMotorDatabase:

    return get_mongo_client()[
        build_server_database_name(server_id)
    ]


async def create_server_indexes(
    server_id: str,
    month_collection_name: str
) -> None:
    db = get_server_database(server_id)
    collection = db[month_collection_name]

    await collection.create_index(
        [
            ("server_id", 1),
            ("day", -1)
        ]
    )

    await collection.create_index(
        "samples.collected_at"
    )


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
    
    await client.admin.command("ping")

    print("✅ MongoDB Connected")

    await create_global_indexes()
    await create_all_account_indexes()


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

    await db.sessions.create_index(
        "user_id"
    )

    # Server webhook tokens

    await db.server_webhook_tokens.create_index(
        "token_hash",
        unique=True
    )

    await db.server_webhook_tokens.create_index(
        [
            ("account_id", 1),
            ("server_id", 1),
            ("revoked_at", 1)
        ]
    )

# ==========================================================
# ACCOUNT INDEXES
# ==========================================================

async def create_all_account_indexes() -> None:
    db = get_app_database()
    accounts = await db.accounts.find(
        {"is_deleted": False},
        {"_id": 1}
    ).to_list(length=None)

    for account in accounts:
        account_id = str(account.get("_id", "")).strip()
        if not account_id:
            continue

        try:
            await create_account_indexes(account_id)
        except PyMongoError as error:
            print(
                "Impossible de mettre a jour les index du compte "
                f"{account_id}: {error}"
            )


async def create_account_indexes(
    account_id: str
):

    db = get_account_database(
        account_id
    )

    # Users

    await db.users.create_index(
        "normalized_email",
        unique=True
    )

    # Roles

    await db.roles.create_index(
        "normalized_name",
        unique=True,
        partialFilterExpression={
            "normalized_name": {"$type": "string"}
        }
    )

    # Servers

    ip_index = (await db.servers.index_information()).get("ip_1")
    expected_ip_filter = {"is_deleted": False}
    if ip_index and ip_index.get("partialFilterExpression") != expected_ip_filter:
        await db.servers.drop_index("ip_1")

    await db.servers.create_index(
        "ip",
        unique=True,
        partialFilterExpression=expected_ip_filter
    )

    await db.servers.create_index(
        "name"
    )

    # Metrics legacy
    # Les nouvelles métriques sont stockées et indexées dans une base dédiée
    # par serveur. Les anciennes collections de compte restent lues en fallback.

    # Alerts

    await db.alerts.create_index(
        [
            ("server_id", 1),
            ("created_at", -1)
        ]
    )

    # Chat history

    await db.chat_messages.create_index(
        [
            ("user_id", 1),
            ("created_at", -1)
        ]
    )

    await db.chat_messages.create_index(
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
