import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// TODO: if you already have an environment, swap API to environment.api
const API = 'http://localhost:5005';

export type DeviceStatus = 'Online'|'Stale'|'Offline'|'Blocked'|number;

export interface Device {
  id: string;
  name: string;
  registeredAt: string;
  lastSeenAt?: string;
  status: DeviceStatus;
}

@Injectable({ providedIn: 'root' })
export class DevicesService {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Device[]>(`${API}/api/devices`);
  }

  command(id: string, type: 'reboot'|'update'|'run_script'|'start_report'|'stop_report', payload: any = {}) {
    return this.http.post<{commandId:string; status:string}>(`${API}/api/devices/${id}/commands`, { type, payload });
  }

  startReport(id: string, periodSeconds = 60) {
    return this.command(id, 'start_report', { periodSeconds });
  }

  stopReport(id: string) {
    return this.command(id, 'stop_report', {});
  }

  // NEW
  invite() {
    return this.http.post<{enrollmentKey: string; expiresAt: string}>(`${API}/api/devices/invites`, {});
  }

  // NEW
  remove(id: string) {
    return this.http.delete(`${API}/api/devices/${id}`);
  }

  // NEW
  block(id: string) {
    return this.http.post(`${API}/api/devices/${id}/block`, {});
  }

  // NEW
  unblock(id: string) {
    return this.http.post(`${API}/api/devices/${id}/unblock`, {});
  }
}
