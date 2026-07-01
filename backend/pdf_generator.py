import io
import re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def parse_markdown_to_reportlab_html(text: str) -> str:
    """Converts basic markdown tags to ReportLab paragraph HTML-like tags."""
    # Replace bold
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Replace italics
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    # Replace inline code backticks with courier font
    text = re.sub(r'`(.*?)`', r'<font name="Courier" color="#10B981">\1</font>', text)
    return text

def generate_pdf_report(analysis: dict, narration: str) -> bytes:
    """Generates a premium PDF report compiling EDA metrics, warnings, and AI narration."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom colors
    primary_color = colors.HexColor('#0F172A')  # Dark Slate 900
    accent_color = colors.HexColor('#10B981')   # Emerald Green
    secondary_color = colors.HexColor('#1E293B') # Slate 800
    text_color = colors.HexColor('#334155')      # Slate 700
    light_bg = colors.HexColor('#F8FAFC')        # Slate 50
    alert_red = colors.HexColor('#EF4444')       # Red
    alert_yellow = colors.HexColor('#F59E0B')    # Yellow
    
    # Custom typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        leading=14,
        textColor=accent_color,
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading2'],
        fontSize=15,
        leading=18,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading3'],
        fontSize=12,
        leading=15,
        textColor=secondary_color,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=text_color,
        spaceAfter=4
    )
    
    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.white,
        fontName='Helvetica-Bold'
    )

    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=text_color
    )

    story = []

    # 1. HEADER
    story.append(Paragraph("DataLens", title_style))
    story.append(Paragraph("Automated Exploratory Data Analysis & AI Narration Report", subtitle_style))
    
    # Horizontal line
    line_table = Table([[""]], colWidths=[540])
    line_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 2, accent_color),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0)
    ]))
    story.append(line_table)
    story.append(Spacer(1, 10))

    # 2. DATASET OVERVIEW
    story.append(Paragraph("1. Dataset Overview", h1_style))
    overview = analysis.get("overview", {})
    cols_count = len(overview.get("columns", []))
    
    overview_data = [
        [Paragraph("<b>Metric</b>", table_header_style), Paragraph("<b>Value</b>", table_header_style)],
        [Paragraph("Total Rows", table_body_style), Paragraph(f"{overview.get('rows', 0):,}", table_body_style)],
        [Paragraph("Total Columns", table_body_style), Paragraph(f"{overview.get('cols', 0):,}", table_body_style)],
        [Paragraph("Memory Occupied", table_body_style), Paragraph(overview.get("memory_friendly", "N/A"), table_body_style)]
    ]
    
    t_overview = Table(overview_data, colWidths=[200, 340])
    t_overview.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_overview)
    story.append(Spacer(1, 10))

    # 3. MISSING VALUES AUDIT
    story.append(Paragraph("2. Missing Values Audit", h1_style))
    missing_vals = analysis.get("missing_values", {})
    missing_cols = missing_vals.get("columns", {})
    
    missing_data = [
        [
            Paragraph("<b>Column Name</b>", table_header_style), 
            Paragraph("<b>Missing Count</b>", table_header_style), 
            Paragraph("<b>Percentage</b>", table_header_style),
            Paragraph("<b>Imputation Recommendation</b>", table_header_style)
        ]
    ]
    
    for col, data in missing_cols.items():
        # Clean formatting
        col_name = Paragraph(f"<b>{col}</b>", table_body_style)
        count_val = Paragraph(f"{data['count']:,}", table_body_style)
        pct_val = Paragraph(f"{data['percentage']:.2f}%", table_body_style)
        rec_val = Paragraph(data['suggestion'], table_body_style)
        
        # Color code missingness in table
        if data['percentage'] > 50.0:
            pct_val = Paragraph(f"<font color='{alert_red.hexval()}'><b>{data['percentage']:.2f}%</b></font>", table_body_style)
        elif data['percentage'] > 0.0:
            pct_val = Paragraph(f"<font color='{alert_yellow.hexval()}'><b>{data['percentage']:.2f}%</b></font>", table_body_style)
            
        missing_data.append([col_name, count_val, pct_val, rec_val])
        
    t_missing = Table(missing_data, colWidths=[120, 70, 70, 280])
    t_missing.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_missing)
    story.append(Spacer(1, 10))

    # 4. NUMERICAL DISTRIBUTIONS & OUTLIERS
    story.append(Paragraph("3. Distribution Profile & Outlier Checks", h1_style))
    distributions = analysis.get("distributions", {})
    outlier_summary = analysis.get("outliers", {})
    outlier_cols = outlier_summary.get("columns", {})
    
    numeric_data = [
        [
            Paragraph("<b>Feature</b>", table_header_style),
            Paragraph("<b>Mean ± Std</b>", table_header_style),
            Paragraph("<b>Median</b>", table_header_style),
            Paragraph("<b>Skewness</b>", table_header_style),
            Paragraph("<b>IQR Outliers</b>", table_header_style),
            Paragraph("<b>Z Outliers</b>", table_header_style)
        ]
    ]
    
    for col, data in distributions.items():
        stats_val = data.get("stats", {})
        flags_val = data.get("flags", {})
        out_info = outlier_cols.get(col, {"iqr_count": 0, "z_count": 0})
        
        feature_name = Paragraph(f"<b>{col}</b>", table_body_style)
        mean_std = Paragraph(f"{stats_val['mean']:.2f} ± {stats_val['std']:.2f}", table_body_style)
        median_val = Paragraph(f"{stats_val['median']:.2f}", table_body_style)
        
        # Skewness coloring
        skew_color = alert_red.hexval() if flags_val['skewness_color'] == 'Red' else (alert_yellow.hexval() if flags_val['skewness_color'] == 'Yellow' else accent_color.hexval())
        skew_text = Paragraph(f"<font color='{skew_color}'><b>{stats_val['skewness']:.2f}</b></font><br/>{flags_val['skewness_flag']}", table_body_style)
        
        # Outlier counts
        iqr_cnt = out_info['iqr_count']
        z_cnt = out_info['z_count']
        
        iqr_text = Paragraph(f"<font color='{alert_red.hexval() if iqr_cnt > 0 else text_color.hexval()}'>{iqr_cnt:,}</font>", table_body_style)
        z_text = Paragraph(f"<font color='{alert_red.hexval() if z_cnt > 0 else text_color.hexval()}'>{z_cnt:,}</font>", table_body_style)
        
        numeric_data.append([feature_name, mean_std, median_val, skew_text, iqr_text, z_text])
        
    if len(distributions) > 0:
        t_numeric = Table(numeric_data, colWidths=[110, 110, 70, 130, 60, 60])
        t_numeric.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), secondary_color),
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(t_numeric)
    else:
        story.append(Paragraph("No numerical columns found in the dataset.", body_style))
        
    story.append(Spacer(1, 10))

    # 5. MULTICOLLINEARITY WARNINGS
    story.append(Paragraph("4. Correlation & Collinearity Audit", h1_style))
    correlation = analysis.get("correlation", {})
    warnings_list = correlation.get("warnings", [])
    
    if warnings_list:
        story.append(Paragraph("The following highly correlated feature pairs have been flagged:", body_style))
        for w in warnings_list:
            text = f"• 🔴 <b>{w['col1']}</b> and <b>{w['col2']}</b>: Pearson correlation coefficient = <b>{w['correlation']:.2f}</b>. {w['message']}"
            story.append(Paragraph(text, bullet_style))
    else:
        story.append(Paragraph("💚 No severe feature collinearity issues found. All numerical columns have Pearson correlation coefficients |r| &lt; 0.8.", body_style))
        
    story.append(Spacer(1, 10))

    # 6. CATEGORICAL CLASS BALANCE
    story.append(Paragraph("5. Categorical Class Balance Audit", h1_style))
    class_balance = analysis.get("class_balance", {})
    
    if class_balance:
        balance_data = [
            [
                Paragraph("<b>Column Name</b>", table_header_style),
                Paragraph("<b>Unique Classes</b>", table_header_style),
                Paragraph("<b>Majority Class Size</b>", table_header_style),
                Paragraph("<b>Status / Warning</b>", table_header_style)
            ]
        ]
        
        for col, data in class_balance.items():
            col_name = Paragraph(f"<b>{col}</b>", table_body_style)
            uniques = Paragraph(f"{data['unique_count']:,}", table_body_style)
            maj_pct = Paragraph(f"{data['majority_percentage']:.1f}%", table_body_style)
            
            flag = data.get("flags", {}).get("imbalance_flag", "Balanced")
            color_str = alert_red.hexval() if data.get("flags", {}).get("imbalance_color") == 'Red' else (alert_yellow.hexval() if data.get("flags", {}).get("imbalance_color") == 'Yellow' else accent_color.hexval())
            flag_text = Paragraph(f"<font color='{color_str}'><b>{flag}</b></font>", table_body_style)
            
            balance_data.append([col_name, uniques, maj_pct, flag_text])
            
        t_balance = Table(balance_data, colWidths=[130, 80, 110, 220])
        t_balance.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), secondary_color),
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(t_balance)
    else:
        story.append(Paragraph("No categorical or low-cardinality columns analyzed.", body_style))

    # 7. AI NARRATION SECTION (Start on new page)
    story.append(PageBreak())
    story.append(Paragraph("DataLens - AI Narration", title_style))
    story.append(Paragraph("Executive insights and interpretation powered by Groq API", subtitle_style))
    story.append(line_table)
    story.append(Spacer(1, 15))
    story.append(Paragraph("6. AI Analytical Insights Report Card", h1_style))
    
    # Parse the markdown narration text and add as Flowables
    narration_lines = narration.split("\n")
    for line in narration_lines:
        line_strip = line.strip()
        if not line_strip:
            story.append(Spacer(1, 4))
            continue
            
        parsed_line = parse_markdown_to_reportlab_html(line_strip)
        
        # Check markdown headings
        if line_strip.startswith("# "):
            header_text = line_strip[2:]
            story.append(Paragraph(parse_markdown_to_reportlab_html(header_text), h1_style))
        elif line_strip.startswith("## "):
            header_text = line_strip[3:]
            story.append(Paragraph(parse_markdown_to_reportlab_html(header_text), h2_style))
        elif line_strip.startswith("### "):
            header_text = line_strip[4:]
            story.append(Paragraph(f"<b>{parse_markdown_to_reportlab_html(header_text)}</b>", h2_style))
        elif line_strip.startswith("- ") or line_strip.startswith("* "):
            bullet_text = line_strip[2:]
            story.append(Paragraph(f"• {bullet_text}", bullet_style))
        elif re.match(r'^\d+\.\s', line_strip):
            # Numbered list
            list_text = re.sub(r'^\d+\.\s', '', line_strip)
            story.append(Paragraph(list_text, bullet_style))
        else:
            story.append(Paragraph(parsed_line, body_style))
            
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
