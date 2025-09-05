let title = document.getElementById("title");
let message = document.getElementById("message");
let changeBtn = document.getElementById("changeBtn");
let colorBtn = document.getElementById("colorBtn");
let addItemBtn = document.getElementById("addItemBtn");
let inputBox = document.getElementById("inputBox");
let liveText = document.getElementById("liveText");
let itemList = document.getElementById("itemList");
let demoForm = document.getElementById("demoForm");
let formInput = document.getElementById("formInput");
let statusBar = document.getElementById("statusBar");
let darkModeBtn = document.getElementById("darkModeBtn");


// Update text when "Change Text" button is clicked
changeBtn.addEventListener("click", () => {
  message.textContent = "You clicked the Change button! ";
  message.classList.add("highlight");
});

// Toggle a class when "Toggle Color" button is clicked
colorBtn.addEventListener("click", () => {
  title.classList.toggle("colored");
});

// Live update text as user types
inputBox.addEventListener("input", () => {
  liveText.textContent = inputBox.value || "Your typing will appear here...";
});

// 4. Add a new list item when "Add Item" button is clicked
addItemBtn.addEventListener("click", () => {
  let newItem = document.createElement("li");
  newItem.textContent = "New Item " + (itemList.children.length + 1);
  itemList.appendChild(newItem);

  // add event listener to new item
  newItem.addEventListener("click", () => {
    alert("You clicked on " + newItem.textContent);
  });
});

// Add hover effect on title
title.addEventListener("mouseover", () => {
  title.classList.add("hovered");
});
title.addEventListener("mouseout", () => {
  title.classList.remove("hovered");
});

//  Detect Enter key in input box
inputBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    alert("You pressed Enter! Value: " + inputBox.value);
  }
});

//  Add click events to initial list items
let items = document.querySelectorAll("#itemList li");
items.forEach(item => {
  item.addEventListener("click", () => {
    alert("You clicked on " + item.textContent);
  });
});


// Right-click on message -> custom alert
message.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  alert("Right-click detected on message!");
});

// Window resize -> show width & height
window.addEventListener("resize", () => {
  statusBar.textContent = `Window size: ${window.innerWidth} x ${window.innerHeight}`;
});

// Keyup vs keydown on inputBox
inputBox.addEventListener("keydown", () => {
  console.log("Key down: " + inputBox.value);
});
inputBox.addEventListener("keyup", () => {
  console.log("Key up: " + inputBox.value);
});

//  Form submit -> prevent default
demoForm.addEventListener("submit", (event) => {
  event.preventDefault(); // stops page reload
  alert("Form submitted with value: " + formInput.value);
});

// Dark mode toggle
darkModeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});


















// // Select elements
// let title = document.getElementById("title");
// let message = document.getElementById("message");
// let changeBtn = document.getElementById("changeBtn");
// let colorBtn = document.getElementById("colorBtn");
// let addItemBtn = document.getElementById("addItemBtn");
// let inputBox = document.getElementById("inputBox");
// let liveText = document.getElementById("liveText");
// let itemList = document.getElementById("itemList");


// // Update text when "Change Text" button is clicked
// changeBtn.addEventListener("click", () => {
//   message.textContent = "You clicked the Change button! ";
//   message.classList.add("highlight");
// });

// // Toggle a class when "Toggle Color" button is clicked
// colorBtn.addEventListener("click", () => {
//   title.classList.toggle("colored");
// });

// // Live update text as user types
// inputBox.addEventListener("input", () => {
//   liveText.textContent = inputBox.value || "Your typing will appear here...";
// });

// // Add a new list item when "Add Item" button is clicked
// addItemBtn.addEventListener("click", () => {
//   let newItem = document.createElement("li");
//   newItem.textContent = "New Item " + (itemList.children.length + 1);
//   itemList.appendChild(newItem);

//   // add event listener to new item
//   newItem.addEventListener("click", () => {
//     alert("You clicked on " + newItem.textContent);
//   });
// });

// // Add hover effect on title
// title.addEventListener("mouseover", () => {
//   title.classList.add("hovered");
// });
// title.addEventListener("mouseout", () => {
//   title.classList.remove("hovered");
// });

// //  Detect Enter key in input box
// inputBox.addEventListener("keydown", (event) => {
//   if (event.key === "Enter") {
//     alert("You pressed Enter! Value: " + inputBox.value);
//   }
// });

// //  Add click events to initial list items
// let items = document.querySelectorAll("#itemList li");
// items.forEach(item => {
//   item.addEventListener("click", () => {
//     alert("You clicked on " + item.textContent);
//   });
// });
