// Function Declaration

function display(message) {
  console.log(message);
}
console.log("Starting the program...");

// Function Expression
const cube = function calCube(num) {
  return num * num * num;
};

console.log(cube(25));

// Arrow Function
const subtract = (a, b) => a - b;
console.log(subtract(10, 5));

//Checing the scope of function declaration

function test() {
  var a = 30;
  let b = 40;
  const c = 50;
  console.log(a, b, c); // 30 40 50
}
test();
//console.log("const - c", c); // ReferenceError: c is not defined
//console.log(" var - a ", a); // ReferenceError: a is not defined
//console.log("let - b", b); // ReferenceError: b is not defined
