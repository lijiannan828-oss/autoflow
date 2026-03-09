from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator, Sequence

import psycopg
from psycopg.rows import dict_row

from .env import get_env


@dataclass(frozen=True, slots=True)
class DatabaseConfig:
    host: str
    port: int
    dbname: str
    user: str
    password: str
    sslmode: str = "disable"


def get_database_config() -> DatabaseConfig:
    missing = [
        key
        for key in ("PG_HOST", "PG_PORT", "PG_DATABASE", "PG_USER", "PG_PASSWORD")
        if not get_env(key)
    ]
    if missing:
        raise RuntimeError(f"missing database env vars: {', '.join(missing)}")

    return DatabaseConfig(
        host=get_env("PG_HOST") or "",
        port=int(get_env("PG_PORT") or "5432"),
        dbname=get_env("PG_DATABASE") or "",
        user=get_env("PG_USER") or "",
        password=get_env("PG_PASSWORD") or "",
        sslmode=get_env("PG_SSLMODE") or "disable",
    )


@contextmanager
def get_connection() -> Iterator[psycopg.Connection[Any]]:
    config = get_database_config()
    connection = psycopg.connect(
        host=config.host,
        port=config.port,
        dbname=config.dbname,
        user=config.user,
        password=config.password,
        sslmode=config.sslmode,
        row_factory=dict_row,
    )
    try:
        yield connection
    finally:
        connection.close()


def fetch_all(query: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(query, params or ())
        return list(cursor.fetchall())


def fetch_one(query: str, params: Sequence[Any] | None = None) -> dict[str, Any] | None:
    rows = fetch_all(query, params)
    return rows[0] if rows else None


def fetch_value(query: str, params: Sequence[Any] | None = None) -> Any:
    row = fetch_one(query, params)
    if row is None:
        return None
    return next(iter(row.values()))


def execute(query: str, params: Sequence[Any] | None = None) -> None:
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(query, params or ())
        connection.commit()


def execute_returning_one(
    query: str,
    params: Sequence[Any] | None = None,
) -> dict[str, Any] | None:
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(query, params or ())
        row = cursor.fetchone()
        connection.commit()
        return row


def execute_returning_all(
    query: str,
    params: Sequence[Any] | None = None,
) -> list[dict[str, Any]]:
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(query, params or ())
        rows = list(cursor.fetchall())
        connection.commit()
        return rows
