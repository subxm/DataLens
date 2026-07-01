import os
import uuid
import logging
import io
import json
import pandas as pd
import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Dict, Any

from .analyzer import analyze_dataframe
from .narration import generate_narration
from .pdf_generator import generate_pdf_report
from .database import init_db, save_analysis, get_history, get_analysis_details, delete_analysis

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DataLens API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary upload storage directory
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    """Triggers database table initialization on startup."""
    init_db()

class GoogleLoginRequest(BaseModel):
    credential: str

class PDFExportRequest(BaseModel):
    analysis: Dict[str, Any]
    narration: str

@app.get("/api")
async def root():
    return {
        "message": "Welcome to the DataLens API!",
        "health_check": "/api/health",
        "frontend_url": "http://localhost:5173"
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "DataLens API is running."}

@app.get("/api/auth/config")
async def get_auth_config():
    """Returns the Google Client ID to the frontend."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    return {"client_id": client_id}

async def verify_google_token(token: str) -> dict:
    """Verifies a Google Identity ID Token against Google's tokeninfo endpoint."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token is missing.")
        
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
            if response.status_code != 200:
                logger.error(f"Google tokeninfo validation failed: {response.text}")
                raise HTTPException(status_code=401, detail="Invalid Google OAuth token.")
                
            info = response.json()
            # Verify token audience matches our Client ID
            if info.get("aud") != client_id:
                logger.error(f"Audience mismatch: expected {client_id}, got {info.get('aud')}")
                raise HTTPException(status_code=401, detail="Token audience client ID mismatch.")
                
            return {
                "email": info.get("email"),
                "name": info.get("name"),
                "picture": info.get("picture"),
                "google_id": info.get("sub")
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Exception verifying Google token: {str(e)}")
        raise HTTPException(status_code=401, detail="Token verification error.")

async def get_current_user(authorization: str = Header(None)) -> dict:
    """FastAPI Dependency to verify Google Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing Authorization header.")
    token = authorization.split(" ")[1]
    return await verify_google_token(token)

@app.post("/api/auth/google")
async def google_auth(request: GoogleLoginRequest):
    """Verifies frontend credentials and returns a user profile session."""
    user_info = await verify_google_token(request.credential)
    return user_info

@app.get("/api/history")
async def get_user_history(user: dict = Depends(get_current_user)):
    """Fetches past audits run by the logged-in user."""
    return get_history(user["email"])

@app.get("/api/history/{history_id}")
async def get_history_report(history_id: str, user: dict = Depends(get_current_user)):
    """Fetches the full stored analysis JSON and narration for a historical audit."""
    report = get_analysis_details(history_id, user["email"])
    if not report:
        raise HTTPException(status_code=404, detail="Historical report not found.")
    return report

@app.delete("/api/history/{history_id}")
async def delete_history_report(history_id: str, user: dict = Depends(get_current_user)):
    """Deletes an analysis report from the database."""
    success = delete_analysis(history_id, user["email"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete report from history.")
    return {"status": "success", "message": "Report deleted from history."}

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...), 
    user: dict = Depends(get_current_user)
):
    """Receives a CSV file, performs validation, saves it temporarily, and returns a 10-row preview."""
    # 1. Validate File Format
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV files are supported.")

    # 2. Check File Size (Limit to 50MB)
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > 50.0:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum size of 50MB. Uploaded: {file_size_mb:.2f}MB.")

    # 3. Read CSV for Preview
    try:
        df = pd.read_csv(io.BytesIO(contents), nrows=15)
    except Exception as e:
        logger.error(f"Error reading CSV file preview: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Could not parse CSV. Error: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")

    # 4. Generate Unique ID and Save File + JSON Metadata
    file_id = str(uuid.uuid4())
    temp_filepath = os.path.join(TEMP_DIR, f"{file_id}.csv")
    temp_meta_path = os.path.join(TEMP_DIR, f"{file_id}.json")
    
    try:
        with open(temp_filepath, "wb") as f:
            f.write(contents)
        with open(temp_meta_path, "w", encoding="utf-8") as f:
            json.dump({"filename": file.filename}, f)
    except Exception as e:
        logger.error(f"Failed to save temp file: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process file on the server.")

    # 5. Extract Preview Data
    preview_df = df.head(10).replace({pd.NA: None, float('nan'): None})
    preview_data = preview_df.to_dict(orient="records")
    columns = list(df.columns)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "size_mb": round(file_size_mb, 2),
        "columns": columns,
        "rows_preview_count": len(preview_data),
        "preview": preview_data
    }

@app.post("/api/analyze/{file_id}")
async def analyze_file(
    file_id: str, 
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Loads a cached CSV file by ID, runs the EDA pipeline, saves to Postgres/SQLite, and fetches Groq narration."""
    temp_filepath = os.path.join(TEMP_DIR, f"{file_id}.csv")
    temp_meta_path = os.path.join(TEMP_DIR, f"{file_id}.json")
    
    if not os.path.exists(temp_filepath):
        raise HTTPException(status_code=404, detail="The temporary uploaded file was not found on the server. Please re-upload your CSV file and try again.")

    # Load original filename from metadata cache
    filename = "dataset.csv"
    if os.path.exists(temp_meta_path):
        try:
            with open(temp_meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                filename = meta.get("filename", "dataset.csv")
        except Exception as e:
            logger.error(f"Failed to load temp metadata: {str(e)}")

    try:
        # Load the complete CSV
        df = pd.read_csv(temp_filepath)
    except Exception as e:
        logger.error(f"Failed to load cached CSV: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load file for analysis.")

    # Run analysis
    try:
        analysis_result = analyze_dataframe(df)
    except Exception as e:
        logger.error(f"Error running data analysis pipeline: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Data analysis pipeline failed: {str(e)}")

    # Run narration
    try:
        narration_text = await generate_narration(analysis_result)
    except Exception as e:
        logger.error(f"Error calling narration generator: {str(e)}")
        narration_text = "Failed to generate AI narration. Please check API key configuration."

    # Save to history database (PostgreSQL / SQLite fallback)
    try:
        row_count = analysis_result["overview"]["rows"]
        col_count = analysis_result["overview"]["cols"]
        missing_pct = analysis_result["missing_values"]["overall_missing_pct"]
        outlier_pct = analysis_result["outliers"]["total_flagged_percentage"]
        
        save_analysis(
            user_email=user["email"],
            filename=filename,
            row_count=row_count,
            col_count=col_count,
            missing_pct=missing_pct,
            outlier_pct=outlier_pct,
            analysis_data=analysis_result,
            narration_text=narration_text
        )
    except Exception as db_err:
        logger.error(f"Failed to persist report to database history: {str(db_err)}")

    # Add background task to clean up the uploaded files after sending the response
    def cleanup_file(path: str):
        try:
            if os.path.exists(path):
                os.remove(path)
            meta_path = path.replace(".csv", ".json")
            if os.path.exists(meta_path):
                os.remove(meta_path)
            logger.info(f"Cleaned up temporary upload files for: {path}")
        except Exception as e:
            logger.error(f"Error cleaning up temp file {path}: {str(e)}")

    background_tasks.add_task(cleanup_file, temp_filepath)

    return {
        "analysis": analysis_result,
        "narration": narration_text
    }

@app.post("/api/export-pdf")
async def export_pdf(request: PDFExportRequest):
    """Accepts analysis metrics and narration text, generates a ReportLab PDF, and returns a binary stream."""
    try:
        pdf_bytes = generate_pdf_report(request.analysis, request.narration)
    except Exception as e:
        logger.error(f"Failed to generate PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    filename = f"DataLens_Report_{uuid.uuid4().hex[:6]}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# Serve React static assets in production
from fastapi.staticfiles import StaticFiles
dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")

