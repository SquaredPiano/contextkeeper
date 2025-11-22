// examples/buggy-code.ts

interface User {
  id: string;
  email?: string;
  age: number | null;
}

export function processUser(data: any) {
  // Validate top-level shape first
  const user = data?.user;
  if (!user || typeof user !== 'object') {
    throw new TypeError('Missing or invalid `user` object');
  }

  // Validate id early — return null (or throw) if invalid
  const id = String(user.id ?? '');
  if (id.length < 5) {
    console.warn('Invalid id');
    return null;
  }

  // Safely normalize email if present
  const rawEmail = typeof user.email === 'string' ? user.email : null;
  const normalizedEmail = rawEmail ? rawEmail.toLowerCase() : null;

  // Safely compute age in months; return null when not available
  const age = typeof user.age === 'number' ? user.age : null;
  const ageInMonths = age !== null ? age * 12 : null;

  return {
    email: normalizedEmail,
    months: ageInMonths
  };
}
