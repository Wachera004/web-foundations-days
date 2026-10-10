PRAGMA foreign_keys = ON;

-- Drop tables if they exist to allow clean re-runs
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS courses;

-- 1. Students Table
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- 2. Courses Table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

-- 3. Enrolments Table (Join table for Many-to-Many relationship)
CREATE TABLE enrolments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    -- Prevents the same student from enrolling in the same course twice
    UNIQUE(student_id, course_id)
);

-- --- INSERT SAMPLE DATA ---

-- Add Students (at least 3)
INSERT INTO students (name, email) VALUES
('Alice Wanjiku', 'alice@example.com'),
('Brian Kiprop', 'brian@example.com'),
('Cynthia Achieng', 'cynthia@example.com'),
('David Omondi', 'david@example.com'); -- Extra student with no enrolments for testing LEFT JOIN

-- Add Courses (at least 3)
INSERT INTO courses (title, code) VALUES
('Database Systems', 'IT101'),
('Web Development', 'IT102'),
('Computer Networks', 'IT103');

-- Add Enrolments (at least 5, mapping students to courses with grades)
INSERT INTO enrolments (student_id, course_id, grade) VALUES
(1, 1, 'A'),
(1, 2, 'B'),
(2, 1, 'B+'),
(2, 3, 'A'),
(3, 2, 'A-');


-- --- REQUIRED QUERIES ---

-- Query 1: All courses for one student (by name, e.g., 'Alice Wanjiku')
SELECT c.title AS course_title, c.code, e.grade
FROM enrolments e
JOIN students s ON e.student_id = s.id
JOIN courses c ON e.course_id = c.id
WHERE s.name = 'Alice Wanjiku';

-- Query 2: All students on one course (by course code, e.g., 'IT101')
SELECT s.name AS student_name, s.email, e.grade
FROM enrolments e
JOIN students s ON e.student_id = s.id
JOIN courses c ON e.course_id = c.id
WHERE c.code = 'IT101';

-- Query 3: The number of students per course
SELECT c.title AS course_title, c.code, COUNT(e.student_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON c.id = e.course_id
GROUP BY c.id, c.title, c.code;

-- Query 4: Students who have no enrolments
SELECT s.id, s.name, s.email
FROM students s
LEFT JOIN enrolments e ON s.id = e.student_id
WHERE e.id IS NULL;

-- Query 5: Update one enrolment's grade
UPDATE enrolments
SET grade = 'A+'
WHERE student_id = 1 AND course_id = 1;