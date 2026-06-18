"""
Supabase Database Client Module
Handles all database connections and operations
"""
from supabase import create_client, Client
from ..config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Supabase client wrapper with connection management"""
    
    _instance: Optional[Client] = None
    _service_instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        """Get Supabase client with anon key (for RLS-protected queries)"""
        if cls._instance is None:
            cls._instance = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_ANON_KEY
            )
        return cls._instance
    
    @classmethod
    def get_service_client(cls) -> Client:
        """Get Supabase client with service role key (bypasses RLS)"""
        if cls._service_instance is None:
            cls._service_instance = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY
            )
        return cls._service_instance
    
    @classmethod
    def get_auth_client(cls):
        """Get Supabase auth client"""
        return cls.get_client().auth


# Convenience functions
def get_db() -> Client:
    """Get database client for dependency injection"""
    return SupabaseClient.get_client()


def get_service_db() -> Client:
    """Get service database client for admin operations"""
    return SupabaseClient.get_service_client()


# Database operations helper
class DatabaseOperations:
    """Helper class for common database operations"""
    
    def __init__(self, use_service_role: bool = False):
        self.client = get_service_db() if use_service_role else get_db()
    
    def insert(self, table: str, data: dict) -> dict:
        """Insert a record into a table"""
        try:
            result = self.client.table(table).insert(data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Insert error in {table}: {e}")
            raise
    
    def select(self, table: str, columns: str = "*", filters: dict = None) -> list:
        """Select records from a table"""
        try:
            query = self.client.table(table).select(columns)
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            result = query.execute()
            return result.data
        except Exception as e:
            logger.error(f"Select error in {table}: {e}")
            raise
    
    def select_one(self, table: str, columns: str = "*", filters: dict = None) -> Optional[dict]:
        """Select a single record from a table"""
        try:
            query = self.client.table(table).select(columns)
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            result = query.limit(1).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Select one error in {table}: {e}")
            raise
    
    def update(self, table: str, data: dict, filters: dict) -> dict:
        """Update records in a table"""
        try:
            query = self.client.table(table).update(data)
            for key, value in filters.items():
                query = query.eq(key, value)
            result = query.execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Update error in {table}: {e}")
            raise
    
    def delete(self, table: str, filters: dict) -> bool:
        """Delete records from a table"""
        try:
            query = self.client.table(table).delete()
            for key, value in filters.items():
                query = query.eq(key, value)
            query.execute()
            return True
        except Exception as e:
            logger.error(f"Delete error in {table}: {e}")
            raise
    
    def upsert(self, table: str, data: dict) -> dict:
        """Upsert a record into a table"""
        try:
            result = self.client.table(table).upsert(data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Upsert error in {table}: {e}")
            raise
