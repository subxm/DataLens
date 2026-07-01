import os
import httpx
import logging
from dotenv import load_dotenv

# Load env variables
load_dotenv()

logger = logging.getLogger(__name__)

def generate_fallback_narration(analysis: dict) -> str:
    """Generates a structured, rule-based narration report if the Groq API fails."""
    overview = analysis.get("overview", {})
    missing_vals = analysis.get("missing_values", {})
    distributions = analysis.get("distributions", {})
    correlation = analysis.get("correlation", {})
    outliers = analysis.get("outliers", {})
    class_balance = analysis.get("class_balance", {})
    
    rows = overview.get("rows", 0)
    cols = overview.get("cols", 0)
    mem = overview.get("memory_friendly", "N/A")
    
    markdown = []
    markdown.append("# Data Audit Report (Rule-Based Fallback)")
    markdown.append(f"**Overview:** The dataset contains **{rows:,} records** and **{cols:,} features**, occupying approximately **{mem}** in memory.")
    
    warnings = []
    successes = []
    
    # Missing values check
    total_missing = missing_vals.get("total_missing_cells", 0)
    missing_pct = missing_vals.get("overall_missing_pct", 0.0)
    if total_missing > 0:
        warnings.append(f"**[Missing Data]** Found **{total_missing:,} missing values** ({missing_pct:.2f}% of all cells). Imputation or column pruning is required.")
    else:
        successes.append("**[Missing Data]** Data completeness is at 100% with zero missing values detected.")
        
    # Multicollinearity check
    corr_warnings = correlation.get("warnings", [])
    if corr_warnings:
        warnings.append(f"**[Collinearity]** Found **{len(corr_warnings)} pair(s)** of highly correlated features (|r| > 0.8) indicating high multicollinearity risk.")
        for cw in corr_warnings:
            warnings.append(f"  - `{cw['col1']}` and `{cw['col2']}` are correlated at **{cw['correlation']:.2f}**.")
    else:
        successes.append("**[Collinearity]** No extreme correlation pairs (|r| > 0.8) detected among numerical variables.")

    # Skewness check
    skewed_cols = []
    for col, data in distributions.items():
        skew_flag = data.get("flags", {}).get("skewness_flag", "")
        if "Skewed" in skew_flag:
            skewed_cols.append((col, skew_flag, data["stats"]["skewness"]))
            
    if skewed_cols:
        warnings.append(f"**[Distribution]** Detected **{len(skewed_cols)} skewed numeric features** that might require transformation.")
        for col, flag, val in skewed_cols[:5]:
            warnings.append(f"  - `{col}` is **{flag.lower()}** (skew = {val:.2f})")
        if len(skewed_cols) > 5:
            warnings.append(f"  - ... and {len(skewed_cols) - 5} more columns.")
            
    # Outliers check
    outlier_rows = outliers.get("total_flagged_rows", 0)
    outlier_pct = outliers.get("total_flagged_percentage", 0.0)
    if outlier_rows > 0:
        warnings.append(f"**[Anomalies]** **{outlier_rows:,} rows ({outlier_pct:.2f}%)** contain at least one numerical outlier (based on IQR or Z-score > 3).")
    else:
        successes.append("**[Anomalies]** No significant numerical outliers detected.")

    # Class balance check
    imbalanced_cols = []
    for col, data in class_balance.items():
        flag = data.get("flags", {}).get("imbalance_flag", "")
        if "Imbalance" in flag:
            imbalanced_cols.append((col, flag))
            
    if imbalanced_cols:
        warnings.append(f"**[Class Balance]** Potential imbalance in **{len(imbalanced_cols)} categorical fields**.")
        for col, flag in imbalanced_cols[:5]:
            warnings.append(f"  - `{col}`: {flag}")
            
    markdown.append("\n## Data Quality Audits & Alerts")
    if warnings:
        markdown.append("The following data quality issues were flagged by the pipeline:")
        for w in warnings:
            markdown.append(w)
    else:
        markdown.append("No critical data quality issues were flagged by the automated audit.")
        
    if successes:
        markdown.append("\n### System Quality Highlights:")
        for s in successes:
            markdown.append(s)

    # 3. Actionable Preparation Steps
    markdown.append("\n## Recommended Engineering & Processing Pipeline")
    markdown.append("Suggested processing pipeline based on statistical features:")
    
    has_imputations = False
    for col, data in missing_vals.get("columns", {}).items():
        if data.get("count", 0) > 0:
            markdown.append(f"- **`{col}`**: {data['suggestion']}")
            has_imputations = True
    if not has_imputations:
        markdown.append("- No missing values found; no imputation actions needed.")
        
    if skewed_cols:
        markdown.append("- **Scale & Transform**: Apply Logarithmic, Square Root, or Box-Cox transformations to highly skewed columns to make their distributions more Gaussian before feeding them into linear models.")
    if outlier_rows > 0:
        markdown.append("- **Outlier Treatment**: Evaluate flagged outlier rows. If they represent data entry errors, they should be removed. If they are natural extremes, consider using robust scaling (e.g. RobustScaler) or tree-based algorithms less sensitive to outliers.")
    if corr_warnings:
        markdown.append("- **Dimensionality Reduction**: For multicollinear columns, consider removing one of the correlated pairs, combining them via Ratio/Difference engineering, or using Principal Component Analysis (PCA).")

    return "\n".join(markdown)

async def generate_narration(analysis: dict) -> str:
    """Sends the analysis payload to the Groq API to generate an AI narrative report.
    Falls back gracefully if the API is offline or the key is not set."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY environment variable is missing. Falling back to rule-based narration.")
        return generate_fallback_narration(analysis)

    # Construct the JSON summary to pass to the model (stripping heavy charts to conserve tokens)
    clean_analysis = {
        "overview": {
            "rows": analysis["overview"]["rows"],
            "cols": analysis["overview"]["cols"],
            "memory": analysis["overview"]["memory_friendly"],
            "columns": analysis["overview"]["columns"]
        },
        "missing_values": {
            "total_missing": analysis["missing_values"]["total_missing_cells"],
            "overall_pct": analysis["missing_values"]["overall_missing_pct"],
            "columns": {col: {"count": data["count"], "pct": data["percentage"]} for col, data in analysis["missing_values"]["columns"].items() if data["count"] > 0}
        },
        "skewed_columns": [
            {"col": col, "skew": data["stats"]["skewness"], "kurtosis": data["stats"]["kurtosis"], "flag": data["flags"]["skewness_flag"]}
            for col, data in analysis.get("distributions", {}).items() if "Skewed" in data["flags"]["skewness_flag"]
        ],
        "multicollinearity_warnings": analysis.get("correlation", {}).get("warnings", []),
        "outlier_summary": {
            "total_flagged_rows": analysis["outliers"]["total_flagged_rows"],
            "percentage": analysis["outliers"]["total_flagged_percentage"],
            "columns": {col: {"iqr_count": data["iqr_count"], "z_count": data["z_count"]} for col, data in analysis["outliers"]["columns"].items() if data["total_distinct_count"] > 0}
        },
        "class_imbalance": [
            {"col": col, "majority_pct": data["majority_percentage"], "flag": data["flags"]["imbalance_flag"]}
            for col, data in analysis.get("class_balance", {}).items() if "Imbalance" in data["flags"]["imbalance_flag"]
        ]
    }

    # Professional business prompt
    system_prompt = (
        "You are an expert McKinsey & Company senior analytics consultant and data auditor. "
        "Your task is to write a highly professional, objective, formal executive report summarizing the data profile. "
        "Translate statistical flags (multicollinearity, skewness, outliers, missingness, class imbalance) into clear business implications and technical data prep steps. "
        "Guidelines:\n"
        "1. Write in a formal, analytical, expert corporate voice. Do NOT use conversational padding (e.g., 'Sure, here is...', 'Based on the JSON...', 'As you can see...').\n"
        "2. Do NOT use any emojis (like 🔴, 🟡, 💚, 📊, etc.) in the headings or body of your report.\n"
        "3. Focus on explaining what the statistics imply for feature engineering and downstream modeling (e.g. linear models vs tree-based models).\n"
        "4. Always present facts objectively and keep descriptions concise. No fluff."
    )

    user_content = (
        f"Please analyze this structured dataset summary and write a comprehensive report.\n\n"
        f"DATASET SUMMARY JSON:\n"
        f"```json\n"
        f"{clean_analysis}\n"
        f"```\n\n"
        f"Please structure your report exactly into the following sections:\n"
        f"1. **Executive Summary** - Brief explanation of the dataset size, column types, and overall structure.\n"
        f"2. **Data Health Audit** - Detail issues regarding missing values, outliers, multicollinearity, and class imbalance. Explicitly call out warnings using text tags like '[Warning]' or '[Caution]'.\n"
        f"3. **Interpretation of Distributions** - Explain what the skewness and kurtosis flags mean for the numerical columns.\n"
        f"4. **Actionable Recommendations** - Specific guidance for data preparation, imputation, scaling, and feature engineering based on these findings."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.2
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
                
            logger.error(f"Groq API returned error status {response.status_code}: {response.text}")
            logger.info("Attempting fallback call to llama-3-8b-8192 on Groq...")
            
            response_fallback = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.2
                }
            )
            if response_fallback.status_code == 200:
                result = response_fallback.json()
                return result["choices"][0]["message"]["content"]
            
    except Exception as e:
        logger.error(f"Exception during Groq narration generation: {str(e)}")
        
    logger.warning("Groq narration generation failed completely. Reverting to rule-based fallback narration.")
    return generate_fallback_narration(analysis)
