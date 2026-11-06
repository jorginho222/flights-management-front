import { Component, effect, inject, input, untracked } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toAirline, toAirlineFormValue, AirlineFormValue } from '../data/airline-form.mapper';
import { AirlinesStore } from '../data/airlines.store';
import { FLIGHT_CLASSES } from '../../../shared/flight-classes';
import { integer, maxDecimals, trimmedLength } from '../../../shared/forms/validators';
import { airlineCode } from './airline-form.validators';

interface FieldError {
  key: string;
  params?: Record<string, unknown>;
}

@Component({
  selector: 'app-airline-form',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './airline-form.html',
  styleUrl: './airline-form.scss',
})
export class AirlineForm {
  /** Bound from the `:id` route parameter; absent when creating. */
  readonly id = input<string>();

  protected readonly store = inject(AirlinesStore);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly flightClasses = FLIGHT_CLASSES;
  protected readonly luggagePriceFields = [
    'handBaggagePrice',
    'checkedLuggagePrice',
    'exceededWeightPrice',
  ] as const;

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, trimmedLength(3, 50)]],
    code: ['', [Validators.required, airlineCode]],
    redeemFee: this.numberControl(maxDecimals(2)),
    luggage: this.formBuilder.group({
      handBaggagePrice: this.numberControl(),
      maxHandBaggage: this.numberControl(integer),
      checkedLuggagePrice: this.numberControl(),
      exceededWeightPrice: this.numberControl(),
    }),
    classIncrements: this.formBuilder.group({
      economy: this.numberControl(),
      premiumEconomy: this.numberControl(),
      business: this.numberControl(),
      first: this.numberControl(),
    }),
  });

  /** Kept across attempts, so retrying after a lost response can't create a second airline. */
  private newAirlineId?: string;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.form.reset();
        if (id) {
          this.store.loadOne(id);
        } else {
          this.store.resetForm();
        }
      });
    });

    effect(() => {
      const airline = this.store.selected();
      if (airline && airline.id === untracked(this.id)) {
        untracked(() => this.form.reset(toAirlineFormValue(airline)));
      }
    });
  }

  protected retryLoad(): void {
    const id = this.id();
    if (id) {
      this.store.loadOne(id);
    }
  }

  protected uppercaseCode(): void {
    const control = this.form.controls.code;
    control.setValue(control.value.toUpperCase(), { emitEvent: false });
  }

  protected fieldError(control: AbstractControl): FieldError | null {
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if (errors['required']) {
      return { key: 'validation.required' };
    }
    if (errors['trimmedLength']) {
      const { min, max } = errors['trimmedLength'];
      return { key: 'validation.length', params: { min, max } };
    }
    if (errors['airlineCode']) {
      return { key: 'validation.airlineCode' };
    }
    if (errors['min']) {
      return { key: 'validation.min', params: { min: errors['min'].min } };
    }
    if (errors['integer']) {
      return { key: 'validation.integer' };
    }
    if (errors['maxDecimals']) {
      return { key: 'validation.maxDecimals', params: { max: errors['maxDecimals'].max } };
    }
    return null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const existingId = this.id();
    const id = existingId ?? (this.newAirlineId ??= crypto.randomUUID());
    const airline = toAirline(id, this.form.getRawValue() as AirlineFormValue);

    this.store.save({
      airline,
      isNew: !existingId,
      onSuccess: () => {
        const key = existingId ? 'airlines.form.updated' : 'airlines.form.created';
        this.snackBar.open(
          this.transloco.translate(key, { name: airline.name }),
          this.transloco.translate('common.dismiss'),
          { duration: 4000 },
        );
        void this.router.navigate(['/airlines']);
      },
    });
  }

  private numberControl(...extra: ValidatorFn[]) {
    return this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      ...extra,
    ]);
  }
}
