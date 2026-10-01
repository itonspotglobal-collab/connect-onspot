/**
 * Validate password strength requirements
 * @param password - Password to validate
 * @returns Object with validation results
 */
export const PASSWORD_POLICY_HINT = 'Use 8–128 characters with uppercase (A–Z) and lowercase (a–z) letters, a number (0–9), and a special character from this list: ! @ # $ % ^ & * ( ) _ + - = [ ] { } ; \' : " \\ | , . < > / ?';

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (password.length > 128) {
    errors.push("Password must be less than 128 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}