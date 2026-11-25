from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Expense
from .serializers import ExpenseSerializer
from .filters import ExpenseFilter
from apps.authentication.permissions import IsPremiumOrAdmin

class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsPremiumOrAdmin]
    filterset_class = ExpenseFilter
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['description']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)



import calendar
import csv
from decimal import Decimal
from io import BytesIO

from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.views import APIView

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.budgets.models import Budget
from apps.incomes.models import Income
from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# =====================================================================
# SECTION 9: REPORTS & EXPORT SYSTEM (HELPERS & EXPORT VIEWS)
# =====================================================================

def _format_date(raw_date):
    if not raw_date:
        return "N/A"
    if hasattr(raw_date, "strftime"):
        return raw_date.strftime("%d-%b-%Y")
    return str(raw_date)


def build_financial_report_data(user, month=None, year=None):
    """
    Aggregates monthly or all-time financial data for Excel, PDF, and CSV reports:
    - Financial summary (Income, Expense, Net Balance, Savings Rate)
    - Category-wise expense breakdown vs. monthly budget limits
    - Dedicated Expense History & Income History records
    """
    expenses_qs = Expense.objects.filter(user=user).order_by("-date", "-created_at")
    incomes_qs = Income.objects.filter(user=user).order_by("-date", "-created_at")
    budgets_qs = Budget.objects.filter(user=user)

    period_label = "All-Time Financial Statement"
    file_suffix = "all_time"

    if month and year:
        month_int = int(month)
        year_int = int(year)
        month_name = calendar.month_name[month_int]
        period_label = f"Monthly Financial Report - {month_name} {year_int}"
        file_suffix = f"{month_name.lower()}_{year_int}"

        expenses_qs = expenses_qs.filter(date__month=month_int, date__year=year_int)
        incomes_qs = incomes_qs.filter(date__month=month_int, date__year=year_int)
        budgets_qs = budgets_qs.filter(month=month_int, year=year_int)
    elif year:
        year_int = int(year)
        period_label = f"Annual Financial Report - {year_int}"
        file_suffix = f"year_{year_int}"

        expenses_qs = expenses_qs.filter(date__year=year_int)
        incomes_qs = incomes_qs.filter(date__year=year_int)
        budgets_qs = budgets_qs.filter(year=year_int)

    total_income = incomes_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    total_expense = expenses_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    net_balance = total_income - total_expense
    savings_rate = (
        round(float((net_balance / total_income) * Decimal("100.00")), 1)
        if total_income > Decimal("0.00")
        else 0.0
    )

    # Category-wise breakdown compared against budgets
    budget_map = {}
    for b in budgets_qs:
        budget_map[b.category] = budget_map.get(b.category, Decimal("0.00")) + b.monthly_limit

    category_totals = (
        expenses_qs.values("category")
        .annotate(spent=Sum("amount"))
        .order_by("-spent")
    )

    category_breakdown = []
    for row in category_totals:
        cat = row["category"]
        spent = row["spent"] or Decimal("0.00")
        limit = budget_map.get(cat, Decimal("0.00"))
        share_pct = (
            round(float((spent / total_expense) * Decimal("100.00")), 1)
            if total_expense > Decimal("0.00")
            else 0.0
        )
        category_breakdown.append({
            "category": cat,
            "spent": spent,
            "budget_limit": limit,
            "share_pct": share_pct,
        })

    expense_rows = [
        {
            "date_str": _format_date(e.date),
            "raw_date": str(e.date or ""),
            "category": e.category,
            "description": e.description or "-",
            "amount": e.amount,
        }
        for e in expenses_qs
    ]

    income_rows = [
        {
            "date_str": _format_date(i.date),
            "raw_date": str(i.date or ""),
            "source": i.source,
            "description": i.description or "-",
            "amount": i.amount,
        }
        for i in incomes_qs
    ]

    return {
        "period_label": period_label,
        "file_suffix": file_suffix,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_balance": net_balance,
        "savings_rate": savings_rate,
        "category_breakdown": category_breakdown,
        "expenses": expense_rows,
        "incomes": income_rows,
    }


class ExportTransactionsExcelView(APIView):
    """Exports a formatted 3-sheet native Excel workbook (.xlsx)."""
    permission_classes = [permissions.IsAuthenticated, IsPremiumOrAdmin]

    def get(self, request):
        data = build_financial_report_data(
            request.user,
            month=request.query_params.get("month"),
            year=request.query_params.get("year"),
        )

        wb = openpyxl.Workbook()

        # Shared Styles
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        sub_header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
        total_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
        white_bold = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        title_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
        bold_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )

        # ---------------------------------------------------------
        # SHEET 1: FINANCIAL SUMMARY & CATEGORY BREAKDOWN
        # ---------------------------------------------------------
        ws_summary = wb.active
        ws_summary.title = "Financial Summary"

        ws_summary["A1"] = f"BudgetBuddy - {data['period_label']}"
        ws_summary["A1"].font = title_font
        ws_summary["A2"] = f"User: {request.user.username} | Generated: {timezone.now().strftime('%d-%b-%Y')}"

        # Summary Table
        ws_summary.append([])
        ws_summary.append(["Metric", "Amount (INR)"])
        for cell in ws_summary[4]:
            cell.fill = header_fill
            cell.font = white_bold
            cell.alignment = Alignment(horizontal="center")

        summary_metrics = [
            ("Total Income", float(data["total_income"])),
            ("Total Expenses", float(data["total_expense"])),
            ("Net Balance", float(data["net_balance"])),
            ("Savings Rate (%)", f"{data['savings_rate']}%"),
        ]
        for label, val in summary_metrics:
            ws_summary.append([label, val])
            row_idx = ws_summary.max_row
            ws_summary.cell(row=row_idx, column=1).font = bold_font
            val_cell = ws_summary.cell(row=row_idx, column=2)
            if isinstance(val, float):
                val_cell.number_format = "#,##0.00"
            val_cell.alignment = Alignment(horizontal="right")

        # Category Breakdown Table
        ws_summary.append([])
        ws_summary.append(["Category Breakdown", "Amount Spent (INR)", "Budget Limit (INR)", "Share of Spend (%)"])
        cat_header_row = ws_summary.max_row
        for cell in ws_summary[cat_header_row]:
            cell.fill = sub_header_fill
            cell.font = white_bold
            cell.alignment = Alignment(horizontal="center")

        for item in data["category_breakdown"]:
            ws_summary.append([
                item["category"],
                float(item["spent"]),
                float(item["budget_limit"]) if item["budget_limit"] > 0 else "No Limit",
                f"{item['share_pct']}%",
            ])
            r = ws_summary.max_row
            ws_summary.cell(row=r, column=2).number_format = "#,##0.00"
            if isinstance(ws_summary.cell(row=r, column=3).value, float):
                ws_summary.cell(row=r, column=3).number_format = "#,##0.00"
            ws_summary.cell(row=r, column=4).alignment = Alignment(horizontal="right")

        # ---------------------------------------------------------
        # SHEET 2: EXPENSE HISTORY REPORT
        # ---------------------------------------------------------
        ws_exp = wb.create_sheet(title="Expense History")
        ws_exp.append(["Date", "Category", "Description", "Amount (INR)"])
        for cell in ws_exp[1]:
            cell.fill = header_fill
            cell.font = white_bold

        for exp in data["expenses"]:
            ws_exp.append([exp["date_str"], exp["category"], exp["description"], float(exp["amount"])])
            r = ws_exp.max_row
            ws_exp.cell(row=r, column=4).number_format = "#,##0.00"

        ws_exp.append(["", "", "TOTAL EXPENSES", float(data["total_expense"])])
        tot_r = ws_exp.max_row
        for col_i in range(1, 5):
            c = ws_exp.cell(row=tot_r, column=col_i)
            c.fill = total_fill
            c.font = bold_font
            c.border = thin_border
        ws_exp.cell(row=tot_r, column=4).number_format = "#,##0.00"

        # ---------------------------------------------------------
        # SHEET 3: INCOME HISTORY
        # ---------------------------------------------------------
        ws_inc = wb.create_sheet(title="Income History")
        ws_inc.append(["Date", "Source", "Description", "Amount (INR)"])
        for cell in ws_inc[1]:
            cell.fill = header_fill
            cell.font = white_bold

        for inc in data["incomes"]:
            ws_inc.append([inc["date_str"], inc["source"], inc["description"], float(inc["amount"])])
            r = ws_inc.max_row
            ws_inc.cell(row=r, column=4).number_format = "#,##0.00"

        ws_inc.append(["", "", "TOTAL INCOME", float(data["total_income"])])
        tot_inc_r = ws_inc.max_row
        for col_i in range(1, 5):
            c = ws_inc.cell(row=tot_inc_r, column=col_i)
            c.fill = total_fill
            c.font = bold_font
            c.border = thin_border
        ws_inc.cell(row=tot_inc_r, column=4).number_format = "#,##0.00"

        # Auto-fit column widths across all sheets
        for sheet in [ws_summary, ws_exp, ws_inc]:
            for col in sheet.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    val_len = len(str(cell.value or ""))
                    if val_len > max_len:
                        max_len = val_len
                sheet.column_dimensions[col_letter].width = max(max_len + 5, 14)

        buffer = BytesIO()
        wb.save(buffer)
        excel_bytes = buffer.getvalue()
        buffer.close()

        response = HttpResponse(
            excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="budgetbuddy_report_{data["file_suffix"]}.xlsx"'
        )
        return response


class ExportTransactionsPDFView(APIView):
    """Exports an upgraded multi-section PDF with Financial Summary, Category Breakdown & Expense History."""
    permission_classes = [permissions.IsAuthenticated, IsPremiumOrAdmin]

    def get(self, request):
        data = build_financial_report_data(
            request.user,
            month=request.query_params.get("month"),
            year=request.query_params.get("year"),
        )

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
        )
        styles = getSampleStyleSheet()
        elements = []

        # 1. Document Title & Metadata
        elements.append(Paragraph(f"BudgetBuddy - {data['period_label']}", styles["Title"]))
        elements.append(
            Paragraph(
                f"Account: <b>{request.user.username}</b> | Generated: {timezone.now().strftime('%d-%b-%Y')}",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 14))

        # 2. Financial Summary Box
        elements.append(Paragraph("1. Financial Summary", styles["Heading2"]))
        summary_data = [
            ["Total Income", "Total Expenses", "Net Balance", "Savings Rate"],
            [
                f"INR {data['total_income']:,.2f}",
                f"INR {data['total_expense']:,.2f}",
                f"INR {data['net_balance']:,.2f}",
                f"{data['savings_rate']}%",
            ],
        ]
        summary_table = Table(summary_data, colWidths=[130, 130, 130, 130])
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 16))

        # 3. Category-Wise Spending Breakdown
        elements.append(Paragraph("2. Category Spending Breakdown", styles["Heading2"]))
        cat_data = [["Category", "Spent (INR)", "Monthly Limit (INR)", "Share (%)"]]
        if not data["category_breakdown"]:
            cat_data.append(["No expenses recorded", "0.00", "-", "0%"])
        else:
            for item in data["category_breakdown"]:
                limit_str = f"{item['budget_limit']:,.2f}" if item["budget_limit"] > 0 else "No Limit"
                cat_data.append([
                    item["category"],
                    f"{item['spent']:,.2f}",
                    limit_str,
                    f"{item['share_pct']}%",
                ])

        cat_table = Table(cat_data, colWidths=[150, 130, 140, 100])
        cat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(cat_table)
        elements.append(Spacer(1, 16))

        # 4. Dedicated Expense History Report
        elements.append(Paragraph("3. Expense History Report", styles["Heading2"]))
        exp_data = [["Date", "Category", "Description", "Amount (INR)"]]
        if not data["expenses"]:
            exp_data.append(["-", "-", "No expenses found for this period", "0.00"])
        else:
            for exp in data["expenses"]:
                exp_data.append([
                    exp["date_str"],
                    exp["category"],
                    exp["description"][:42],
                    f"{exp['amount']:,.2f}",
                ])
            exp_data.append(["", "", "TOTAL EXPENSES", f"INR {data['total_expense']:,.2f}"])

        exp_table = Table(exp_data, colWidths=[85, 110, 225, 100])
        exp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (3, 1), (3, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(exp_table)

        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="budgetbuddy_report_{data["file_suffix"]}.pdf"'
        )
        return response


class ExportTransactionsCSVView(APIView):
    """Exports CSV ledger with text-padded dates so Excel never masks dates as ###."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = build_financial_report_data(
            request.user,
            month=request.query_params.get("month"),
            year=request.query_params.get("year"),
        )

        combined = []
        for e in data["expenses"]:
            combined.append({
                "raw_date": e["raw_date"],
                "date_str": e["date_str"],
                "type": "EXPENSE",
                "category_or_source": e["category"],
                "amount": f"-{e['amount']:.2f}",
                "description": e["description"],
            })
        for i in data["incomes"]:
            combined.append({
                "raw_date": i["raw_date"],
                "date_str": i["date_str"],
                "type": "INCOME",
                "category_or_source": i["source"],
                "amount": f"+{i['amount']:.2f}",
                "description": i["description"],
            })

        combined.sort(key=lambda x: x["raw_date"], reverse=True)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="budgetbuddy_report_{data["file_suffix"]}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow(["Date", "Type", "Category / Source", "Amount (INR)", "Description"])
        for row in combined:
            writer.writerow([
                f" {row['date_str']}",
                row["type"],
                row["category_or_source"],
                row["amount"],
                row["description"],
            ])

        return response