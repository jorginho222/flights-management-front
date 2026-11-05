import { Component, effect, inject, OnInit, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog';
import { Airline } from '../data/airline.model';
import { AirlinesStore } from '../data/airlines.store';

@Component({
  selector: 'app-airline-list',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './airline-list.html',
  styleUrl: './airline-list.scss',
})
export class AirlineList implements OnInit {
  protected readonly store = inject(AirlinesStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly columns = ['name', 'code', 'actions'];
  protected readonly dataSource = new MatTableDataSource<Airline>();

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    this.dataSource.sortingDataAccessor = (airline, column) =>
      column === 'code' ? airline.code : airline.name.toLocaleLowerCase();

    effect(() => (this.dataSource.data = this.store.entities()));
    effect(() => (this.dataSource.sort = this.sort() ?? null));
    effect(() => (this.dataSource.paginator = this.paginator() ?? null));
  }

  ngOnInit(): void {
    this.store.load();
  }

  protected reload(): void {
    this.store.load();
  }

  protected confirmDelete(airline: Airline): void {
    const data: ConfirmDialogData = {
      title: this.transloco.translate('airlines.delete.title'),
      message: this.transloco.translate('airlines.delete.message', {
        name: airline.name,
        code: airline.code,
      }),
      confirmLabel: this.transloco.translate('common.delete'),
    };

    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.delete(airline));
  }

  private delete(airline: Airline): void {
    this.store.remove({
      id: airline.id,
      onSuccess: () =>
        this.notify(this.transloco.translate('airlines.delete.success', { name: airline.name })),
      onError: (error: ApiError) =>
        this.notify(error.messages.join(' ') || this.transloco.translate('errors.generic')),
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, this.transloco.translate('common.dismiss'), { duration: 6000 });
  }
}
