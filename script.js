// Load saved data when the page opens
window.onload = function() {
    loadSavedData();
    // Only add one empty row if there are no saved courses
    if (document.getElementById('courses-container').children.length === 0) {
        addCourse();
    }
};

// Function to add a new course input row
function addCourse() {
    const container = document.getElementById('courses-container');
    const row = document.createElement('div');
    row.className = 'course-row';
    row.innerHTML = `
        <input type="text" class="course-name" placeholder="Course Name (e.g. MATH 101)" required>
        <input type="number" class="score" placeholder="Score (0-100)" min="0" max="100" required>
        <input type="number" class="credit" placeholder="Credit Unit (e.g. 3)" min="1" step="1" required>
    `;
    container.appendChild(row);
}

// Save current form data and result to localStorage
function saveData(name, courses, resultHtml) {
    localStorage.setItem('gpaName', name);
    localStorage.setItem('gpaCourses', JSON.stringify(courses));
    localStorage.setItem('gpaResult', resultHtml);
}

// Load previously saved data from localStorage
function loadSavedData() {
    const savedName = localStorage.getItem('gpaName');
    const savedCourses = JSON.parse(localStorage.getItem('gpaCourses'));
    const savedResult = localStorage.getItem('gpaResult');

    if (savedName) {
        document.getElementById('name').value = savedName;
    }

    if (savedCourses && savedCourses.length > 0) {
        // Clear any default/empty rows
        document.getElementById('courses-container').innerHTML = '';

        savedCourses.forEach(course => {
            const row = document.createElement('div');
            row.className = 'course-row';
            row.innerHTML = `
                <input type="text" class="course-name" value="${course.name}" required>
                <input type="number" class="score" value="${course.score}" min="0" max="100" required>
                <input type="number" class="credit" value="${course.credit}" min="1" step="1" required>
            `;
            document.getElementById('courses-container').appendChild(row);
        });
    }

    if (savedResult) {
        document.getElementById('result').innerHTML = savedResult;
    }
}

// Clear everything (form + saved data + result)
function clearData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        localStorage.removeItem('gpaName');
        localStorage.removeItem('gpaCourses');
        localStorage.removeItem('gpaResult');

        document.getElementById('name').value = '';
        document.getElementById('courses-container').innerHTML = '';
        addCourse(); // Start fresh with one empty row
        document.getElementById('result').innerHTML = '';
    }
}

// Calculate GPA and show result
async function calculateGPA() {
    const name = document.getElementById('name').value.trim() || "Student";
    const courses = [];
    let valid = true;

    // Collect data from existing rows only — no adding new rows here
    document.querySelectorAll('.course-row').forEach(row => {
        const courseName = row.querySelector('.course-name').value.trim();
        const score = parseFloat(row.querySelector('.score').value);
        const credit = parseInt(row.querySelector('.credit').value);

        if (courseName && !isNaN(score) && !isNaN(credit) && credit > 0) {
            courses.push({ name: courseName, score, credit });
        } else {
            valid = false;
        }
    });

    if (!valid || courses.length === 0) {
        document.getElementById('result').innerHTML = 
            '<strong style="color: red;">Please fill all fields correctly for at least one course.</strong>';
        return;
    }

    try {
        const response = await fetch('https://schoolresultpro-backend.onrender.com/calculate_gpa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, courses })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();

        const resultHtml = `
            <strong>Student:</strong> ${name}<br>
            <strong>GPA:</strong> ${data.gpa.toFixed(2)}<br>
            <strong>Class of Degree:</strong> ${data.class_of_degree}
        `;

        document.getElementById('result').innerHTML = resultHtml;

        // Save to localStorage so it persists on refresh
        saveData(name, courses, resultHtml);
    } catch (error) {
        document.getElementById('result').innerHTML = 
            '<strong style="color: red;">Error: Could not connect to the server. Make sure the backend is running.</strong>';
        console.error('Calculate GPA error:', error);
    }
}

// Generate and download PDF (no payment)
async function generatePDF() {
    const name = document.getElementById('name').value.trim() || "Student";
    const courses = [];
    let valid = true;

    document.querySelectorAll('.course-row').forEach(row => {
        const courseName = row.querySelector('.course-name').value.trim();
        const score = parseFloat(row.querySelector('.score').value);
        const credit = parseInt(row.querySelector('.credit').value);

        if (courseName && !isNaN(score) && !isNaN(credit) && credit > 0) {
            courses.push({ name: courseName, score, credit });
        } else {
            valid = false;
        }
    });

    if (!valid || courses.length === 0) {
        alert("Please fill all course fields correctly before exporting PDF.");
        return;
    }

    try {
        const response = await fetch('https://schoolresultpro-backend.onrender.com/generate_pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, courses })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const blob = await response.blob();

        if (blob.size === 0) {
            alert('The PDF file is empty. Please check your input data.');
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name.replace(/\s+/g, '_') || 'student'}_result.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('PDF downloaded! Check your Downloads folder.');
    } catch (err) {
        console.error('PDF generation/download error:', err);
        alert('Failed to download PDF.\n\nMake sure:\n• Backend server is running\n• You entered valid course data\n\nCheck browser console (F12) for more details.');
    }
}