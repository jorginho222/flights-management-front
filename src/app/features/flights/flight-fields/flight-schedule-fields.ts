import { Component, computed, input } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { DAY_PERIODS, HOURS, MINUTES } from '../data/flight-form.mapper';
import { fieldError, FlightScheduleGroup } from './flight-fields';

/** A date picker and hour, minute and AM/PM selects for each of departure and arrival. */
@Component({
  selector: 'app-flight-schedule-fields',
  imports: [
    MatDatepickerModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  templateUrl: './flight-schedule-fields.html',
  styleUrl: './flight-fields.scss',
})
export class FlightScheduleFields {
  readonly group = input.required<FlightScheduleGroup>();

  protected readonly fieldError = fieldError;
  protected readonly hours = HOURS;
  protected readonly periods = DAY_PERIODS;

  /** Departure, then arrival: each is a date field and a time row of three selects. */
  protected readonly moments = computed(() => {
    const { controls } = this.group();
    return [
      { key: 'departure', date: controls.departureDate, time: controls.departureTime },
      { key: 'arrival', date: controls.arrivalDate, time: controls.arrivalTime },
    ];
  });

  /**
   * The 5-minute steps, plus the current minute when it's off-step (a flight saved
   * through the API at 10:07), so opening and saving doesn't move the time.
   */
  protected minuteOptions(current: number | null): number[] {
    return current === null || MINUTES.includes(current)
      ? MINUTES
      : [...MINUTES, current].sort((a, b) => a - b);
  }

  /** Such as "05". */
  protected pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  /** One message under the three selects, which are too narrow for their own. */
  protected timeIncomplete(time: AbstractControl): boolean {
    return time.touched && time.invalid;
  }

  protected scheduleError(): boolean {
    const group = this.group();
    const { arrivalDate, arrivalTime } = group.controls;
    return group.hasError('arrivalBeforeDeparture') && (arrivalDate.touched || arrivalTime.touched);
  }
}
