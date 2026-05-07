"""Database setup — SQLite for dev, PostgreSQL for prod."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tender_eval.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def init_db():
    from app.models import Tender, Criterion, Bidder, BidderDocument, EvaluationResult
    Base.metadata.create_all(bind=engine)
    _ensure_new_columns()


def _ensure_new_columns():
    """Idempotently add columns introduced after the original schema (SQLite ALTER TABLE)."""
    from sqlalchemy import text

    # Map: table_name -> [(column_name, DDL_for_add)]
    additions = {
        "criteria": [
            ("is_mandatory", "is_mandatory BOOLEAN DEFAULT 1"),
            ("evidence_documents", "evidence_documents TEXT"),
        ],
    }
    with engine.begin() as conn:
        for table, cols in additions.items():
            try:
                existing = {
                    row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")
                }
            except Exception:
                existing = set()
            for col_name, ddl in cols:
                if col_name in existing:
                    continue
                try:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {ddl}")
                except Exception:
                    # Non-SQLite or already-added — fine
                    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
