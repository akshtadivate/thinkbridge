# JavaScript Basics - 

In this task, I used the basic JavaScript like Variables, Functions, Datatypes, Conditinal Statements, Looping Statements, Array, Strings.

Each exercise is having its solution, and all solutions are also implemented in /src/js/basics.js file.

## 1. Variables

```js
let firstName = "Akshta";
let lastName = "Divate";

console.log(firstName + " " + lastName);

let city = "Pune";
console.log("City:", city);

let age = 23;
console.log("Age:", age);

let salary = 45000.50;
console.log("Salary:", salary);

let married = false;
console.log("Married:", married);

let person = {
  name: "Akshta",
  age: 23,
  city: "Pune"
};

```

In this Covers: Strings, numbers, float, boolean, object.


### Data Types

```js
console.log("Type of firstName:", typeof firstName);
console.log("Type of age:", typeof age);
console.log("Type of salary:", typeof salary);
console.log("Type of married:", typeof married);
```

In this Covers: typeof operator for different variable types.

## 2. String Methods
```js

let course = "JavaScript Basics File";
console.log("Length:", course.length);
console.log("Last char:", course[course.length - 1]);
console.log("Concatenation:", "Hello" + " " + "World");
console.log("Replaced:", course.replace("Basics", "Advanced"));
console.log("Uppercase:", course.toUpperCase());
console.log("Lowercase:", course.toLowerCase());
console.log("Substring (0,10):", course.substring(0, 10));
console.log("Index of 'Script':", course.indexOf("Script"));
console.log("Character at index 5:", course.charAt(5));
```

In this Covers: Length, concatenation, replace, case conversion, substring, index, and character access.

## 3. Arrays

```js

let fruits = ["Apple", "Banana", "Cherry", "Mango", "Orange", "Pineapple", "Grapes", "Peach", 
  "Strawberry", "Watermelon"];

console.log("Fruits:", fruits);
console.log("First fruit:", fruits[0]);
console.log("Last fruit:", fruits[fruits.length - 1]);
console.log("Total fruits:", fruits.length);

fruits.push("Kiwi"); // add at end
console.log("After push:", fruits);   
fruits.pop(); // remove last element
console.log("After pop:", fruits);    
fruits.shift(); // remove first element
console.log("After shift:", fruits);  
fruits.unshift("Papaya"); // add at start
console.log("After unshift:", fruits);

```
In this Covers: Array creation, push, pop, shift, unshift, index.

## 4. Loops
```js

console.log("Numbers 1 to 10 using For Loop:");
for (let i = 1; i <= 10; i++) {
   console.log(i);
}

console.log("Numbers 10 down to 1 using while loop:");
let j = 10;
while (j >= 1) {
  console.log(j);
  j--;
}

console.log("Numbers 10 down to 1 using do-while loop:");
let k = 10;
do {
  console.log(k);
  k--;
} while (k >= 1);

console.log("Colors array loop:");
let arr = ["red", "green", "blue", "pink", "black", "white"];
for (let c of arr) {
  console.log(c);
}

```
In this Covers: for loop, while loop, do-while loop, array loop.

## 5. Conditionals
```js

console.log("Using if-else");
let num = 7;
if (num % 2 === 0) console.log(num, "is Even");
else console.log(num, "is Odd");

console.log("Using if else-if else");
let x = -3;
if (x > 0) console.log(x, "is Positive");
else if (x < 0) console.log(x, "is Negative");
else console.log(x, "is Zero");

```

In this Covers: if-else and if else-if conditions.

## 6. Functions
```js

function display(name) {
  return "Hello " + name;
}

// Function expression
const square = function (n) {
  return n * n;
};

// Arrow function
const multiply = (a, b) => a * b;

console.log(display("Akshta"));
console.log(square(4));
console.log(multiply(3, 5));

```

In this Covers: Function declaration, parameters, return value, normal function, function expression, arrow function.


## 7. Operator

```js
let a = 20, b = 9;

console.log("a + b =", a + b); // Addition
console.log("a - b =", a - b); // Subtraction
console.log("a * b =", a * b); // Multiplication
console.log("a / b =", a / b); // Division
console.log("a % b =", a % b); // Modulus
console.log("a ** b =", a ** b); // Exponentiation

console.log("25" === 25);
console.log("77" == 77);
console.log(66 > 100);
console.log(120 < 200);
console.log(75 <= 30);
console.log(85 >= 85);

console.log(true && false); 
console.log(true || false); 
console.log(!true);

```

In this covers: Operators like  Arithmetic operator, Comparison operator, Logical operator
