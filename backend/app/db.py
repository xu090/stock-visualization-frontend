from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row

from app.config import POSTGRES_DSN


@contextmanager
def get_conn(autocommit: bool = False) -> Iterator[psycopg.Connection]:
    # 这里使用短连接，保持当前项目实现简单直接。
    conn = psycopg.connect(POSTGRES_DSN, row_factory=dict_row, autocommit=autocommit)
    try:
        yield conn
    finally:
        conn.close()
