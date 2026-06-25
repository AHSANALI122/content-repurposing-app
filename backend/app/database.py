"""Database engine + session dependency.

Neon scales to zero, so the engine uses ``pool_pre_ping`` to avoid handing out
dead connections. We also normalize the connection URL to the ``psycopg`` (v3)
driver, since Neon/Postgres URLs are commonly given as plain ``postgresql://``.
"""
from __future__ import annotations

from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings


def _normalize_db_url(url: str) -> str:
    """Ensure SQLAlchemy uses the psycopg (v3) driver.

    Accepts ``postgresql://`` / ``postgres://`` and rewrites to
    ``postgresql+psycopg://``. Leaves an explicit ``+driver`` untouched.
    """
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    return url


engine = create_engine(
    _normalize_db_url(settings.database_url),
    pool_pre_ping=True,
)


def init_db() -> None:
    """Create tables on startup.

    v1 auto-creates tables; switch to Alembic before evolving a live schema.
    Importing models here ensures they're registered on SQLModel.metadata.
    """
    from app import models  # noqa: F401  (register tables)

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
