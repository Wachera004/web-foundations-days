const loadUsersBtn = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusMsg = document.getElementById("status");
const usersList = document.getElementById("users-list");

// Global array to store fetched users for client-side filtering
let allUsers = [];

// Function to draw any array of users securely using createElement & textContent
function renderUsers(usersToRender) {
  usersList.innerHTML = "";

  if (usersToRender.length === 0 && allUsers.length > 0) {
    const li = document.createElement("li");
    li.textContent = "No users match your filter.";
    li.style.color = "#777";
    li.style.fontStyle = "italic";
    usersList.appendChild(li);
    return;
  }

  usersToRender.forEach(user => {
    const li = document.createElement("li");

    const nameP = document.createElement("p");
    nameP.innerHTML = `<strong>Name:</strong> ${user.name}`;

    const emailP = document.createElement("p");
    emailP.innerHTML = `<strong>Email:</strong> ${user.email}`;

    const cityP = document.createElement("p");
    cityP.innerHTML = `<strong>City:</strong> ${user.address.city}`;

    const companyP = document.createElement("p");
    companyP.innerHTML = `<strong>Company:</strong> ${user.company.name}`;

    li.appendChild(nameP);
    li.appendChild(emailP);
    li.appendChild(cityP);
    li.appendChild(companyP);

    usersList.appendChild(li);
  });
}

// Async function to load users from the API
async function loadUsers() {
  loadUsersBtn.disabled = true;
  statusMsg.textContent = "Loading users...";
  usersList.innerHTML = "";

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");
    
    // Check if response is successful
    if (!response.ok) {
      throw new Error(`Failed to fetch users (Status: ${response.status})`);
    }

    allUsers = await response.json();
    statusMsg.textContent = `Successfully loaded ${allUsers.length} users.`;
    renderUsers(allUsers);
  } catch (error) {
    statusMsg.textContent = `Error: ${error.message}`;
  } finally {
    loadUsersBtn.disabled = false;
  }
}

// Event listener for the load button
loadUsersBtn.addEventListener("click", loadUsers);

// Filter input listener (filters existing array without a new request)
filterInput.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allUsers.filter(user => 
    user.name.toLowerCase().includes(query)
  );
  renderUsers(filtered);
});