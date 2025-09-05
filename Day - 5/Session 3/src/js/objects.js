// objects.js

// Object creation
const student = {
  name: "Akshta Divate",
  age: 23,
  education: "Computer Engineering",
  skills: ["Java", "C++", "HTML", "CSS", "JavaScript"],

  // Method
  introduce: function () {
    return `Hi, I am ${this.name}, graduate in ${this.education}`;
  },
};

console.log(student.introduce());

// Access properties
console.log("Name:", student.name);
console.log("Skills:", student.skills.join(", "));

// Iterate properties
for (let key in student) {
  if (student.hasOwnProperty(key)) {
    console.log(`${key}: ${student[key]}`);
  }
}

// Object.keys example
Object.keys(student).forEach((key) => {
  console.log(`(Object.keys) ${key}: ${student[key]}`);
});
