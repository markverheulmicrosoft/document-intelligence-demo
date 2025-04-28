from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
import datetime
import os
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus.tables import Table, TableStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER

# Create a PDF with fund onboarding document
pdf_file = 'static/fund_onboarding.pdf'

# Get the path to the stock image
current_dir = os.path.dirname(os.path.abspath(__file__))
stock_image_path = os.path.join(current_dir, 'static', 'images', 'msft_stock.png')

# First create the cover page
c = canvas.Canvas(pdf_file, pagesize=letter)

# Cover page
current_date = datetime.datetime.now().strftime('%B %d, %Y')
company_name = 'Global Investment Partners'
fund_name = 'Strategic Growth Fund III'

# Draw the company header
c.setFont('Helvetica-Bold', 24)
c.drawCentredString(4.25 * inch, 9 * inch, company_name)
c.setFont('Helvetica-Bold', 18)
c.drawCentredString(4.25 * inch, 8.5 * inch, fund_name)
c.setFont('Helvetica-Bold', 16)
c.drawCentredString(4.25 * inch, 8 * inch, 'Onboarding Documentation')

# Add the stock chart image on cover page
if os.path.exists(stock_image_path):
    img = ImageReader(stock_image_path)
    img_width, img_height = img.getSize()
    aspect = img_height / float(img_width)
    display_width = 5 * inch
    display_height = display_width * aspect
    
    c.drawImage(img, 1.75 * inch, 4.5 * inch, width=display_width, height=display_height)

# Add footer to cover page
c.setFont('Helvetica', 10)
c.drawCentredString(4.25 * inch, 2 * inch, 'CONFIDENTIAL')
c.drawCentredString(4.25 * inch, 1.75 * inch, f'Prepared: {current_date}')
c.drawCentredString(4.25 * inch, 1.5 * inch, '123 Financial Avenue, Suite 4500')
c.drawCentredString(4.25 * inch, 1.25 * inch, 'New York, NY 10004')
c.drawCentredString(4.25 * inch, 1 * inch, 'www.globalinvestmentpartners.com')

# Add page number
c.setFont('Helvetica', 8)
c.drawRightString(7.5 * inch, 0.5 * inch, f"Page 1 of 5")

c.showPage()

# Page 2: Fund Overview
c.setFont('Helvetica-Bold', 18)
c.drawString(1 * inch, 10 * inch, 'Strategic Growth Fund III: Overview')

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, 9.5 * inch, 'Fund Information')

c.setFont('Helvetica', 11)
# Create a table-like structure for fund information
info_lines = [
    ('Fund Name:', 'Strategic Growth Fund III'),
    ('Fund Type:', 'Closed-end Private Equity'),
    ('Target Size:', '$750 million'),
    ('Minimum Investment:', '$5 million'),
    ('Investment Period:', '5 years'),
    ('Fund Term:', '10 years + 2 year extensions'),
    ('Management Fee:', '2% during investment period, 1.5% thereafter'),
    ('Carried Interest:', '20% with 8% preferred return'),
    ('Domicile:', 'Cayman Islands'),
    ('Investment Focus:', 'Technology, Healthcare, Financial Services'),
    ('Target Geography:', 'North America, Europe, Select Asian Markets')
]

y_position = 9.2 * inch
for label, value in info_lines:
    c.setFont('Helvetica-Bold', 10)
    c.drawString(1 * inch, y_position, label)
    c.setFont('Helvetica', 10)
    c.drawString(3 * inch, y_position, value)
    y_position -= 0.3 * inch

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, y_position - 0.3 * inch, 'Investment Strategy')

c.setFont('Helvetica', 10)
strategy_text = """
The Strategic Growth Fund III seeks to generate superior risk-adjusted returns by investing in 
established middle-market companies with strong growth potential. The fund targets businesses 
with defensible market positions, proven business models, and opportunities for operational 
improvements and strategic acquisitions.

Key investment criteria include:
• Businesses with enterprise values between $100-500 million
• Strong, stable cash flows and growth potential
• Experienced management teams
• Clear path to value creation
• Opportunities for strategic add-on acquisitions

The investment team utilizes a disciplined approach to due diligence, focusing on both financial 
performance and operational capabilities. We partner with management teams to implement 
strategic initiatives, operational improvements, and technology enhancements to drive growth.
"""

text_object = c.beginText(1 * inch, y_position - 0.7 * inch)
text_object.setFont("Helvetica", 10)
for line in strategy_text.strip().split('\n'):
    text_object.textLine(line.strip())
c.drawText(text_object)

# Add page number
c.setFont('Helvetica', 8)
c.drawRightString(7.5 * inch, 0.5 * inch, f"Page 2 of 5")

c.showPage()

# Page 3: Investment Process and Team
c.setFont('Helvetica-Bold', 18)
c.drawString(1 * inch, 10 * inch, 'Investment Process & Management Team')

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, 9.5 * inch, 'Investment Process')

# Investment process with stages
process_stages = [
    ('1. Deal Sourcing', 'Proprietary network, industry relationships, and targeted outreach'),
    ('2. Initial Screening', 'Evaluation against investment criteria and preliminary financial analysis'),
    ('3. Due Diligence', 'Comprehensive financial, operational, legal, and commercial analysis'),
    ('4. Investment Committee', 'Rigorous review and approval process by senior investment professionals'),
    ('5. Transaction Execution', 'Negotiation, documentation, and closing'),
    ('6. Value Creation', 'Implementation of 100-day plan and long-term value creation initiatives'),
    ('7. Exit Planning', 'Strategic positioning for optimal exit through IPO, strategic sale, or recapitalization')
]

y_position = 9.2 * inch
for stage, description in process_stages:
    c.setFont('Helvetica-Bold', 10)
    c.drawString(1 * inch, y_position, stage)
    c.setFont('Helvetica', 10)
    c.drawString(2.5 * inch, y_position, description)
    y_position -= 0.3 * inch

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, y_position - 0.3 * inch, 'Management Team')

# Key team members
team_members = [
    ('Jennifer A. Reynolds', 'Managing Partner', 'Harvard MBA, 25+ years in private equity'),
    ('Michael B. Chen', 'Senior Partner', 'Wharton MBA, Former CEO of TechInnovate'),
    ('Sarah C. Williams', 'Partner, Healthcare', 'Stanford MD/MBA, 15+ years healthcare investing'),
    ('David K. Rodriguez', 'Partner, Technology', 'MIT Computer Science, Former CTO of CloudSecure'),
    ('Robert L. Thompson', 'CFO', 'CPA, 20+ years financial management'),
    ('Lisa M. Johnson', 'Head of Investor Relations', 'Columbia MBA, 18+ years in IR')
]

y_position = y_position - 0.7 * inch
for name, title, bio in team_members:
    c.setFont('Helvetica-Bold', 10)
    c.drawString(1 * inch, y_position, name)
    c.setFont('Helvetica-Oblique', 10)
    c.drawString(1 * inch, y_position - 0.2 * inch, title)
    c.setFont('Helvetica', 9)
    c.drawString(1 * inch, y_position - 0.4 * inch, bio)
    y_position -= 0.6 * inch

# Add the stock chart image
if os.path.exists(stock_image_path):
    img = ImageReader(stock_image_path)
    img_width, img_height = img.getSize()
    aspect = img_height / float(img_width)
    display_width = 3 * inch
    display_height = display_width * aspect
    
    c.drawImage(img, 4 * inch, 2 * inch, width=display_width, height=display_height)

# Add page number
c.setFont('Helvetica', 8)
c.drawRightString(7.5 * inch, 0.5 * inch, f"Page 3 of 5")

c.showPage()

# Page 4: Performance Track Record
c.setFont('Helvetica-Bold', 18)
c.drawString(1 * inch, 10 * inch, 'Track Record & Performance')

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, 9.5 * inch, 'Historical Fund Performance')

# Create a performance table
c.setStrokeColor(colors.black)
c.setFillColor(colors.lightgrey)
c.rect(1 * inch, 8.5 * inch, 6 * inch, 0.4 * inch, fill=1)
c.setFillColor(colors.black)

c.setFont('Helvetica-Bold', 10)
c.drawString(1.1 * inch, 8.7 * inch, 'Fund')
c.drawString(2.5 * inch, 8.7 * inch, 'Vintage')
c.drawString(3.3 * inch, 8.7 * inch, 'Size ($M)')
c.drawString(4.2 * inch, 8.7 * inch, 'Gross IRR')
c.drawString(5.1 * inch, 8.7 * inch, 'Net IRR')
c.drawString(6.1 * inch, 8.7 * inch, 'MOIC')

# Performance data
performance_data = [
    ('Strategic Growth I', '2012', '350', '28.5%', '21.2%', '2.8x'),
    ('Strategic Growth II', '2017', '525', '24.3%', '18.7%', '2.3x'),
    ('Tech Opportunities I', '2015', '275', '32.1%', '24.6%', '3.1x'),
    ('Healthcare Growth I', '2016', '300', '22.8%', '17.5%', '2.2x'),
    ('Special Situations I', '2018', '400', '19.6%', '15.3%', '1.9x')
]

y_position = 8.5 * inch
for i, (fund, vintage, size, gross_irr, net_irr, moic) in enumerate(performance_data):
    y_position -= 0.3 * inch
    if i % 2 == 0:
        c.setFillColor(colors.lightgrey)
        c.setFillColorRGB(0.95, 0.95, 0.95)
        c.rect(1 * inch, y_position, 6 * inch, 0.3 * inch, fill=1)
        c.setFillColor(colors.black)
    
    c.setFont('Helvetica', 9)
    c.drawString(1.1 * inch, y_position + 0.1 * inch, fund)
    c.drawString(2.5 * inch, y_position + 0.1 * inch, vintage)
    c.drawString(3.3 * inch, y_position + 0.1 * inch, size)
    c.drawString(4.2 * inch, y_position + 0.1 * inch, gross_irr)
    c.drawString(5.1 * inch, y_position + 0.1 * inch, net_irr)
    c.drawString(6.1 * inch, y_position + 0.1 * inch, moic)

# Add note below the table
c.setFont('Helvetica-Oblique', 8)
c.drawString(1 * inch, y_position - 0.3 * inch, 'Past performance is not indicative of future results. All data as of December 31, 2024.')

# Select Portfolio Investments section
c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, y_position - 0.8 * inch, 'Select Portfolio Companies')

# Example investments
investments = [
    ('TechCloud Solutions', 'Enterprise software platform acquired in 2018. Revenue grew 3.5x under our ownership.'),
    ('MedDevice Innovations', 'Medical device manufacturer acquired in 2016. Successful exit in 2021 at 4.2x MOIC.'),
    ('FinServe Digital', 'Financial technology provider acquired in 2019. Expanded into 12 new markets.'),
    ('HealthData Analytics', 'Healthcare analytics firm acquired in 2017. Doubled EBITDA in 3 years.')
]

y_position = y_position - 1.1 * inch
for company, description in investments:
    c.setFont('Helvetica-Bold', 10)
    c.drawString(1 * inch, y_position, company)
    c.setFont('Helvetica', 9)
    c.drawString(1 * inch, y_position - 0.2 * inch, description)
    y_position -= 0.5 * inch

# Quarterly returns chart
c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, y_position - 0.3 * inch, 'Strategic Growth Fund II: Quarterly Returns (%)')

# Draw a simple bar chart
quarters = ['Q1 2023', 'Q2 2023', 'Q3 2023', 'Q4 2023', 'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024']
returns = [4.2, 3.8, 5.1, 4.5, 5.8, 4.9, 3.6, 6.2]

chart_width = 6 * inch
chart_height = 1.5 * inch
bar_width = (chart_width - 0.5 * inch) / len(returns)
max_return = max(returns)

chart_base_y = 1.8 * inch
chart_base_x = 1 * inch

# Draw the bars
for i, ret in enumerate(returns):
    bar_height = (ret / max_return) * chart_height
    x = chart_base_x + i * bar_width
    c.setFillColorRGB(0.2, 0.4, 0.7)  # Blue color for bars
    c.rect(x, chart_base_y, bar_width - 0.05 * inch, bar_height, fill=1)
    c.setFillColor(colors.black)
    
    # Draw values above bars
    c.setFont('Helvetica', 8)
    c.drawCentredString(x + (bar_width - 0.05 * inch) / 2, chart_base_y + bar_height + 0.05 * inch, f"{ret}%")
    
    # Draw quarter labels
    c.setFont('Helvetica', 7)
    c.drawCentredString(x + (bar_width - 0.05 * inch) / 2, chart_base_y - 0.15 * inch, quarters[i])

# Add page number
c.setFont('Helvetica', 8)
c.drawRightString(7.5 * inch, 0.5 * inch, f"Page 4 of 5")

c.showPage()

# Page 5: Investor Information and Onboarding Process
c.setFont('Helvetica-Bold', 18)
c.drawString(1 * inch, 10 * inch, 'Investor Information & Onboarding Process')

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, 9.5 * inch, 'Subscription Process')

# Subscription steps
steps = [
    ('Step 1', 'Review Private Placement Memorandum (PPM) and fund documents'),
    ('Step 2', 'Complete Subscription Agreement and Investor Questionnaire'),
    ('Step 3', 'Review and sign Limited Partnership Agreement (LPA)'),
    ('Step 4', 'Complete AML/KYC documentation and W-8/W-9 forms'),
    ('Step 5', "Wire subscription amount to fund's escrow account"),
    ('Step 6', 'Receive confirmation of acceptance and account statements')
]

y_position = 9.2 * inch
for step, description in steps:
    c.setFont('Helvetica-Bold', 10)
    c.drawString(1 * inch, y_position, step)
    c.setFont('Helvetica', 10)
    c.drawString(1.8 * inch, y_position, description)
    y_position -= 0.3 * inch

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, y_position - 0.3 * inch, 'Required Documentation')

# List of required documents
documents = [
    'Subscription Agreement (fully completed and executed)',
    'Investor Suitability Questionnaire',
    'W-8BEN, W-8BEN-E, or W-9 as applicable',
    'Entity formation documents (for entity investors)',
    'AML/KYC documentation',
    'FATCA/CRS self-certification',
    'Source of funds verification',
    'Qualified Purchaser Certification'
]

y_position = y_position - 0.6 * inch
for doc in documents:
    c.setFont('Helvetica', 10)
    c.drawString(1.2 * inch, y_position, '•')
    c.drawString(1.4 * inch, y_position, doc)
    y_position -= 0.25 * inch

c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, y_position - 0.3 * inch, 'Key Dates and Deadlines')

# Important dates table
c.setStrokeColor(colors.black)
c.setFillColor(colors.lightgrey)
c.rect(1 * inch, y_position - 0.7 * inch, 6 * inch, 0.3 * inch, fill=1)
c.setFillColor(colors.black)

c.setFont('Helvetica-Bold', 10)
c.drawString(1.1 * inch, y_position - 0.55 * inch, 'Event')
c.drawString(4 * inch, y_position - 0.55 * inch, 'Date')

dates = [
    ('First Close Target', 'June 30, 2025'),
    ('Final Close Target', 'December 31, 2025'),
    ('Initial Capital Call', 'Expected Q3 2025'),
    ('First Annual Meeting', 'April 2026'),
    ('First Distribution', 'Expected Q4 2026')
]

y_position = y_position - 0.7 * inch
for i, (event, date) in enumerate(dates):
    y_position -= 0.25 * inch
    if i % 2 == 0:
        c.setFillColorRGB(0.95, 0.95, 0.95)
        c.rect(1 * inch, y_position, 6 * inch, 0.25 * inch, fill=1)
        c.setFillColor(colors.black)
    
    c.setFont('Helvetica', 9)
    c.drawString(1.1 * inch, y_position + 0.07 * inch, event)
    c.drawString(4 * inch, y_position + 0.07 * inch, date)

# Contact information
c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, y_position - 0.5 * inch, 'Contact Information')

contacts = [
    ('Investor Relations:', 'Lisa M. Johnson', 'ljohnson@globalinvestpartners.com', '+1 (212) 555-7890'),
    ('Subscription Questions:', 'Robert L. Thompson', 'rthompson@globalinvestpartners.com', '+1 (212) 555-7891'),
    ('Fund Administration:', 'Apex Fund Services', 'gip@apexfunds.com', '+1 (212) 555-9876')
]

y_position = y_position - 0.8 * inch
for department, name, email, phone in contacts:
    c.setFont('Helvetica-Bold', 9)
    c.drawString(1 * inch, y_position, department)
    c.setFont('Helvetica', 9)
    c.drawString(2.3 * inch, y_position, name)
    c.drawString(4 * inch, y_position, email)
    c.drawString(6.2 * inch, y_position, phone)
    y_position -= 0.25 * inch

# Add the stock chart image
if os.path.exists(stock_image_path):
    img = ImageReader(stock_image_path)
    img_width, img_height = img.getSize()
    aspect = img_height / float(img_width)
    display_width = 2.5 * inch
    display_height = display_width * aspect
    
    c.drawImage(img, 5 * inch, 1.7 * inch, width=display_width, height=display_height)

# Disclaimer
c.setFont('Helvetica-Bold', 8)
c.drawString(1 * inch, 1.2 * inch, 'Disclaimer:')
c.setFont('Helvetica', 7)
disclaimer_text = """
This document is for informational purposes only and does not constitute an offer to sell or a solicitation of an offer 
to purchase any securities. Any such offer will be made only pursuant to the Fund's Private Placement Memorandum. 
The information contained herein is confidential and may not be reproduced or distributed. Past performance is not 
indicative of future results. Investment in the Fund involves significant risks, including loss of the entire investment.
"""
c.drawString(1 * inch, 1.1 * inch, disclaimer_text.strip())

# Add page number
c.setFont('Helvetica', 8)
c.drawRightString(7.5 * inch, 0.5 * inch, f"Page 5 of 5")

c.save()
print(f'Fund Onboarding Document created: {pdf_file}')
