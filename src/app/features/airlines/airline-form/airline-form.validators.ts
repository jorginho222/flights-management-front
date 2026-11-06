import { AbstractControl, ValidationErrors } from '@angular/forms';
import { isEmpty } from '../../../shared/forms/validators';

/** Airline codes are 2 letters or digits, such as LA or U2, as the API requires. */
export function airlineCode(control: AbstractControl): ValidationErrors | null {
  return isEmpty(control.value) || /^[A-Z0-9]{2}$/.test(String(control.value).trim().toUpperCase())
    ? null
    : { airlineCode: true };
}
