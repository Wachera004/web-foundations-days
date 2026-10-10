# School Database System Design

## Table Explanations & Architecture

### 1. `students` Table
* **Purpose:** Stores core personal and contact details for each student registered in the school.
* **Columns:** `id` (Primary Key), `name` (Student's full name), `email` (Unique communication address).

### 2. `courses` Table
* **Purpose:** Catalogues the various educational subjects or units offered by the institution.
* **Columns:** `id` (Primary Key), `title` (Course name), `code` (Unique institutional identifier like IT101).

### 3. `enrolments` Table
* **Purpose:** Acts as a junction (join) table to bridge the many-to-many relationship between students and courses while storing enrollment-specific metadata.
* **Columns:** `id` (Primary Key), `student_id` (Foreign Key referencing `students`), `course_id` (Foreign Key referencing `courses`), `grade` (Achieved score).

---

## Relationships & Join Table Necessity
* **Student to Course Relationship:** This is a **Many-to-Many** relationship. A single student can register for multiple courses, and a single course can have many students enrolled in it.
* **Why a Join Table is Needed:** Relational databases cannot natively store multi-valued arrays in a single column while maintaining structural integrity. The `enrolments` table resolves this by breaking the many-to-many relationship into two one-to-many relationships (`students` to `enrolments`, and `courses` to `enrolments`). It also allows us to cleanly track attributes that belong specifically to the *relationship* itself, such as the student's `grade` and a composite unique constraint preventing duplicate course registrations.

---

## Database Indexing
* **Recommended Index:** An index on `enrolments(course_id)`.
* **Reason:** This index speeds up lookups and aggregations that find or count the students enrolled in a course. The unique constraint on `(student_id, course_id)` already creates an index that supports student-based lookups.

---

## SQL vs. NoSQL Justification
For a school management system handling students, courses, grades, and fee records, a **Relational Database (SQL)** is definitively the superior choice over NoSQL. Educational institutions require strict data integrity, adherence to ACID (Atomicity, Consistency, Isolation, Durability) properties, and predictable relational constraints—such as ensuring a grade cannot be assigned to a non-existent student or course, and preventing duplicate enrollments via unique keys. SQL handles these structured relationships, complex multi-table joins, and transactional consistency natively, whereas NoSQL's flexible document model would introduce data duplication and make transactional grade reporting unnecessarily complicated.