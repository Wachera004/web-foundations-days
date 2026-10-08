# Library REST API Design

## Overview
This document specifies the REST API endpoints for managing a library's books resource. Base URL: `/api/v1`

---

## Endpoints

### 1. List All Books (or filter by author)
* **Method:** `GET`
* **Path:** `/books`
* **Query Parameters:** `author` (optional) - filters books by author name.
* **Description:** Retrieves a list of all books in the library inventory, or a subset matching a specific author query.
* **Success Status Code:** `200 OK`

### 2. Get a Single Book
* **Method:** `GET`
* **Path:** `/books/{id}`
* **Description:** Retrieves detailed information for a single book by its unique ID.
* **Success Status Code:** `200 OK`

### 3. Create a New Book
* **Method:** `POST`
* **Path:** `/books`
* **Description:** Adds a new book entry to the library system.
* **Example Request Body:**
  ```json
  {
    "title": "The River and the Source",
    "author": "Margaret Ogola",
    "publishedYear": 1994,
    "isbn": "9966-882-05-7"
  }