import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReadingsTableComponent } from './readings-table.component';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-sensor-readings',
  standalone: true,
  imports: [CommonModule, ReadingsTableComponent, MatCardModule],
  template: `
    <mat-card>
      <h2 class="page-title">Sensor Readings</h2>
      <app-readings-table></app-readings-table>
    </mat-card>
  `
})
export class SensorReadingsComponent {}
