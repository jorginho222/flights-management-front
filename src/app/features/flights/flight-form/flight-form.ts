import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  FlightDetailsValue,
  FlightScheduleValue,
  toCreateFlightInput,
} from '../data/flight-form.mapper';
import { flightCode } from '../data/flight.model';
import { FlightsStore } from '../data/flights.store';
import { FlightDetailsFields } from '../flight-fields/flight-details-fields';
import { detailsGroup, scheduleGroup } from '../flight-fields/flight-fields';
import { FlightScheduleFields } from '../flight-fields/flight-schedule-fields';

/** Creates a flight. Editing has its own screen, `FlightEdit`, because each part saves apart. */
@Component({
  selector: 'app-flight-form',
  imports: [
    FlightDetailsFields,
    FlightScheduleFields,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './flight-form.html',
  styleUrl: './flight-form.scss',
})
export class FlightForm implements OnInit {
  protected readonly store = inject(FlightsStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly form = new FormGroup({
    details: detailsGroup(),
    schedule: scheduleGroup(),
  });

  /** Kept across attempts, so retrying after a lost response can't create a second flight. */
  private newFlightId?: string;

  ngOnInit(): void {
    // The store outlives the screen, so clear the last session's save error
    this.store.resetForm();
    this.store.loadAirlines();
    this.store.loadAirplanes();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = (this.newFlightId ??= crypto.randomUUID());
    const { details, schedule } = this.form.getRawValue();
    const flight = toCreateFlightInput(
      id,
      details as FlightDetailsValue,
      schedule as FlightScheduleValue,
    );

    this.store.create({
      input: flight,
      onSuccess: (saved) => {
        this.snackBar.open(
          this.transloco.translate('flights.form.created', { code: flightCode(saved) }),
          this.transloco.translate('common.dismiss'),
          { duration: 4000 },
        );
        void this.router.navigate(['/flights']);
      },
    });
  }
}
