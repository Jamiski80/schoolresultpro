from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io
import csv
from typing import List

app = FastAPI()

# Allow frontend to connect (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup (SQLite)
def init_db():
    conn = sqlite3.connect('results.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY, student_name TEXT, gpa REAL)''')
    conn.commit()
    conn.close()

init_db()

# Pydantic models
class Course(BaseModel):
    name: str
    score: float
    credit: int

class StudentData(BaseModel):
    name: str
    courses: List[Course]

# GPA calculation function (Nigerian 5.0 scale example)
def calculate_gpa(courses):
    total_points = 0
    total_credits = 0
    for course in courses:
        score = course.score
        credit = course.credit
        if score >= 70: grade_point = 5
        elif score >= 60: grade_point = 4
        elif score >= 50: grade_point = 3
        elif score >= 45: grade_point = 2
        elif score >= 40: grade_point = 1
        else: grade_point = 0
        total_points += grade_point * credit
        total_credits += credit
    return total_points / total_credits if total_credits > 0 else 0

# Endpoint for student GPA calculation
@app.post("/calculate_gpa")
def calc_gpa(data: StudentData):
    gpa = calculate_gpa(data.courses)
    conn = sqlite3.connect('results.db')
    c = conn.cursor()
    c.execute("INSERT INTO results (student_name, gpa) VALUES (?, ?)", (data.name, gpa))
    conn.commit()
    conn.close()
    return {"gpa": gpa, "class_of_degree": get_class_of_degree(gpa)}

def get_class_of_degree(gpa):
    if gpa >= 4.5: return "First Class"
    elif gpa >= 3.5: return "Second Class Upper"
    elif gpa >= 2.4: return "Second Class Lower"
    elif gpa >= 1.5: return "Third Class"
    else: return "Pass"

# Endpoint for PDF export
@app.post("/generate_pdf")
def generate_pdf(data: StudentData):
    gpa = calculate_gpa(data.courses)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.drawString(100, 750, f"Student: {data.name}")
    c.drawString(100, 730, f"GPA: {gpa}")
    c.drawString(100, 710, f"Class: {get_class_of_degree(gpa)}")
    y = 690
    for course in data.courses:
        c.drawString(100, y, f"{course.name}: Score {course.score}, Credit {course.credit}")
        y -= 20
    c.save()
    buffer.seek(0)
    return {"pdf_content": buffer.getvalue().hex()}  # Return as hex for frontend download

# Endpoint for bulk upload (for schools)
@app.post("/bulk_upload")
async def bulk_upload(file: UploadFile = File(...)):
    content = await file.read()
    decoded = content.decode()
    reader = csv.reader(io.StringIO(decoded))
    next(reader)  # Skip header
    results = []
    for row in reader:
        name = row[0]
        courses = []  # Parse courses from row (assume format: name, course1_score, course1_credit, ...)
        for i in range(1, len(row), 2):
            courses.append({"name": f"Course {(i+1)//2}", "score": float(row[i]), "credit": int(row[i+1])})
        gpa = calculate_gpa(courses)
        results.append({"name": name, "gpa": gpa})
    return {"results": results}

# Run the server (for testing)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)