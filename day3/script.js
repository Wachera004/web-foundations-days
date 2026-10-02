let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// 1. searchNotes(word)
function searchNotes(word) {
  return notes.filter(note => 
    note.text.toLowerCase().includes(word.toLowerCase())
  );
}

// 2. longestNote()
function longestNote() {
  if (notes.length === 0) return null;
  return notes.reduce((longest, current) => 
    current.text.length > longest.text.length ? current : longest
  );
}

// 3. countByCategory()
function countByCategory() {
  let counts = { personal: 0, work: 0, study: 0 };
  for (let note of notes) {
    if (counts[note.category] !== undefined) {
      counts[note.category]++;
    }
  }
  return counts;
}

// 4. getSummary()
function getSummary() {
  let counts = countByCategory();
  let total = notes.length;
  let noteLabel = total === 1 ? "note" : "notes";
  return `${total} ${noteLabel}: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}

// 5. isDuplicate(text)
function isDuplicate(text) {
  let cleanText = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === cleanText);
}

// 6. addNote(text, category)
function addNote(text, category) {
  let validCategories = ["personal", "work", "study"];
  
  if (text.length < 1 || text.length > 200) {
    console.log("Failed: Text must be between 1 and 200 characters.");
    return false;
  }
  if (!validCategories.includes(category)) {
    console.log("Failed: Invalid category. Must be personal, work, or study.");
    return false;
  }
  if (isDuplicate(text)) {
    console.log("Failed: Duplicate note already exists.");
    return false;
  }

  let newId = notes.length > 0 ? notes[notes.length - 1].id + 1 : 1;
  notes.push({ id: newId, text: text.trim(), category });
  console.log("Success: Note added.");
  return true;
}


// Test searchNotes
console.log(searchNotes("study")); 

console.log(searchNotes("xyz")); 


// Test longestNote
console.log(longestNote()); 

// Test countByCategory
console.log(countByCategory()); 


// Test getSummary
console.log(getSummary()); 


// Test isDuplicate
console.log(isDuplicate("call mum")); 


console.log(isDuplicate("Learn Python")); 


// Test addNote
console.log(addNote("Submit assignment", "study")); 


console.log(addNote("Buy milk and bread", "personal")); 
