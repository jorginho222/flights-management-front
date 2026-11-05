import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { AirlinesStore } from '../data/airlines.store';

/** Matches the API's upload limit, so too-large files are rejected before uploading. */
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

/** Columns the API requires in the first row, in any order. */
export const IMPORT_COLUMNS = [
  'name',
  'code',
  'priceHandBaggage',
  'maxHandBaggage',
  'priceCheckedLuggage',
  'priceExceededWeight',
  'economy',
  'premiumEconomy',
  'business',
  'first',
  'redeemFee',
];

/**
 * Closes with the number of imported airlines, or with nothing when cancelled.
 * Open it with the list's injector, so it shares the feature's AirlinesStore.
 */
@Component({
  selector: 'app-airline-import-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule, TranslocoPipe],
  templateUrl: './airline-import-dialog.html',
  styleUrl: './airline-import-dialog.scss',
})
export class AirlineImportDialog {
  protected readonly store = inject(AirlinesStore);
  private readonly dialogRef = inject<MatDialogRef<AirlineImportDialog, number>>(MatDialogRef);

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
      this.reject('airlines.import.wrongType');
    } else if (file.size > MAX_IMPORT_FILE_BYTES) {
      this.reject('airlines.import.tooLarge');
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
