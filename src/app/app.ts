import { Component, signal } from '@angular/core';
import { ReadingsTableComponent } from './readings-table.component';

@Component({
  selector: 'app-root',
  standalone: true,
  /* register the table component here */
  imports: [ReadingsTableComponent],
  templateUrl: 'app.html',
  styleUrl: 'app.css'
})
export class App {
  protected readonly title = signal('sensor-dashboard');
}
