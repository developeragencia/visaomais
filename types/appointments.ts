export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
export type ServiceType = 'exam' | 'consultation' | 'follow-up' | 'emergency';

export interface Appointment {
  id: number;
  userId: number;
  franchiseId: number;
  date: Date;
  time: string;
  serviceType: ServiceType;
  status: AppointmentStatus;
  confirmationCode?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertAppointment {
  userId: number;
  franchiseId: number;
  date: Date;
  time: string;
  serviceType: ServiceType;
  status: AppointmentStatus;
  confirmationCode?: string;
  notes?: string;
}

export interface UpdateAppointment {
  date?: Date;
  time?: string;
  serviceType?: ServiceType;
  status?: AppointmentStatus;
  confirmationCode?: string;
  notes?: string;
}

export interface AppointmentFilters {
  startDate?: Date;
  endDate?: Date;
  status?: AppointmentStatus;
  serviceType?: ServiceType;
  franchiseId?: number;
}

export interface TimeSlot {
  time: string;
  isAvailable: boolean;
  appointmentId?: number;
}

export interface AppointmentStats {
  total: number;
  byStatus: Record<AppointmentStatus, number>;
  byServiceType: Record<ServiceType, number>;
  byDate: {
    date: string;
    count: number;
  }[];
} 