import {
  Component,
  computed,
  effect,
  inject,
  input,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  PristineChangeEvent,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import {
  FlightDetailsValue,
  FlightScheduleValue,
  toDetailsValue,
  toScheduleInput,
  toScheduleValue,
  toUpdateFlightInput,
} from '../data/flight-form.mapper';
import { Flight, flightCode, FLIGHT_STATUSES, FlightStatus } from '../data/flight.model';
import { FlightsStore } from '../data/flights.store';
import { FlightDetailsFields } from '../flight-fields/flight-details-fields';
import { detailsGroup, scheduleGroup } from '../flight-fields/flight-fields';
import { FlightScheduleFields } from '../flight-fields/flight-schedule-fields';

/** True once the user changes the form, false again after a reset. */
function dirtySignal(form: AbstractControl): Signal<boolean> {
  return toSignal(
    form.events.pipe(
      filter((event) => event instanceof PristineChangeEvent),
      map(() => form.dirty),
    ),
    { initialValue: form.dirty },
  );
}

/**
 * Edits a flight in three tabs. Each tab saves through its own endpoint and keeps its own
 * unsaved changes: a save resets its tab, and any other tab the user hasn't touched.
 */
@Component({
  selector: 'app-flight-edit',
  imports: [
    FlightDetailsFields,
    FlightScheduleFields,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatTabsModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './flight-edit.html',
  styleUrl: './flight-edit.scss',
})
export class FlightEdit {
  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly store = inject(FlightsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly statuses = FLIGHT_STATUSES;
  protected readonly tab = signal(0);

  protected readonly detailsForm = detailsGroup();
  protected readonly scheduleForm = scheduleGroup();
  protected readonly statusForm = new FormGroup({
    status: new FormControl<FlightStatus | null>(null, Validators.required),
  });

  protected readonly detailsDirty = dirtySignal(this.detailsForm);
  protected readonly scheduleDirty = dirtySignal(this.scheduleForm);
  protected readonly statusDirty = dirtySignal(this.statusForm);

  protected readonly code = computed(() => {
    const flight = this.store.selected();
    return flight ? flightCode(flight) : '';
  });

  /** `PUT /flights/:id` only edits scheduled flights. */
  protected readonly detailsLocked = computed(() => {
    const flight = this.store.selected();
    return flight !== null && flight.status !== 'scheduled';
  });

  /** The flight the forms were filled from, so a save doesn't refill the other tabs. */
  private loadedId?: string;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.loadedId = undefined;
        this.tab.set(0);
        this.store.loadOne(id);
        this.store.loadAirlines();
        this.store.loadAirplanes();
      });
    });

    effect(() => {
      const flight = this.store.selected();
      if (flight && flight.id !== this.loadedId) {
        untracked(() => {
          this.loadedId = flight.id;
          this.detailsForm.reset(toDetailsValue(flight));
          this.scheduleForm.reset(toScheduleValue(flight));
          this.statusForm.reset({ status: flight.status });
        });
      }
    });

    effect(() => {
      const locked = this.detailsLocked();
      untracked(() => (locked ? this.detailsForm.disable() : this.detailsForm.enable()));
    });
  }

  protected saveDetails(): void {
    const flight = this.store.selected();
    if (!flight || this.detailsLocked() || !this.valid(this.detailsForm)) {
      return;
    }
    const details = this.detailsForm.getRawValue() as FlightDetailsValue;
    this.store.updateDetails({
      input: { id: flight.id, ...toUpdateFlightInput(details, flight.version) },
      onSuccess: (saved) => this.saved(saved, this.detailsForm),
    });
  }

  protected saveSchedule(): void {
    const flight = this.store.selected();
    if (!flight || !this.valid(this.scheduleForm)) {
      return;
    }
    const schedule = this.scheduleForm.getRawValue() as FlightScheduleValue;
    this.store.updateSchedule({
      input: toScheduleInput(flight.id, schedule),
      onSuccess: (saved) => this.saved(saved, this.scheduleForm),
    });
  }

  protected saveStatus(): void {
    const flight = this.store.selected();
    const status = this.statusForm.getRawValue().status;
    if (!flight || !status || !this.valid(this.statusForm)) {
      return;
    }
    this.store.updateStatus({
      input: { id: flight.id, status },
      onSuccess: (saved) => this.saved(saved, this.statusForm),
    });
  }

  private valid(form: AbstractControl): boolean {
    if (form.invalid) {
      form.markAllAsTouched();
    }
    return form.valid;
  }

  /**
   * Refills the saved tab, and the untouched ones: a schedule change also changes the
   * status, and every save changes the version the details tab sends.
   */
  private saved(flight: Flight, savedForm: AbstractControl): void {
    if (savedForm === this.detailsForm || this.detailsForm.pristine) {
      this.detailsForm.reset(toDetailsValue(flight));
    }
    if (savedForm === this.scheduleForm || this.scheduleForm.pristine) {
      this.scheduleForm.reset(toScheduleValue(flight));
    }
    if (savedForm === this.statusForm || this.statusForm.pristine) {
      this.statusForm.reset({ status: flight.status });
    }
    this.snackBar.open(
      this.transloco.translate('flights.edit.updated', { code: flightCode(flight) }),
      this.transloco.translate('common.dismiss'),
      { duration: 4000 },
    );
  }
}
