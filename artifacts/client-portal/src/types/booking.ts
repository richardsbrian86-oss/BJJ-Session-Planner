export interface BookingSessionData {
  id: number;
  date: string;
  time: string;
  serviceName: string;
  servicePrice: number;
  packageCount: number | null;
  packageTotal: number | null;
  instructorSlug: string;
  instructorName: string;
  cancellationToken?: string | null;
  paymentIntentId?: string | null;
}
