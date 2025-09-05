function getUser(id) {
  console.log("Fetching user with id:", id);
  return { id: id, name: "User" + id, age: 20 + id };
}

function calculateDiscount(user) {
  if (user.age < 25) {
    return 10; // 10% discount
  } else if (user.age < 40) {
    return 5;  
  } else {
    return 0;  
  }
}


function createOrder(userId, amount) {
  let user = getUser(userId);            
  let discount = calculateDiscount(user); // 
  let finalAmount = amount - (amount * discount / 100);
  return {total: finalAmount };
}

console.log("Starting code...");
let order = createOrder(3, 1000);  
console.log("Order Details:", order);
console.log("Code finished.");
