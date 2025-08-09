import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:5005'; // change to your LAN URL if needed

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

  command(id: string, type: 'reboot'|'update'|'run_script', payload: any = {}) {
    return this.http.post<{commandId:string; status:string}>(`${API}/api/devices/${id}/commands`, { type, payload });
  }
}
