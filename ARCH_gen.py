import math

width = 1200
height = 700

# Helpers to build PDF content

def rounded_rect(x, y, w, h, r):
    r = min(r, w/2, h/2)
    # PDF uses cubic Bezier: c x1 y1 x2 y2 x3 y3
    return (
        f"{x+r} {y} m "
        f"{x+w-r} {y} l "
        f"{x+w-r} {y} {x+w} {y} {x+w} {y+r} c "
        f"{x+w} {y+h-r} l "
        f"{x+w} {y+h-r} {x+w} {y+h} {x+w-r} {y+h} c "
        f"{x+r} {y+h} l "
        f"{x+r} {y+h} {x} {y+h} {x} {y+h-r} c "
        f"{x} {y+r} l "
        f"{x} {y+r} {x} {y} {x+r} {y} c"
    )


def arrow(x1, y1, x2, y2, size=8):
    # line
    path = [f"{x1} {y1} m {x2} {y2} l S"]
    # arrowhead
    angle = math.atan2(y2 - y1, x2 - x1)
    left = (x2 - size * math.cos(angle - math.pi/6), y2 - size * math.sin(angle - math.pi/6))
    right = (x2 - size * math.cos(angle + math.pi/6), y2 - size * math.sin(angle + math.pi/6))
    path.append(f"{x2} {y2} m {left[0]} {left[1]} l {right[0]} {right[1]} l f")
    return "\n".join(path)

content = []

# Colors
content.append("0.1 0.35 0.23 rg")  # dark green
content.append("0.5 w")

# Title
content.append("BT /F1 18 Tf 40 640 Td (System Architecture - Gordon College Health Services) Tj ET")

# Background soft panel
content.append("0.94 0.98 0.96 rg")
content.append(rounded_rect(30, 40, 1140, 580, 16) + " f")

# Section labels
content.append("0 0 0 rg")
content.append("BT /F1 12 Tf 70 590 Td (Clients) Tj ET")
content.append("BT /F1 12 Tf 560 590 Td (Cloud Server - Supabase) Tj ET")

# Person icons (simple filled shapes)
content.append("0.95 0.7 0.2 rg")
# Staff
content.append("newpath 140 500 20 0 360 arc f")
content.append("0.95 0.7 0.2 rg")
content.append("110 470 60 80 re f")
content.append("0 0 0 rg")
content.append("BT /F1 11 Tf 110 450 Td (Clinic Staff) Tj ET")
# Student
content.append("0.95 0.7 0.2 rg")
content.append("newpath 140 320 20 0 360 arc f")
content.append("0.95 0.7 0.2 rg")
content.append("110 290 60 80 re f")
content.append("0 0 0 rg")
content.append("BT /F1 11 Tf 125 270 Td (Student) Tj ET")

# Device cards (Clients)
content.append("0.88 0.94 0.90 rg")
content.append(rounded_rect(230, 470, 220, 90, 12) + " f")
content.append("0.88 0.94 0.90 rg")
content.append(rounded_rect(230, 290, 220, 90, 12) + " f")
content.append("0 0 0 rg")
content.append("BT /F1 12 Tf 255 520 Td (Staff UI - PWA) Tj ET")
content.append("BT /F1 12 Tf 250 340 Td (Student UI - PWA) Tj ET")

# Cloud boxes
content.append("0.85 0.92 0.98 rg")
content.append(rounded_rect(560, 470, 260, 90, 12) + " f")
content.append(rounded_rect(560, 350, 260, 90, 12) + " f")
content.append("0.85 0.92 0.98 rg")
content.append(rounded_rect(860, 420, 260, 120, 12) + " f")
content.append(rounded_rect(860, 280, 260, 120, 12) + " f")
content.append("0 0 0 rg")
content.append("BT /F1 12 Tf 600 520 Td (API / Edge Functions) Tj ET")
content.append("BT /F1 12 Tf 650 400 Td (Auth) Tj ET")
content.append("BT /F1 12 Tf 920 480 Td (Postgres Database) Tj ET")
content.append("BT /F1 12 Tf 930 340 Td (File Storage) Tj ET")

# Connection arrows
content.append("0 0 0 rg")
content.append(arrow(170, 510, 230, 515))
content.append(arrow(170, 330, 230, 335))
content.append(arrow(450, 515, 560, 515))
content.append(arrow(450, 335, 560, 405))
content.append(arrow(820, 515, 860, 480))
content.append(arrow(820, 395, 860, 340))
content.append(arrow(690, 470, 690, 440))

# PDF objects
objects = []
objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".encode())
objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

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

with open("ARCH.pdf", "wb") as f:
    f.write(b"".join(pdf))

print("ARCH.pdf written")
