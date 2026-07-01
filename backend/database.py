import os
import uuid
import logging
from datetime import datetime
import json

logger = logging.getLogger(__name__)

def get_db_connection():
    """Returns a connection object and the appropriate query placeholder ( %s for Postgres, ? for SQLite )."""
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres"):
        import psycopg2
        # Use psycopg2 to connect to PostgreSQL (Supabase)
        conn = psycopg2.connect(db_url)
        return conn, "%s"
    else:
        import sqlite3
        # Fallback to local SQLite database file
        sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "datalens.db")
        conn = sqlite3.connect(sqlite_path)
        return conn, "?"

def init_db():
    """Initializes the database schema if tables do not exist."""
    conn = None
    try:
        conn, p = get_db_connection()
        cursor = conn.cursor()
        
        # Create history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id VARCHAR(36) PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                row_count INTEGER NOT NULL,
                col_count INTEGER NOT NULL,
                missing_pct REAL NOT NULL,
                outlier_pct REAL NOT NULL,
                upload_time VARCHAR(50) NOT NULL,
                analysis_json TEXT NOT NULL,
                narration TEXT NOT NULL
            )
        """)
        
        # Add index on user_email for faster query retrieval
        # Note: SQLite and PostgreSQL both support CREATE INDEX IF NOT EXISTS
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_email ON analysis_history(user_email)")
        
        conn.commit()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
    finally:
        if conn:
            conn.close()

def save_analysis(user_email: str, filename: str, row_count: int, col_count: int, 
                  missing_pct: float, outlier_pct: float, analysis_data: dict, narration_text: str) -> str:
    """Saves a completed analysis run to the history database."""
    conn = None
    try:
        conn, p = get_db_connection()
        cursor = conn.cursor()
        
        analysis_id = str(uuid.uuid4())
        upload_time = datetime.utcnow().isoformat() + "Z"
        analysis_json = json.dumps(analysis_data)
        
        query = f"""
            INSERT INTO analysis_history 
            (id, user_email, filename, row_count, col_count, missing_pct, outlier_pct, upload_time, analysis_json, narration) 
            VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
        """
        
        cursor.execute(query, (
            analysis_id, user_email, filename, row_count, col_count, 
            missing_pct, outlier_pct, upload_time, analysis_json, narration_text
        ))
        
        conn.commit()
        logger.info(f"Saved analysis {analysis_id} for user {user_email}")
        return analysis_id
    except Exception as e:
        logger.error(f"Failed to save analysis to DB: {str(e)}")
        raise e
    finally:
        if conn:
            conn.close()

def get_history(user_email: str) -> list:
    """Fetches list of past analyses for a specific user (excluding heavy JSON payloads)."""
    conn = None
    try:
        conn, p = get_db_connection()
        cursor = conn.cursor()
        
        query = f"""
            SELECT id, filename, row_count, col_count, missing_pct, outlier_pct, upload_time 
            FROM analysis_history 
            WHERE user_email = {p}
            ORDER BY upload_time DESC
        """
        cursor.execute(query, (user_email,))
        rows = cursor.fetchall()
        
        history_list = []
        for r in rows:
            history_list.append({
                "id": r[0],
                "filename": r[1],
                "row_count": r[2],
                "col_count": r[3],
                "missing_pct": r[4],
                "outlier_pct": r[5],
                "upload_time": r[6]
            })
        return history_list
    except Exception as e:
        logger.error(f"Failed to query history for user {user_email}: {str(e)}")
        return []
    finally:
        if conn:
            conn.close()

def get_analysis_details(analysis_id: str, user_email: str) -> dict:
    """Fetches the full details of a past analysis including stats JSON and narration."""
    conn = None
    try:
        conn, p = get_db_connection()
        cursor = conn.cursor()
        
        query = f"""
            SELECT filename, analysis_json, narration 
            FROM analysis_history 
            WHERE id = {p} AND user_email = {p}
        """
        cursor.execute(query, (analysis_id, user_email))
        row = cursor.fetchone()
        
        if not row:
            return None
            
        return {
            "filename": row[0],
            "analysis": json.loads(row[1]),
            "narration": row[2]
        }
    except Exception as e:
        logger.error(f"Failed to query details for analysis {analysis_id}: {str(e)}")
        return None
    finally:
        if conn:
            conn.close()

def delete_analysis(analysis_id: str, user_email: str) -> bool:
    """Deletes an analysis from the database."""
    conn = None
    try:
        conn, p = get_db_connection()
        cursor = conn.cursor()
        
        query = f"DELETE FROM analysis_history WHERE id = {p} AND user_email = {p}"
        cursor.execute(query, (analysis_id, user_email))
        
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to delete analysis {analysis_id}: {str(e)}")
        return False
    finally:
        if conn:
            conn.close()
