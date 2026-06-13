from datetime import (
    datetime,
    timedelta
)

from jose import jwt

from app.core.config import (
    get_settings
)


settings = get_settings()


def create_access_token(
    data: dict
):

    payload = data.copy()

    expire = (
        datetime.utcnow()
        + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload["exp"] = expire

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )