from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

from app.database.mongodb import (
    connect_to_mongo,
    close_mongo_connection,
)

# Controllers
from app.controllers.auth_controller import router as auth_router
from app.controllers.role_controller import router as role_router
from app.controllers.user_controller import router as user_router
from app.controllers.profile_controller import router as profile_router
from app.controllers.server_controller import router as server_router
from app.controllers.webhook_controller import router as webhook_router



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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://192.168.11.108:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(profile_router)
app.include_router(server_router)
app.include_router(webhook_router)
