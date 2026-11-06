import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { MAX_IMPORT_FILE_BYTES } from '../../../core/http/spreadsheet-import';
import { FLIGHT_CLASSES } from '../../../shared/flight-classes';
import { AirplanesStore } from '../data/airplanes.store';

/**
 * Columns the API requires in the first row, in any order. Each class has a
 * rows and a columns column, such as economyRows and economyColumns.
 */
export const IMPORT_COLUMNS = [
  'brand',
  'model',
  'passengersCapacity',
  ...FLIGHT_CLASSES.flatMap((flightClass) => [`${flightClass}Rows`, `${flightClass}Columns`]),
];

/**
 * Closes with the number of imported airplanes, or with nothing when cancelled.
 * Open it with the list's injector, so it shares the feature's AirplanesStore.
 */
@Component({
  selector: 'app-airplane-import-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule, TranslocoPipe],
  templateUrl: './airplane-import-dialog.html',
  styleUrl: './airplane-import-dialog.scss',
})
export class AirplaneImportDialog {
  protected readonly store = inject(AirplanesStore);
  private readonly dialogRef = inject<MatDialogRef<AirplaneImportDialog, number>>(MatDialogRef);

  protected readonly columns = IMPORT_COLUMNS.join(', ');
  protected readonly file = signal<File | null>(null);
  /** Translation key for a file rejected before upload. */
  protected readonly fileError = signal<string | null>(null);

  constructor() {
    this.store.resetImport();
    // Escape and backdrop clicks would hide an upload that is still running
    effect(() => (this.dialogRef.disableClose = this.store.importing()));
  }

  protected onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    // Clearing the input lets the same file be picked again after fixing it
    input.value = '';
    if (!file) {
      return;
    }

    this.store.resetImport();
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.reject('import.wrongType');
    } else if (file.size > MAX_IMPORT_FILE_BYTES) {
      this.reject('import.tooLarge');
    } else {
      this.fileError.set(null);
      this.file.set(file);
    }
  }

  protected upload(): void {
    const file = this.file();
    if (!file) {
      return;
    }
    this.store.importFile({
      file,
      onSuccess: (imported) => this.dialogRef.close(imported),
    });
  }

  private reject(key: string): void {
    this.file.set(null);
    this.fileError.set(key);
  }
}
