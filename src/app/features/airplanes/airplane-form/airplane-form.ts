import { Component, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { FLIGHT_CLASSES, FlightClass } from '../../../shared/flight-classes';
import { integer, notBlank } from '../../../shared/forms/validators';
import {
  AirplaneFormValue,
  countSeats,
  toAirplaneFormValue,
  toAirplaneInput,
} from '../data/airplane-form.mapper';
import { airplaneName, MAX_SEAT_COLUMNS, MAX_SEAT_ROWS } from '../data/airplane.model';
import { AirplanesStore } from '../data/airplanes.store';

interface FieldError {
  key: string;
  params?: Record<string, unknown>;
}

/** The API rejects an airplane without seats. */
function atLeastOneSeatClass(group: AbstractControl): ValidationErrors | null {
  const seats = group.value as Partial<AirplaneFormValue['seats']>;
  return Object.values(seats).some((seat) => seat?.enabled) ? null : { noSeatClasses: true };
}

@Component({
  selector: 'app-airplane-form',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './airplane-form.html',
  styleUrl: './airplane-form.scss',
})
export class AirplaneForm {
  /** Bound from the `:id` route parameter; absent when creating. */
  readonly id = input<string>();

  protected readonly store = inject(AirplanesStore);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly flightClasses = FLIGHT_CLASSES;
  protected readonly maxRows = MAX_SEAT_ROWS;
  protected readonly maxColumns = MAX_SEAT_COLUMNS;

  protected readonly form = this.formBuilder.group({
    brand: ['', [Validators.required, notBlank]],
    model: ['', [Validators.required, notBlank]],
    seats: this.formBuilder.group(
      {
        // A new airplane starts with economy, which almost every airplane has
        economy: this.seatClassGroup(true),
        premiumEconomy: this.seatClassGroup(false),
        business: this.seatClassGroup(false),
        first: this.seatClassGroup(false),
      },
      { validators: atLeastOneSeatClass },
    ),
  });

  /** Always the seat total, which is what the API requires the capacity to be. */
  protected readonly capacity = toSignal(
    this.form.controls.seats.valueChanges.pipe(
      startWith(null),
      map(() => countSeats(this.form.controls.seats.getRawValue())),
    ),
    { requireSync: true },
  );

  /** Kept across attempts, so retrying after a lost response can't create a second airplane. */
  private newAirplaneId?: string;

  constructor() {
    const destroyRef = inject(DestroyRef);
    for (const flightClass of FLIGHT_CLASSES) {
      const group = this.form.controls.seats.controls[flightClass];
      // Disabled quantities skip validation, and keep their values for re-enabling
      group.controls.enabled.valueChanges
        .pipe(startWith(group.controls.enabled.value), takeUntilDestroyed(destroyRef))
        .subscribe((enabled) => {
          for (const control of [group.controls.rows, group.controls.columns]) {
            if (enabled) {
              control.enable({ emitEvent: false });
            } else {
              control.disable({ emitEvent: false });
            }
          }
        });
    }

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
      const airplane = this.store.selected();
      if (airplane && airplane.id === untracked(this.id)) {
        untracked(() => this.form.reset(toAirplaneFormValue(airplane)));
      }
    });
  }

  protected retryLoad(): void {
    const id = this.id();
    if (id) {
      this.store.loadOne(id);
    }
  }

  protected seatGroup(flightClass: FlightClass) {
    return this.form.controls.seats.controls[flightClass];
  }

  protected fieldError(control: AbstractControl): FieldError | null {
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if (errors['required'] || errors['notBlank']) {
      return { key: 'validation.required' };
    }
    if (errors['integer']) {
      return { key: 'validation.integer' };
    }
    if (errors['min']) {
      return { key: 'validation.min', params: { min: errors['min'].min } };
    }
    if (errors['max']) {
      return { key: 'validation.max', params: { max: errors['max'].max } };
    }
    return null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const existingId = this.id();
    const id = existingId ?? (this.newAirplaneId ??= crypto.randomUUID());
    const airplane = toAirplaneInput(id, this.form.getRawValue());

    this.store.save({
      airplane,
      isNew: !existingId,
      onSuccess: () => {
        const key = existingId ? 'airplanes.form.updated' : 'airplanes.form.created';
        this.snackBar.open(
          this.transloco.translate(key, { name: airplaneName(airplane) }),
          this.transloco.translate('common.dismiss'),
          { duration: 4000 },
        );
        void this.router.navigate(['/airplanes']);
      },
    });
  }

  private seatClassGroup(enabled: boolean) {
    const quantity = (max: number) =>
      this.formBuilder.control<number | null>(null, [
        Validators.required,
        integer,
        Validators.min(1),
        Validators.max(max),
      ]);
    return this.formBuilder.group({
      enabled: [enabled],
      rows: quantity(MAX_SEAT_ROWS),
      columns: quantity(MAX_SEAT_COLUMNS),
    });
  }
}
