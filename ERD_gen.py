import textwrap

width, height = 1200, 800

boxes = [
    {"name": "STUDENTS", "x": 30, "y": 520, "w": 240, "h": 230,
     "fields": [
         "student_id (PK)", "first_name", "last_name", "middle_initial",
         "course", "sex", "birthday", "civil_status", "contact_number", "address"
     ]},
    {"name": "SUBMISSIONS", "x": 320, "y": 380, "w": 280, "h": 350,
     "fields": [
         "id (PK)", "student_id (FK)", "year_level", "status", "submitted_at", "updated_at",
         "staff_notes", "had_operation", "operation_details", "allergy_details",
         "blood_pressure", "weight", "height", "bmi", "data_privacy_consent"
     ]},
    {"name": "EMERGENCY_CONTACTS", "x": 640, "y": 640, "w": 250, "h": 130,
     "fields": ["submission_id (PK/FK)", "name", "relationship", "phone", "address"]},
    {"name": "MEDICAL_HISTORY", "x": 640, "y": 480, "w": 250, "h": 140,
     "fields": ["submission_id (PK/FK)", "allergy", "asthma", "diabetes", "hypertension",
                "heart_disorder", "anxiety_disorder", "pneumonia", "covid19", "uti"]},
    {"name": "STAFF_MEASUREMENTS", "x": 640, "y": 300, "w": 250, "h": 150,
     "fields": ["submission_id (PK/FK)", "blood_pressure", "cardiac_rate", "respiratory_rate",
                "temperature", "weight", "height", "bmi"]},
    {"name": "LAB_CHEST_XRAY", "x": 920, "y": 640, "w": 250, "h": 120,
     "fields": ["submission_id (FK)", "xray_date", "xray_result", "xray_findings", "file_id (FK)"]},
    {"name": "LAB_CBC", "x": 920, "y": 470, "w": 250, "h": 150,
     "fields": ["submission_id (FK)", "hemoglobin", "hematocrit", "wbc", "platelet_count",
                "blood_type", "glucose", "protein", "file_id (FK)"]},
    {"name": "LAB_URINALYSIS", "x": 920, "y": 310, "w": 250, "h": 110,
     "fields": ["submission_id (FK)", "glucose", "protein", "file_id (FK)"]},
    {"name": "FILES", "x": 920, "y": 120, "w": 250, "h": 140,
     "fields": ["id (PK)", "submission_id (FK)", "type", "file_name", "mime_type", "url", "uploaded_at"]},
    {"name": "CERTIFICATES", "x": 640, "y": 120, "w": 250, "h": 120,
     "fields": ["id (PK)", "submission_id (FK)", "staff_id (FK)", "issued_at", "pdf_url"]},
    {"name": "STAFF_USERS", "x": 640, "y": 10, "w": 250, "h": 90,
     "fields": ["id (PK)", "name", "email", "position", "phone"]},
]

lines = [
    (270, 620, 320, 560),
    (600, 650, 640, 700),
    (600, 560, 640, 540),
    (600, 470, 640, 380),
    (600, 620, 920, 700),
    (600, 520, 920, 540),
    (600, 440, 920, 360),
    (600, 320, 920, 190),
    (600, 260, 640, 170),
    (700, 120, 700, 100),
]

objects = []
objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".encode())
objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

content = []
content.append("0.13 0.37 0.25 rg")
content.append("0.5 w")

for b in boxes:
    content.append("0 0 0 RG")
    content.append(f"{b['x']} {b['y']} {b['w']} {b['h']} re S")
    content.append("0.13 0.37 0.25 rg")
    content.append(f"{b['x']} {b['y'] + b['h'] - 20} {b['w']} 20 re f")
    content.append("1 1 1 rg")
    content.append("BT /F1 10 Tf")
    content.append(f"{b['x'] + 6} {b['y'] + b['h'] - 14} Td ({b['name']}) Tj ET")
    content.append("0 0 0 rg")
    content.append("BT /F1 9 Tf")
    y = b['y'] + b['h'] - 34
    for field in b['fields']:
        content.append(f"{b['x'] + 6} {y} Td ({field}) Tj")
        y -= 12
    content.append("ET")

content.append("0 0 0 RG")
for x1, y1, x2, y2 in lines:
    content.append(f"{x1} {y1} m {x2} {y2} l S")

content.append("0 0 0 rg")
content.append("BT /F1 14 Tf 30 770 Td (Gordon College Health Services - ERD) Tj ET")

content_stream = "\n".join(content).encode("utf-8")
objects.append(b"<< /Length %d >>\nstream\n" % len(content_stream) + content_stream + b"\nendstream")

xref = []
pdf = [b"%PDF-1.4\n"]
for i, obj in enumerate(objects, start=1):
    xref.append(sum(len(p) for p in pdf))
    pdf.append(f"{i} 0 obj\n".encode())
    pdf.append(obj)
    pdf.append(b"\nendobj\n")

xref_pos = sum(len(p) for p in pdf)
pdf.append(b"xref\n")
pdf.append(f"0 {len(objects)+1}\n".encode())
pdf.append(b"0000000000 65535 f \n")
for offset in xref:
    pdf.append(f"{offset:010d} 00000 n \n".encode())

pdf.append(b"trailer\n")
pdf.append(f"<< /Size {len(objects)+1} /Root 1 0 R >>\n".encode())
pdf.append(b"startxref\n")
pdf.append(f"{xref_pos}\n".encode())
pdf.append(b"%%EOF\n")

with open("ERD.pdf", "wb") as f:
    f.write(b"".join(pdf))

print("ERD.pdf written")
