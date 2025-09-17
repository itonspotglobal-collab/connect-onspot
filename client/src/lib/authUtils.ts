export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

// User role checking utilities
export function hasRole(user: any, role: string): boolean {
  return user?.role === role;
}

export function isAdmin(user: any): boolean {
  return hasRole(user, 'admin');
}

export function isClient(user: any): boolean {
  return hasRole(user, 'client');
}

export function isTalent(user: any): boolean {
  return hasRole(user, 'talent');
}

export function canAccessAdminFeatures(user: any): boolean {
  return isAdmin(user);
}