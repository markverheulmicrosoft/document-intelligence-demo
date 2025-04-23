from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
import datetime

# Create a PDF with sample invoice data
pdf_file = 'sample_invoice.pdf'
c = canvas.Canvas(pdf_file, pagesize=letter)

# Set up some variables for the invoice
invoice_num = 'INV-2025-0423'
invoice_date = datetime.datetime.now().strftime('%Y-%m-%d')
due_date = (datetime.datetime.now() + datetime.timedelta(days=30)).strftime('%Y-%m-%d')
company_name = 'Sample Company Ltd.'
customer_name = 'ACME Corporation'
customer_address = '123 Business Road, Suite 100, Business City, 12345'
items = [
    {'description': 'Software Development Services', 'quantity': 40, 'unit_price': 150.00},
    {'description': 'Cloud Hosting (Monthly)', 'quantity': 1, 'unit_price': 300.00},
    {'description': 'Support & Maintenance', 'quantity': 5, 'unit_price': 75.00}
]

# Draw the company header
c.setFont('Helvetica-Bold', 24)
c.drawString(1 * inch, 10 * inch, company_name)
c.setFont('Helvetica', 10)
c.drawString(1 * inch, 9.7 * inch, '789 Tech Boulevard')
c.drawString(1 * inch, 9.5 * inch, 'Innovation City, 67890')
c.drawString(1 * inch, 9.3 * inch, 'Phone: (555) 123-4567')
c.drawString(1 * inch, 9.1 * inch, 'Email: billing@samplecompany.com')

# Draw the invoice header
c.setFont('Helvetica-Bold', 18)
c.drawString(6 * inch, 10 * inch, 'INVOICE')
c.setFont('Helvetica', 12)
c.drawString(6 * inch, 9.7 * inch, f'Invoice #: {invoice_num}')
c.drawString(6 * inch, 9.5 * inch, f'Date: {invoice_date}')
c.drawString(6 * inch, 9.3 * inch, f'Due Date: {due_date}')

# Draw the billing info
c.setFont('Helvetica-Bold', 12)
c.drawString(1 * inch, 8.5 * inch, 'Bill To:')
c.setFont('Helvetica', 12)
c.drawString(1 * inch, 8.2 * inch, customer_name)
c.drawString(1 * inch, 8.0 * inch, customer_address)

# Draw the invoice table header
c.setStrokeColor(colors.black)
c.setFillColor(colors.lightgrey)
c.rect(1 * inch, 7.5 * inch, 6 * inch, 0.3 * inch, fill=1)
c.setFillColor(colors.black)
c.setFont('Helvetica-Bold', 12)
c.drawString(1.1 * inch, 7.6 * inch, 'Description')
c.drawString(4.5 * inch, 7.6 * inch, 'Quantity')
c.drawString(5.5 * inch, 7.6 * inch, 'Unit Price')
c.drawString(6.5 * inch, 7.6 * inch, 'Amount')

# Draw the line items
y_position = 7.2 * inch
total = 0

for item in items:
    c.setFont('Helvetica', 10)
    c.drawString(1.1 * inch, y_position, item['description'])
    c.drawRightString(4.7 * inch, y_position, str(item['quantity']))
    c.drawRightString(6.0 * inch, y_position, f'${item["unit_price"]:.2f}')
    amount = item['quantity'] * item['unit_price']
    total += amount
    c.drawRightString(7.0 * inch, y_position, f'${amount:.2f}')
    y_position -= 0.3 * inch
    c.line(1 * inch, y_position + 0.1 * inch, 7 * inch, y_position + 0.1 * inch)

# Draw the total
c.line(5 * inch, y_position - 0.3 * inch, 7 * inch, y_position - 0.3 * inch)
c.setFont('Helvetica-Bold', 12)
c.drawString(5 * inch, y_position - 0.5 * inch, 'Total:')
c.drawRightString(7 * inch, y_position - 0.5 * inch, f'${total:.2f}')

# Draw payment info
c.setFont('Helvetica-Bold', 10)
c.drawString(1 * inch, 3 * inch, 'Payment Information:')
c.setFont('Helvetica', 10)
c.drawString(1 * inch, 2.8 * inch, 'Bank: Global Financial Bank')
c.drawString(1 * inch, 2.6 * inch, 'Account Name: Sample Company Ltd.')
c.drawString(1 * inch, 2.4 * inch, 'Account Number: XXXX-XXXX-XXXX-1234')
c.drawString(1 * inch, 2.2 * inch, 'Routing Number: 987654321')

# Draw terms
c.setFont('Helvetica-Bold', 10)
c.drawString(1 * inch, 1.5 * inch, 'Terms & Conditions:')
c.setFont('Helvetica', 8)
c.drawString(1 * inch, 1.3 * inch, '1. Payment is due within 30 days from the date of invoice.')
c.drawString(1 * inch, 1.1 * inch, '2. Late payments may be subject to a 1.5% monthly finance charge.')
c.drawString(1 * inch, 0.9 * inch, '3. This is a sample invoice generated for testing and demonstration purposes only.')

# Draw a thank you note
c.setFont('Helvetica-Oblique', 10)
c.drawCentredString(4 * inch, 0.5 * inch, 'Thank you for your business!')

c.showPage()
c.save()
print(f'Sample invoice created: {pdf_file}')
