import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

export const routes: Routes = [
  { path: '', redirectTo: 'readings', pathMatch: 'full' },
  { path: 'readings', loadComponent: () => import('./sensor-readings.component').then(m => m.SensorReadingsComponent) },
  { path: 'telemetry', loadComponent: () => import('./telemetry.component').then(m => m.TelemetryComponent) },
  { path: 'devices',  loadComponent: () => import('./devices.component').then(m => m.DevicesComponent) },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideAnimations(),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
  ]
};
