export function calculateTotal(items: any[]) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    // Bug: Potential undefined access if price is missing
    // Bug: String concatenation if price is a string
    total += items[i].price;
  }
  return total;
}

export function getUserData(userId: string) {
  // Bug: No error handling for fetch
  const response = fetch(`/api/users/${userId}`);
  // Bug: response.json() is async, missing await
  const data = response.json();
  return data;
}

export class UserManager {
  private users: any[];

  constructor() {
    this.users = [];
  }

  addUser(user: any) {
    // Bug: No validation
    this.users.push(user);
  }

  findUser(email: string) {
    // Bug: potential crash if user or email is null
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }
}