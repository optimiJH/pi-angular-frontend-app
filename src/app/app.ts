import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule }    from '@angular/material/icon';
import { MatTabsModule }    from '@angular/material/tabs';
import { MatButtonModule }  from '@angular/material/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatTabsModule, MatButtonModule],
  templateUrl: 'app.html',
  styleUrl: 'app.css'
})
export class App {
  protected readonly title = signal('Pi Dashboard');
}
