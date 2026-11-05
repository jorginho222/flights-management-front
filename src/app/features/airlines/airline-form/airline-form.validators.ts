import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** Measures the trimmed text, because that's what gets submitted. */
export function trimmedLength(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isEmpty(control.value)) {
      return null;
    }
    const length = String(control.value).trim().length;
    return length >= min && length <= max ? null : { trimmedLength: { min, max } };
  };
}

export function integer(control: AbstractControl): ValidationErrors | null {
  return isEmpty(control.value) || Number.isInteger(control.value) ? null : { integer: true };
}

export function maxDecimals(max: number): ValidatorFn {
  const pattern = new RegExp(`^-?\\d+(\\.\\d{1,${max}})?$`);
  return (control: AbstractControl): ValidationErrors | null =>
    isEmpty(control.value) || pattern.test(String(control.value)) ? null : { maxDecimals: { max } };
}

/** Airline codes are 2 letters or digits, such as LA or U2, as the API requires. */
export function airlineCode(control: AbstractControl): ValidationErrors | null {
  return isEmpty(control.value) || /^[A-Z0-9]{2}$/.test(String(control.value).trim().toUpperCase())
    ? null
    : { airlineCode: true };
}
