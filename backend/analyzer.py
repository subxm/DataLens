import pandas as pd
import numpy as np
from scipy import stats
import json
import plotly.express as px
import plotly.graph_objects as go
import plotly.utils

def get_memory_friendly(num_bytes):
    """Formats bytes into human readable format (KB, MB, GB)."""
    for unit in ['Bytes', 'KB', 'MB', 'GB']:
        if num_bytes < 1024.0:
            return f"{num_bytes:.2f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.2f} TB"

def analyze_dataframe(df: pd.DataFrame) -> dict:
    """Runs a complete structured analytical pipeline on a pandas DataFrame."""
    # 1. Dataset Overview
    total_rows = int(df.shape[0])
    total_cols = int(df.shape[1])
    
    if total_rows == 0:
        return {
            "overview": {
                "rows": 0, "cols": total_cols, "memory_bytes": 0, "memory_friendly": "0 Bytes",
                "columns": []
            },
            "error": "Dataset is empty"
        }
        
    memory_bytes = int(df.memory_usage(deep=True).sum())
    memory_friendly = get_memory_friendly(memory_bytes)
    
    columns_info = []
    numeric_cols = []
    categorical_cols = []
    
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        col_type = "other"
        
        # Check if numeric
        if pd.api.types.is_numeric_dtype(df[col].dtype) and not pd.api.types.is_bool_dtype(df[col].dtype):
            col_type = "numeric"
            numeric_cols.append(col)
        elif pd.api.types.is_bool_dtype(df[col].dtype):
            col_type = "boolean"
        elif pd.api.types.is_datetime64_any_dtype(df[col].dtype) or (df[col].astype(str).str.match(r'^\d{4}-\d{2}-\d{2}').all() and not df[col].isna().all()):
            col_type = "datetime"
        else:
            col_type = "categorical"
            categorical_cols.append(col)
            
        columns_info.append({
            "name": str(col),
            "dtype": dtype_str,
            "class": col_type
        })

    # 2. Missing Values Analysis
    missing_analysis = {}
    total_missing_cells = 0
    
    # Check for empty columns
    for col in df.columns:
        missing_count = int(df[col].isna().sum())
        total_missing_cells += missing_count
        missing_pct = float((missing_count / total_rows) * 100)
        
        # Suggest imputation
        imputation_suggestion = "No missing values; no imputation needed."
        if missing_count > 0:
            if missing_pct > 50.0:
                imputation_suggestion = "Consider dropping this column (missingness > 50%)."
            elif col in numeric_cols:
                # Calculate skew of non-missing values
                non_nulls = df[col].dropna()
                if len(non_nulls) > 2:
                    skew_val = float(non_nulls.skew())
                    if abs(skew_val) > 1.0:
                        imputation_suggestion = f"Median Imputation (highly skewed, skew={skew_val:.2f})."
                    else:
                        imputation_suggestion = f"Mean Imputation (approximately symmetric, skew={skew_val:.2f})."
                else:
                    imputation_suggestion = "Median Imputation (insufficient data for skewness calculation)."
            else:
                imputation_suggestion = "Mode Imputation (fill with the most frequent value) or impute as a new 'Missing' category."
                
        missing_analysis[str(col)] = {
            "count": missing_count,
            "percentage": missing_pct,
            "suggestion": imputation_suggestion
        }
        
    # Missingness Heatmap
    # Downsample rows to at most 150 rows to keep JSON small and frontend fast
    step = max(1, total_rows // 150)
    df_sampled = df.iloc[::step][:150]
    
    # Create missingness grid
    missing_grid = df_sampled.isna().astype(int).values.T.tolist()  # (cols, rows)
    missing_heatmap_fig = go.Figure(data=go.Heatmap(
        z=missing_grid,
        x=[f"Row {i*step}" for i in range(len(df_sampled))],
        y=list(df.columns),
        colorscale=[[0, '#1E293B'], [1, '#EF4444']],
        showscale=False,
        hoverinfo="x+y"
    ))
    missing_heatmap_fig.update_layout(
        title="Missing Values Distribution Map (Red indicates missing)",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(color='#E2E8F0'),
        margin=dict(l=100, r=20, t=40, b=40),
        height=max(250, 40 + len(df.columns) * 25)
    )
    missing_heatmap_json = json.loads(plotly.io.to_json(missing_heatmap_fig))

    # 3. Distribution Panel
    distributions = {}
    for col in numeric_cols:
        non_nulls = df[col].dropna()
        if len(non_nulls) == 0:
            continue
            
        mean_val = float(non_nulls.mean())
        median_val = float(non_nulls.median())
        std_val = float(non_nulls.std()) if len(non_nulls) > 1 else 0.0
        min_val = float(non_nulls.min())
        max_val = float(non_nulls.max())
        
        skew_val = 0.0
        kurt_val = 0.0
        skew_flag = "Approximately Symmetric"
        skew_color = "Green"  # Green
        skew_alert_level = 0
        
        kurt_flag = "Normal Tails (Mesokurtic)"
        kurt_color = "Green"
        kurt_alert_level = 0
        
        if len(non_nulls) > 2:
            skew_val = float(non_nulls.skew())
            kurt_val = float(non_nulls.kurtosis())
            
            # Skewness flag
            if skew_val > 1.0:
                skew_flag = "Highly Skewed Right"
                skew_color = "Red"
                skew_alert_level = 2
            elif skew_val < -1.0:
                skew_flag = "Highly Skewed Left"
                skew_color = "Red"
                skew_alert_level = 2
            elif 0.5 < skew_val <= 1.0:
                skew_flag = "Moderately Skewed Right"
                skew_color = "Yellow"
                skew_alert_level = 1
            elif -1.0 <= skew_val < -0.5:
                skew_flag = "Moderately Skewed Left"
                skew_color = "Yellow"
                skew_alert_level = 1
                
            # Kurtosis flag
            if kurt_val > 2.0:
                kurt_flag = "Heavy Tails (Leptokurtic - Outlier Prone)"
                kurt_color = "Yellow"
                kurt_alert_level = 1
            elif kurt_val < -1.2:
                kurt_flag = "Light Tails (Platykurtic - Flat/Uniform)"
                kurt_color = "Yellow"
                kurt_alert_level = 1
                
        # Generate Plotly histogram JSON
        fig = px.histogram(
            df, x=col, 
            color_discrete_sequence=['#10B981'], 
            template="plotly_dark",
            marginal="box"  # Adds a box plot on top for outlier visual
        )
        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#E2E8F0'),
            margin=dict(l=40, r=20, t=20, b=40),
            height=250
        )
        hist_json = json.loads(plotly.io.to_json(fig))
        
        distributions[str(col)] = {
            "stats": {
                "mean": mean_val,
                "median": median_val,
                "std": std_val,
                "min": min_val,
                "max": max_val,
                "skewness": skew_val,
                "kurtosis": kurt_val
            },
            "flags": {
                "skewness_flag": skew_flag,
                "skewness_color": skew_color,
                "skewness_alert_level": skew_alert_level,
                "kurtosis_flag": kurt_flag,
                "kurtosis_color": kurt_color,
                "kurtosis_alert_level": kurt_alert_level
            },
            "plot": hist_json
        }

    # 4. Correlation Matrix
    correlation_data = {
        "matrix": {},
        "warnings": [],
        "plot": None
    }
    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr().fillna(0.0)
        
        # Build matrix dict for JSON response
        for col_i in corr_matrix.index:
            correlation_data["matrix"][str(col_i)] = {}
            for col_j in corr_matrix.columns:
                correlation_data["matrix"][str(col_i)][str(col_j)] = float(corr_matrix.loc[col_i, col_j])
                
        # Multicollinearity warnings
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                c1, c2 = numeric_cols[i], numeric_cols[j]
                val = corr_matrix.loc[c1, c2]
                if abs(val) > 0.8:
                    correlation_data["warnings"].append({
                        "col1": str(c1),
                        "col2": str(c2),
                        "correlation": float(val),
                        "severity": "Red" if abs(val) > 0.9 else "Yellow",
                        "message": f"High correlation ({val:.2f}) between '{c1}' and '{c2}' may cause multicollinearity issues."
                    })
                    
        # Generate Heatmap
        corr_fig = go.Figure(data=go.Heatmap(
            z=corr_matrix.values,
            x=list(corr_matrix.columns),
            y=list(corr_matrix.index),
            colorscale='RdBu',
            zmin=-1, zmax=1,
            text=np.round(corr_matrix.values, 2),
            texttemplate="%{text}",
            hoverinfo="x+y+z"
        ))
        corr_fig.update_layout(
            title="Pearson Correlation Matrix Heatmap",
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#E2E8F0'),
            margin=dict(l=100, r=40, t=50, b=50),
            height=max(350, 100 + len(numeric_cols) * 30)
        )
        correlation_data["plot"] = json.loads(plotly.io.to_json(corr_fig))

    # 5. Outlier Detection
    outliers = {}
    all_outlier_rows = set()
    
    for col in numeric_cols:
        non_nulls = df[col].dropna()
        if len(non_nulls) < 4:
            continue
            
        # IQR Method
        q1 = float(non_nulls.quantile(0.25))
        q3 = float(non_nulls.quantile(0.75))
        iqr = q3 - q1
        lower_iqr = q1 - 1.5 * iqr
        upper_iqr = q3 + 1.5 * iqr
        
        iqr_mask = (df[col] < lower_iqr) | (df[col] > upper_iqr)
        iqr_outliers_count = int(iqr_mask.sum())
        iqr_indices = df[iqr_mask].index.tolist()
        
        # Z-Score Method (using scipy.stats.zscore or numpy)
        mean_val = float(non_nulls.mean())
        std_val = float(non_nulls.std())
        
        z_outliers_count = 0
        z_indices = []
        if std_val > 0:
            z_scores = (df[col] - mean_val) / std_val
            z_mask = np.abs(z_scores) > 3.0
            z_outliers_count = int(z_mask.sum())
            z_indices = df[z_mask].index.tolist()
            
        # Combine outlier row indices for this column
        col_outlier_rows = set(iqr_indices).union(set(z_indices))
        all_outlier_rows.update(col_outlier_rows)
        
        outliers[str(col)] = {
            "iqr_bounds": {"lower": lower_iqr, "upper": upper_iqr},
            "iqr_count": iqr_outliers_count,
            "z_count": z_outliers_count,
            "total_distinct_count": len(col_outlier_rows),
            "percentage": float((len(col_outlier_rows) / total_rows) * 100)
        }
        
    outlier_summary = {
        "columns": outliers,
        "total_flagged_rows": len(all_outlier_rows),
        "total_flagged_percentage": float((len(all_outlier_rows) / total_rows) * 100) if total_rows > 0 else 0.0
    }

    # 6. Class Balance Panel (Categorical & Low Cardinality Numeric Columns)
    class_balance = {}
    
    # Columns to check for class balance: categorical columns + numeric columns with <= 10 unique values
    balance_cols = []
    for col in df.columns:
        unique_cnt = df[col].nunique()
        if col in categorical_cols:
            balance_cols.append((col, unique_cnt))
        elif col in numeric_cols and 1 < unique_cnt <= 10:
            balance_cols.append((col, unique_cnt))
            
    for col, unique_cnt in balance_cols:
        counts = df[col].value_counts(dropna=True)
        if len(counts) == 0:
            continue
            
        # Top 10 categories
        top_counts = counts.head(10)
        total_counts = float(counts.sum())
        
        cat_distribution = []
        for val, cnt in top_counts.items():
            cat_distribution.append({
                "value": str(val),
                "count": int(cnt),
                "percentage": float((cnt / total_counts) * 100)
            })
            
        # Detect Imbalance
        majority_pct = float((counts.iloc[0] / total_counts) * 100)
        imbalance_flag = "Balanced"
        imbalance_color = "Green"
        imbalance_alert_level = 0
        
        if majority_pct > 80.0:
            imbalance_flag = f"High Imbalance (Majority class '{counts.index[0]}' represents {majority_pct:.1f}%)"
            imbalance_color = "Red"
            imbalance_alert_level = 2
        elif majority_pct > 50.0 and len(counts) > 2:
            imbalance_flag = f"Moderate Imbalance (Majority class '{counts.index[0]}' represents {majority_pct:.1f}%)"
            imbalance_color = "Yellow"
            imbalance_alert_level = 1
            
        # Draw horizontal/vertical bar chart in Plotly
        fig = px.bar(
            x=[str(x) for x in top_counts.index], 
            y=top_counts.values,
            labels={"x": str(col), "y": "Count"},
            color_discrete_sequence=['#10B981'],
            template="plotly_dark"
        )
        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#E2E8F0'),
            margin=dict(l=40, r=20, t=20, b=40),
            height=250
        )
        bar_json = json.loads(plotly.io.to_json(fig))
        
        class_balance[str(col)] = {
            "unique_count": int(unique_cnt),
            "distribution": cat_distribution,
            "majority_percentage": majority_pct,
            "flags": {
                "imbalance_flag": imbalance_flag,
                "imbalance_color": imbalance_color,
                "imbalance_alert_level": imbalance_alert_level
            },
            "plot": bar_json
        }

    return {
        "overview": {
            "rows": total_rows,
            "cols": total_cols,
            "memory_bytes": memory_bytes,
            "memory_friendly": memory_friendly,
            "columns": columns_info
        },
        "missing_values": {
            "columns": missing_analysis,
            "total_missing_cells": total_missing_cells,
            "overall_missing_pct": float((total_missing_cells / (total_rows * total_cols)) * 100),
            "plot": missing_heatmap_json
        },
        "distributions": distributions,
        "correlation": correlation_data,
        "outliers": outlier_summary,
        "class_balance": class_balance
    }
