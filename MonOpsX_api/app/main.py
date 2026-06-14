from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database.mongodb import (
    connect_to_mongo,
    close_mongo_connection,
)

# Controllers
from app.controllers.auth_controller import router as auth_router
from app.controllers.role_controller import router as role_router
from app.controllers.user_controller import router as user_router
# from app.controllers.server_controller import router as server_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()

    print("✅ MongoDB connected")

    yield

    # Shutdown
    await close_mongo_connection()

    print("❌ MongoDB disconnected")


app = FastAPI(
    title="MonOpsX API",
    description="Server Monitoring Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Health Check
@app.get("/", tags=["Health"])
async def root():
    return {
        "application": "MonOpsX",
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "healthy"
    }


# Register routers here
app.include_router(auth_router)
app.include_router(role_router)
app.include_router(user_router)
# app.include_router(server_router)
